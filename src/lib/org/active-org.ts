import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getDefaultOrgName,
  listInstalledOrganizations,
  normalizeOrgName,
} from "@/lib/github/app";

export const ACTIVE_ORG_COOKIE = "repotrack_active_org";

export interface OrganizationOption {
  name: string;
  avatarUrl?: string;
  htmlUrl: string;
  isDefault: boolean;
  isInstalled: boolean;
  assignmentCount: number;
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
 * Collects all known / accessible GitHub Organizations from:
 * - Default env organization (GITHUB_ORG_NAME)
 * - GitHub App installations
 * - Registered assignments in Supabase DB
 * - Currently active organization (if custom-entered by user)
 */
export async function getAvailableOrganizations(
  activeOrg?: string
): Promise<OrganizationOption[]> {
  const defaultOrg = getDefaultOrgName();
  const map = new Map<string, OrganizationOption>();

  const upsertOrg = (
    rawName: string,
    partial?: Partial<OrganizationOption>
  ) => {
    const clean = normalizeOrgName(rawName);
    if (!isValidOrgSlug(clean)) return;
    const key = clean.toLowerCase();
    const existing = map.get(key);

    if (existing) {
      map.set(key, {
        ...existing,
        ...partial,
        name: partial?.isInstalled ? clean : existing.name,
        avatarUrl: partial?.avatarUrl || existing.avatarUrl,
        isDefault: existing.isDefault || Boolean(partial?.isDefault),
        isInstalled: existing.isInstalled || Boolean(partial?.isInstalled),
        assignmentCount:
          partial?.assignmentCount !== undefined
            ? partial.assignmentCount
            : existing.assignmentCount,
      });
    } else {
      map.set(key, {
        name: clean,
        avatarUrl: partial?.avatarUrl,
        htmlUrl: partial?.htmlUrl || `https://github.com/${clean}`,
        isDefault:
          Boolean(partial?.isDefault) ||
          clean.toLowerCase() === defaultOrg.toLowerCase(),
        isInstalled: Boolean(partial?.isInstalled),
        assignmentCount: partial?.assignmentCount ?? 0,
      });
    }
  };

  // 1. Default org
  if (defaultOrg) {
    upsertOrg(defaultOrg, { isDefault: true });
  }

  // 2. Installed GitHub App orgs & DB assignments in parallel
  const [installedOrgs, dbAssignmentsRes] = await Promise.all([
    listInstalledOrganizations(),
    supabaseAdmin.from("assignments").select("org_name"),
  ]);

  for (const inst of installedOrgs) {
    upsertOrg(inst.login, {
      avatarUrl: inst.avatarUrl,
      htmlUrl: inst.htmlUrl,
      isInstalled: true,
    });
  }

  // Count assignments per org_name in DB
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

  // 3. Ensure activeOrg is always present in the list
  if (activeOrg && isValidOrgSlug(activeOrg)) {
    upsertOrg(activeOrg);
  }

  // Sort: default org first, then installed orgs, then by assignmentCount desc, then alphabetically
  return Array.from(map.values()).sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    if (a.isInstalled !== b.isInstalled) return a.isInstalled ? -1 : 1;
    if (b.assignmentCount !== a.assignmentCount) {
      return b.assignmentCount - a.assignmentCount;
    }
    return a.name.localeCompare(b.name);
  });
}
