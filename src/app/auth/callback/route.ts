import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  checkIsOrgOwner,
  checkIsOrgOwnerWithUserToken,
  listUserOrgMembershipsWithToken,
  UserOrgMembership,
} from "@/lib/github/app";
import { ACTIVE_ORG_COOKIE } from "@/lib/org/active-org";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Default redirect destination is /dashboard (Organization Selection Page)
  const next = requestUrl.searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback error:", error);
      return NextResponse.redirect(`${requestUrl.origin}/login?error=${encodeURIComponent(error.message)}`);
    }

    const user = data.user;
    if (user) {
      const githubId = Number(user.user_metadata?.provider_id || user.identities?.[0]?.id);
      const githubLogin = user.user_metadata?.user_name || user.user_metadata?.preferred_username || "";
      const avatarUrl = user.user_metadata?.avatar_url || "";
      const providerToken = data.session?.provider_token;

      if (githubId && githubLogin) {
        let role: "student" | "staff" = "student";
        let userOrgs: UserOrgMembership[] = [];

        try {
          // 1. Fetch all organizations connected to the user's GitHub account using OAuth provider token
          if (providerToken) {
            userOrgs = await listUserOrgMembershipsWithToken(providerToken);
            if (userOrgs.some((o) => o.role === "admin")) {
              role = "staff";
              console.log(
                `[Auth Callback] User ${githubLogin} recognized as STAFF (Owner of: ${userOrgs
                  .filter((o) => o.role === "admin")
                  .map((o) => o.login)
                  .join(", ")}).`
              );
            } else {
              const isOwnerWithToken = await checkIsOrgOwnerWithUserToken(providerToken);
              if (isOwnerWithToken) {
                role = "staff";
              }
            }
          }

          // 2. Fallback to GitHub App installation token if token didn't match
          if (role !== "staff") {
            const isOwnerWithApp = await checkIsOrgOwner(githubLogin);
            if (isOwnerWithApp) {
              role = "staff";
              console.log(`[Auth Callback] User ${githubLogin} recognized as STAFF via GitHub App token.`);
            }
          }

          // Save user's connected GitHub organizations into user_metadata for instant toggle switching
          if (userOrgs.length > 0) {
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
              user_metadata: {
                ...(user.user_metadata || {}),
                github_orgs: userOrgs,
              },
            });
          }
        } catch (err) {
          console.warn("[Auth Callback] Could not check org owner status, defaulting to student:", err);
        }

        // Upsert into public.profiles using admin client (bypasses RLS to guarantee role update)
        const { error: upsertError } = await supabaseAdmin
          .from("profiles")
          .upsert(
            {
              id: user.id,
              github_id: githubId,
              github_login: githubLogin,
              role: role,
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "id",
            }
          );

        if (upsertError) {
          console.error("Failed to upsert user profile:", upsertError);
        }

        // Link student repo if roster exists
        try {
          const { data: rosterMatches } = await supabaseAdmin
            .from("roster")
            .select("assignment_id, student_no, name")
            .eq("github_login", githubLogin);

          if (rosterMatches && rosterMatches.length > 0) {
            for (const item of rosterMatches) {
              await supabaseAdmin
                .from("student_repos")
                .update({ profile_id: user.id, student_no: item.student_no, student_name: item.name })
                .eq("assignment_id", item.assignment_id)
                .eq("github_id", githubId);
            }
          }
        } catch (e) {
          console.error("Failed to link student repo with roster:", e);
        }

        // Always start at /dashboard (Organization Selection screen) unless explicit next was given
        const response = NextResponse.redirect(`${requestUrl.origin}${next}`);
        response.cookies.delete(ACTIVE_ORG_COOKIE);
        return response;
      }
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
