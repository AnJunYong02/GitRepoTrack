import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkIsOrgOwner, checkIsOrgOwnerWithUserToken } from "@/lib/github/app";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  // Default redirect destination changed to /dashboard
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
        // Automatically check if user is an Owner (admin) of the target GitHub organization
        let role: "student" | "staff" = "student";
        try {
          // 1. Check with user's own OAuth provider token (supports Private membership & zero GitHub App setup required)
          if (providerToken) {
            const isOwnerWithToken = await checkIsOrgOwnerWithUserToken(providerToken);
            if (isOwnerWithToken) {
              role = "staff";
              console.log(`[Auth Callback] User ${githubLogin} recognized as STAFF via OAuth provider token.`);
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

          if (role === "student") {
            console.log(`[Auth Callback] User ${githubLogin} assigned role STUDENT.`);
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

        // If user is staff and default redirect was /dashboard, navigate directly to /admin
        const finalRedirect = role === "staff" && next === "/dashboard" ? "/admin" : next;
        return NextResponse.redirect(`${requestUrl.origin}${finalRedirect}`);
      }
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}${next}`);
}
