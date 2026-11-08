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
  /** 사용자가 대시보드 입장 카드로 등록한 org인지 */
  isRegistered: boolean;
}

/**
 * 신뢰할 수 있는 GitHub 멤버십 목록 (app_metadata — 서비스 롤만 쓰기 가능).
 * user_metadata는 사용자가 브라우저에서 직접 수정할 수 있으므로 권한 판단에 쓰지 않는다.
 */
export function getTrustedMembershipOrgs(user?: any): UserOrgMembership[] {
  const orgs = user?.app_metadata?.github_orgs;
  return Array.isArray(orgs) ? orgs : [];
}

/**
 * 예전 방식으로 user_metadata에 저장된 org 이름 (표시용으로만 사용, role은 무시).
 */
export function getLegacyOrgNames(user?: any): string[] {
  const orgs = user?.user_metadata?.github_orgs;
  if (!Array.isArray(orgs)) return [];
  return orgs
    .map((o: any) => normalizeOrgName(String(o?.login || "")))
    .filter((name: string) => isValidOrgSlug(name));
}

/**
 * 사용자가 등록한 org 이름 목록. 아직 한 번도 저장하지 않았다면 null.
 */
export function getRegisteredOrgNames(user?: any): string[] | null {
  const orgs = user?.app_metadata?.registered_orgs;
  if (!Array.isArray(orgs)) return null;
  return orgs
    .map((o: unknown) => normalizeOrgName(String(o || "")))
    .filter((name: string) => isValidOrgSlug(name));
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

  // app_metadata만 신뢰 (user_metadata의 role은 사용자가 위조 가능)
  const metaOrgs = getTrustedMembershipOrgs(user);

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
        isRegistered: false,
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
        isRegistered: false,
      });
    }
  };

  // 1. User's connected GitHub Organizations from OAuth login (trusted app_metadata)
  const metaOrgs = getTrustedMembershipOrgs(user);

  // 예전에 user_metadata에 저장된 org는 이름만 표시 (role은 아래 GitHub App 조회로 판단)
  for (const legacyName of getLegacyOrgNames(user)) {
    upsertOrg(legacyName);
  }

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

  // 7. 등록 여부 표시. registered_orgs를 한 번도 저장하지 않은 기존 사용자는
  //    예전 화면과 같도록 모든 org를 등록된 것으로 간주한다(삭제 버튼으로 정리 가능).
  const registered = getRegisteredOrgNames(user);
  const registeredKeys = registered
    ? new Set(registered.map((n) => n.toLowerCase()))
    : null;
  if (registered) {
    // 등록했지만 다른 경로로 발견되지 않은 org도 카드로 보이도록 추가
    for (const name of registered) upsertOrg(name);
  }
  for (const [key, org] of map) {
    map.set(key, {
      ...org,
      isRegistered: registeredKeys ? registeredKeys.has(key) : true,
    });
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
 * 사용자의 등록 org 목록(app_metadata.registered_orgs)에 org를 추가하거나 제거한다.
 * - 아직 목록이 없던 기존 사용자는 seedNames(지금 화면에 카드로 보이던 org)로 먼저 채운다.
 * - 제거할 때는 예전 방식(user_metadata.github_orgs)에 남은 항목도 함께 지워 다시 나타나지 않게 한다.
 * 반환값: 변경 후 등록 목록
 */
export async function updateRegisteredOrgs(
  userId: string,
  orgName: string,
  action: "add" | "remove",
  seedNames: string[] = []
): Promise<string[]> {
  const cleanOrg = normalizeOrgName(orgName);
  if (!userId || !isValidOrgSlug(cleanOrg)) {
    throw new Error("유효한 GitHub Organization 이름이 아닙니다.");
  }

  // 요청 시점의 user 객체는 오래됐을 수 있으므로 최신 값을 다시 읽는다
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (error || !data?.user) {
    throw error || new Error("사용자 정보를 찾을 수 없습니다.");
  }
  const freshUser = data.user;

  const current = getRegisteredOrgNames(freshUser) ?? seedNames;
  const key = cleanOrg.toLowerCase();
  const withoutTarget = current.filter((n) => n.toLowerCase() !== key);

  let canonicalName = cleanOrg;
  if (action === "add") {
    const details = await fetchGitHubOrgDetails(cleanOrg);
    canonicalName = details?.login || cleanOrg;
  }
  const next = action === "add" ? [...withoutTarget, canonicalName] : withoutTarget;

  const update: Record<string, any> = {
    app_metadata: {
      ...(freshUser.app_metadata || {}),
      registered_orgs: next,
    },
  };

  if (action === "remove" && Array.isArray(freshUser.user_metadata?.github_orgs)) {
    update.user_metadata = {
      ...(freshUser.user_metadata || {}),
      github_orgs: freshUser.user_metadata.github_orgs.filter(
        (o: any) => normalizeOrgName(String(o?.login || "")).toLowerCase() !== key
      ),
    };
  }

  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
    userId,
    update
  );
  if (updateErr) throw updateErr;

  return next;
}
