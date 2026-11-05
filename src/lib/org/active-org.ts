import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  checkUserOrgRole,
  fetchGitHubOrgDetails,
  getDefaultOrgName,
  listInstalledOrganizations,
  listPublicOrgsForUser,
  normalizeOrgName,
  UserOrgMembership,
} from "@/lib/github/app";

export const ACTIVE_ORG_COOKIE = "repotrack_active_org";

export interface OrganizationOption {
  name: string;
  avatarUrl?: string;
  htmlUrl: string;
  description?: string;
  isDefault: boolean;
  isInstalled: boolean;
  assignmentCount: number;
  userRole: "admin" | "member";
  isOwner: boolean;
}

/**
 * Validates that an organization slug contains only valid GitHub account characters.
 */
export function isValidOrgSlug(slug?: string | null): boolean {
  if (!slug) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(slug.trim());
}

/**
 * Resolves the currently active GitHub Organization for the request.
 * Priority:
 * 1. Explicit URL query param (?org=...)
 * 2. Stored cookie (repotrack_active_org)
 * 3. Default env organization (GITHUB_ORG_NAME || "2026-2-WebService")
 */
export async function resolveActiveOrg(
  queryOrg?: string | string[] | null
): Promise<string> {
  const rawQuery = Array.isArray(queryOrg) ? queryOrg[0] : queryOrg;
  const normalizedQuery = normalizeOrgName(rawQuery || "");
  if (isValidOrgSlug(normalizedQuery)) {
    return normalizedQuery;
  }

  try {
    const cookieStore = await cookies();
    const cookieVal = normalizeOrgName(
      cookieStore.get(ACTIVE_ORG_COOKIE)?.value || ""
    );
    if (isValidOrgSlug(cookieVal)) {
      return cookieVal;
    }
  } catch {
    // cookies() may throw outside request context
  }

  return getDefaultOrgName();
}

/**
 * Checks whether the given user is an Owner (admin) of a specific GitHub Organization.
 * Also promotes `profiles.role` to "staff" if the user is verified as an Owner of the Organization.
 */
export async function checkIsUserOwnerOfOrg(
  orgName: string,
  user?: any,
  profile?: any
): Promise<boolean> {
  const cleanOrg = normalizeOrgName(orgName);
  if (!isValidOrgSlug(cleanOrg) || !user) return false;

  const metaOrgs: UserOrgMembership[] = Array.isArray(
    user.user_metadata?.github_orgs
  )
    ? user.user_metadata.github_orgs
    : [];

  const matchedMeta = metaOrgs.find(
    (o) => normalizeOrgName(o.login).toLowerCase() === cleanOrg.toLowerCase()
  );
  if (matchedMeta?.role === "admin") {
    if (profile && profile.role !== "staff") {
      await supabaseAdmin
        .from("profiles")
        .update({ role: "staff", updated_at: new Date().toISOString() })
        .eq("id", user.id);
    }
    return true;
  }

  const githubLogin =
    profile?.github_login ||
    user.user_metadata?.user_name ||
    user.user_metadata?.preferred_username ||
    "";

  if (githubLogin) {
    const appRole = await checkUserOrgRole(githubLogin, cleanOrg);
    if (appRole === "admin") {
      if (profile && profile.role !== "staff") {
        await supabaseAdmin
          .from("profiles")
          .update({ role: "staff", updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
      return true;
    }
  }

  // Fallback: if user has staff role in DB and this is the default org (and no explicit member-only record)
  if (
    !matchedMeta &&
    profile?.role === "staff" &&
    cleanOrg.toLowerCase() === getDefaultOrgName().toLowerCase()
  ) {
    return true;
  }

  return false;
}

/**
 * Collects the GitHub Organizations connected to the user's GitHub account
 * (along with installed course organizations and their Owner/Student role in each).
 */
export async function getAvailableOrganizations(
  activeOrg?: string,
  userContext?: { user?: any; profile?: any },
  options?: { forceRefresh?: boolean; searchQuery?: string }
): Promise<OrganizationOption[]> {
  const defaultOrg = getDefaultOrgName();
  const user = userContext?.user;
  const profile = userContext?.profile;
  const forceRefresh = Boolean(options?.forceRefresh);
  const searchQuery = normalizeOrgName(options?.searchQuery || "");
  const githubLogin =
    profile?.github_login ||
    user?.user_metadata?.user_name ||
    user?.user_metadata?.preferred_username ||
    "";

  const map = new Map<string, OrganizationOption>();

  const upsertOrg = (
    rawName: string,
    partial?: Partial<OrganizationOption>
  ) => {
    const clean = normalizeOrgName(rawName);
    if (!isValidOrgSlug(clean)) return;
    const key = clean.toLowerCase();
    const existing = map.get(key);

    const nextRole: "admin" | "member" =
      partial?.userRole === "admin" || existing?.userRole === "admin"
        ? "admin"
        : partial?.userRole || existing?.userRole || "member";

    if (existing) {
      map.set(key, {
        ...existing,
        ...partial,
        name: partial?.isInstalled ? clean : existing.name,
        avatarUrl: partial?.avatarUrl || existing.avatarUrl,
        description: partial?.description || existing.description,
        isDefault: existing.isDefault || Boolean(partial?.isDefault),
        isInstalled: existing.isInstalled || Boolean(partial?.isInstalled),
        assignmentCount:
          partial?.assignmentCount !== undefined
            ? partial.assignmentCount
            : existing.assignmentCount,
        userRole: nextRole,
        isOwner: nextRole === "admin",
      });
    } else {
      map.set(key, {
        name: clean,
        avatarUrl: partial?.avatarUrl,
        htmlUrl: partial?.htmlUrl || `https://github.com/${clean}`,
        description: partial?.description,
        isDefault:
          Boolean(partial?.isDefault) ||
          clean.toLowerCase() === defaultOrg.toLowerCase(),
        isInstalled: Boolean(partial?.isInstalled),
        assignmentCount: partial?.assignmentCount ?? 0,
        userRole: nextRole,
        isOwner: nextRole === "admin",
      });
    }
  };

  // 1. User's connected GitHub Organizations from OAuth login metadata
  const metaOrgs: UserOrgMembership[] = Array.isArray(
    user?.user_metadata?.github_orgs
  )
    ? user.user_metadata.github_orgs
    : [];

  for (const m of metaOrgs) {
    upsertOrg(m.login, {
      avatarUrl: m.avatarUrl,
      htmlUrl: m.htmlUrl,
      description: m.description,
      userRole: m.role === "admin" ? "admin" : "member",
    });
  }

  // 2. Installed GitHub App orgs, user's public GitHub orgs, & DB assignments in parallel
  const [installedOrgs, publicUserOrgs, dbAssignmentsRes] = await Promise.all([
    listInstalledOrganizations(forceRefresh),
    githubLogin ? listPublicOrgsForUser(githubLogin, forceRefresh) : Promise.resolve([]),
    supabaseAdmin.from("assignments").select("org_name"),
  ]);

  for (const pub of publicUserOrgs) {
    upsertOrg(pub.login, {
      avatarUrl: pub.avatarUrl,
      htmlUrl: pub.htmlUrl,
      description: pub.description,
      userRole: pub.role,
    });
  }

  // Check user's role in installed orgs via GitHub App if not already admin in metaOrgs
  await Promise.all(
    installedOrgs.map(async (inst) => {
      const key = normalizeOrgName(inst.login).toLowerCase();
      const alreadyAdminInMeta = metaOrgs.some(
        (m) => normalizeOrgName(m.login).toLowerCase() === key && m.role === "admin"
      );
      let role: "admin" | "member" = alreadyAdminInMeta ? "admin" : "member";
      if (!alreadyAdminInMeta && githubLogin) {
        const detected = await checkUserOrgRole(githubLogin, inst.login);
        if (detected === "admin") {
          role = "admin";
        }
      }
      upsertOrg(inst.login, {
        avatarUrl: inst.avatarUrl,
        htmlUrl: inst.htmlUrl,
        isInstalled: true,
        userRole: role,
      });
    })
  );

  // 3. Default org fallback
  if (defaultOrg) {
    const isStaffFallback =
      metaOrgs.length === 0 && profile?.role === "staff";
    upsertOrg(defaultOrg, {
      isDefault: true,
      userRole: isStaffFallback ? "admin" : undefined,
    });
  }

  // 4. Count assignments per org_name in DB
  const countsByKey = new Map<string, { name: string; count: number }>();
  for (const row of dbAssignmentsRes.data || []) {
    const clean = normalizeOrgName(row.org_name || "");
    if (!isValidOrgSlug(clean)) continue;
    const key = clean.toLowerCase();
    const prev = countsByKey.get(key);
    countsByKey.set(key, {
      name: prev?.name || clean,
      count: (prev?.count || 0) + 1,
    });
  }

  for (const [, info] of countsByKey) {
    upsertOrg(info.name, { assignmentCount: info.count });
  }

  // 5. Ensure activeOrg is present if provided
  if (activeOrg && isValidOrgSlug(activeOrg)) {
    upsertOrg(activeOrg);
  }

  // 6. If user searched for a specific GitHub Organization slug, inspect it on GitHub
  if (searchQuery && searchQuery.length >= 2 && isValidOrgSlug(searchQuery)) {
    const key = searchQuery.toLowerCase();
    const existing = map.get(key);
    if (!existing || !existing.avatarUrl) {
      const [details, detectedRole] = await Promise.all([
        fetchGitHubOrgDetails(searchQuery),
        githubLogin ? checkUserOrgRole(githubLogin, searchQuery) : Promise.resolve(null),
      ]);
      if (details) {
        upsertOrg(details.login, {
          avatarUrl: details.avatarUrl,
          htmlUrl: details.htmlUrl,
          description: details.description,
          userRole: detectedRole === "admin" ? "admin" : "member",
        });
      }
    }
  }

  // Sort: Owner orgs first, then installed orgs, then default org, then by assignmentCount desc
  return Array.from(map.values()).sort((a, b) => {
    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
    if (a.isInstalled !== b.isInstalled) return a.isInstalled ? -1 : 1;
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (b.assignmentCount !== a.assignmentCount) {
      return b.assignmentCount - a.assignmentCount;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Persists a newly connected/registered Organization into the user's `user_metadata.github_orgs`
 * so it permanently appears in their Organization selector and switcher dropdown.
 */
export async function saveConnectedOrgToUserMetadata(
  user: any,
  orgName: string,
  isOwner: boolean
): Promise<void> {
  const cleanOrg = normalizeOrgName(orgName);
  if (!user?.id || !isValidOrgSlug(cleanOrg)) return;

  try {
    const details = await fetchGitHubOrgDetails(cleanOrg);
    const canonicalName = details?.login || cleanOrg;
    const existingOrgs: UserOrgMembership[] = Array.isArray(
      user.user_metadata?.github_orgs
    )
      ? user.user_metadata.github_orgs
      : [];

    const filtered = existingOrgs.filter(
      (o) => normalizeOrgName(o.login).toLowerCase() !== canonicalName.toLowerCase()
    );

    const updatedOrgs: UserOrgMembership[] = [
      {
        login: canonicalName,
        avatarUrl: details?.avatarUrl,
        htmlUrl: details?.htmlUrl || `https://github.com/${canonicalName}`,
        description: details?.description,
        role: isOwner ? "admin" : "member",
      },
      ...filtered,
    ];

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.user_metadata || {}),
        github_orgs: updatedOrgs,
      },
    });
  } catch (err) {
    console.warn("[saveConnectedOrgToUserMetadata] Could not persist org to metadata:", err);
  }
}
