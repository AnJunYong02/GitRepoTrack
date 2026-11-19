import { cachedCall, safeRevalidateTag } from "@/lib/cache/shared-cache";
import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

let appOctokitInstance: Octokit | null = null;

export interface InstalledOrgInfo {
  login: string;
  avatarUrl?: string;
  htmlUrl?: string;
  accountType?: string;
}

export interface UserOrgMembership {
  login: string;
  avatarUrl?: string;
  htmlUrl: string;
  description?: string;
  role: "admin" | "member";
}

/**
 * Normalizes an organization name/URL into a plain slug.
 * e.g., "https://github.com/2026-2-WebService" -> "2026-2-WebService"
 */
export function normalizeOrgName(input?: string): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/+$/, "")
    .split("/")[0]
    .trim();
}

export function getDefaultOrgName(): string {
  return normalizeOrgName(process.env.GITHUB_ORG_NAME || "2026-2-WebService");
}

/**
 * Normalizes and formats an RSA private key into standard PEM format with 64-char lines.
 * Supports raw PEM, multi-line PEM, and base64-encoded PEM.
 */
export function formatPrivateKey(rawKey?: string): string {
  if (!rawKey) return "";

  let decoded = rawKey;
  // If base64-encoded full PEM (starts with LS0t or does not contain -----BEGIN)
  if (rawKey.startsWith("LS0t") || !rawKey.includes("-----BEGIN")) {
    try {
      const buff = Buffer.from(rawKey, "base64").toString("utf-8");
      if (buff.includes("-----BEGIN")) {
        decoded = buff;
      }
    } catch {
      // ignore
    }
  }

  // Strip existing headers, footers, whitespace, and literal escaped newlines
  const base64Body = decoded
    .replace(/-----BEGIN[^-]+-----/g, "")
    .replace(/-----END[^-]+-----/g, "")
    .replace(/\\n/g, "")
    .replace(/[\r\n\s]/g, "")
    .trim();

  if (!base64Body) return "";

  // Split into 64-character lines for OpenSSL compatibility
  const formattedLines = base64Body.match(/.{1,64}/g)?.join("\n") || base64Body;

  return `-----BEGIN RSA PRIVATE KEY-----\n${formattedLines}\n-----END RSA PRIVATE KEY-----\n`;
}

export function getAppOctokit(): Octokit {
  if (appOctokitInstance) return appOctokitInstance;

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = formatPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY);

  if (!appId || !privateKey) {
    console.warn("[GitHub App] GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is missing.");
    return new Octokit();
  }

  appOctokitInstance = new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: Number(appId),
      privateKey: privateKey,
    },
  });

  return appOctokitInstance;
}

// GitHub 조회 결과 캐시 시간 (Vercel Data Cache: 인스턴스끼리 공유)
const GITHUB_LOOKUP_TTL_SECONDS = 5 * 60; // 5분
export const INSTALLED_ORGS_TAG = "github:installed-orgs";

/** GitHub App이 설치된 org 목록을 GitHub에서 직접 조회한다 (캐시 없음) */
async function fetchInstalledOrganizations(): Promise<InstalledOrgInfo[]> {
  const app = getAppOctokit();
  const { data: installations } = await app.rest.apps.listInstallations({
    per_page: 100,
  });

  const result: InstalledOrgInfo[] = [];
  for (const inst of installations) {
    const account: any = inst.account;
    if (account?.login) {
      result.push({
        login: account.login,
        avatarUrl: account.avatar_url,
        htmlUrl: account.html_url || `https://github.com/${account.login}`,
        accountType: account.type || "Organization",
      });
    }
  }
  return result;
}

/**
 * GitHub App이 설치된 org 목록 (5분 공유 캐시).
 * forceRefresh면 캐시를 무효화하고 GitHub에서 바로 조회한다.
 */
export async function listInstalledOrganizations(
  forceRefresh = false
): Promise<InstalledOrgInfo[]> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = formatPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY);
  if (!appId || !privateKey) {
    return [];
  }

  try {
    if (forceRefresh) {
      safeRevalidateTag(INSTALLED_ORGS_TAG);
      return await fetchInstalledOrganizations();
    }
    return await cachedCall(
      ["github-installed-orgs"],
      { revalidate: GITHUB_LOOKUP_TTL_SECONDS, tags: [INSTALLED_ORGS_TAG] },
      fetchInstalledOrganizations
    );
  } catch (err: any) {
    console.warn("[listInstalledOrganizations] Could not fetch installations:", err.message);
    return [];
  }
}

/**
 * 설치 토큰 Octokit용 로거.
 * Octokit은 실패한 요청마다 "GET /path - 403 with id ... in 620ms"를 console.error로 찍는데,
 * 403/404는 호출하는 쪽에서 처리하는 예상된 결과(멤버 아님·권한 없음)라 개발 화면 에러 오버레이를 띄우지 않도록 경고로 낮춘다.
 * 그 밖의 오류는 그대로 console.error로 남긴다.
 */
const installationLog = {
  debug: () => {},
  info: () => {},
  warn: console.warn.bind(console),
  error: (message: string, ...rest: unknown[]) => {
    if (/ - 40[34] with id /.test(String(message))) {
      console.warn(`[GitHub App] ${message}`);
      return;
    }
    console.error(message, ...rest);
  },
};

/** GitHub가 rate limit 때문에 돌려준 403인지 (일시적이라 캐시하면 안 됨) */
function isRateLimitError(err: any): boolean {
  const remaining = err?.response?.headers?.["x-ratelimit-remaining"];
  return remaining === "0" || /rate limit/i.test(String(err?.message || ""));
}

export async function getInstallationOctokit(orgName?: string): Promise<Octokit> {
  const targetOrg = normalizeOrgName(orgName || process.env.GITHUB_ORG_NAME);
  const app = getAppOctokit();

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = formatPrivateKey(process.env.GITHUB_APP_PRIVATE_KEY);

  if (!appId || !privateKey || !targetOrg) {
    console.warn(`[GitHub App] Incomplete credentials or targetOrg (${targetOrg}).`);
    return new Octokit();
  }

  try {
    const { data: installation } = await app.rest.apps.getOrgInstallation({
      org: targetOrg,
    });

    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: Number(appId),
        privateKey: privateKey,
        installationId: installation.id,
      },
      log: installationLog,
    });
  } catch (error: any) {
    if (error.status === 404) {
      console.warn(
        `[GitHub App] Organization "${targetOrg}"에 GitHub App이 설치(Install)되지 않았습니다. ` +
        `GitHub App 설정 페이지 -> Install App 탭에서 "${targetOrg}" 조직에 앱을 설치해주세요.`
      );
    } else {
      console.error(`[GitHub App] Failed to get installation for org "${targetOrg}":`, error.message);
    }
    throw error;
  }
}

/**
 * Checks if a GitHub user is an Owner (admin) of the target Organization using the user's own OAuth provider token.
 * This works even if the user's membership is Private and does not depend on GitHub App private key.
 */
export async function checkIsOrgOwnerWithUserToken(
  userAccessToken: string,
  orgName?: string
): Promise<boolean> {
  const targetOrg = normalizeOrgName(orgName || process.env.GITHUB_ORG_NAME);
  if (!targetOrg || !userAccessToken) {
    return false;
  }

  try {
    const octokit = new Octokit({ auth: userAccessToken });
    const { data: membership } = await octokit.rest.orgs.getMembershipForAuthenticatedUser({
      org: targetOrg,
    });

    const isOwner = membership.state === "active" && membership.role === "admin";
    console.log(
      `[checkIsOrgOwnerWithUserToken] Org: ${targetOrg}, State: ${membership.state}, Role: ${membership.role} => Owner: ${isOwner}`
    );
    return isOwner;
  } catch (err: any) {
    if (err.status === 404) {
      console.log(`[checkIsOrgOwnerWithUserToken] Authenticated user is not a member of org "${targetOrg}".`);
    } else {
      console.warn(`[checkIsOrgOwnerWithUserToken] Could not check org membership with user token:`, err.message);
    }
    return false;
  }
}

/** 사용자의 공개 org 캐시 태그 */
export function publicOrgsTag(username: string): string {
  return `github:public-orgs:${username.trim().toLowerCase()}`;
}

/** 사용자의 org 역할 캐시 태그 */
export function orgRoleTag(username: string, orgName: string): string {
  return `github:org-role:${username.trim().toLowerCase()}:${orgName.trim().toLowerCase()}`;
}

/** 사용자의 공개 org 목록을 GitHub에서 직접 조회한다 (캐시 없음) */
async function fetchPublicOrgsForUser(username: string): Promise<UserOrgMembership[]> {
  const octokit = new Octokit();
  const { data: orgs } = await octokit.rest.orgs.listForUser({
    username,
    per_page: 100,
  });

  return orgs
    .filter((o) => Boolean(o.login))
    .map((o) => ({
      login: o.login,
      avatarUrl: o.avatar_url,
      htmlUrl: `https://github.com/${o.login}`,
      description: o.description || undefined,
      role: "member" as const,
    }));
}

/**
 * Lists public GitHub Organizations for a given username (5분 공유 캐시).
 * Helpful when OAuth token is no longer in session or user joined a new public org.
 */
export async function listPublicOrgsForUser(
  username: string,
  forceRefresh = false
): Promise<UserOrgMembership[]> {
  const cleanUser = username?.trim();
  if (!cleanUser) return [];

  try {
    if (forceRefresh) {
      safeRevalidateTag(publicOrgsTag(cleanUser));
      return await fetchPublicOrgsForUser(cleanUser);
    }
    return await cachedCall(
      ["github-public-orgs", cleanUser.toLowerCase()],
      { revalidate: GITHUB_LOOKUP_TTL_SECONDS, tags: [publicOrgsTag(cleanUser)] },
      () => fetchPublicOrgsForUser(cleanUser)
    );
  } catch (err: any) {
    console.warn("[listPublicOrgsForUser] Could not list public orgs:", err.message);
    return [];
  }
}

/**
 * Fetches details of a specific GitHub Organization by slug so a user can search & connect a new Organization.
 */
export async function fetchGitHubOrgDetails(
  orgSlug: string
): Promise<{
  login: string;
  avatarUrl?: string;
  htmlUrl: string;
  description?: string;
} | null> {
  const cleanOrg = normalizeOrgName(orgSlug);
  if (!cleanOrg) return null;

  try {
    const octokit = new Octokit();
    const { data } = await octokit.rest.orgs.get({ org: cleanOrg });
    return {
      login: data.login || cleanOrg,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url || `https://github.com/${data.login || cleanOrg}`,
      description: data.description || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Lists all GitHub Organizations where the authenticated user is an active member/admin
 * using their GitHub OAuth provider token (`read:org` scope).
 */
export async function listUserOrgMembershipsWithToken(
  userAccessToken: string
): Promise<UserOrgMembership[] | null> {
  // 조회 실패 시 null을 반환해 "org 없음([])"과 구분한다 (실패로 저장된 목록을 지우지 않도록)
  if (!userAccessToken) return null;

  try {
    const octokit = new Octokit({ auth: userAccessToken });
    const { data: memberships } =
      await octokit.rest.orgs.listMembershipsForAuthenticatedUser({
        state: "active",
        per_page: 100,
      });

    const result: UserOrgMembership[] = [];
    for (const m of memberships) {
      const org = m.organization;
      if (org?.login) {
        result.push({
          login: org.login,
          avatarUrl: org.avatar_url,
          htmlUrl: `https://github.com/${org.login}`,
          description: org.description || undefined,
          role: m.role === "admin" ? "admin" : "member",
        });
      }
    }
    return result;
  } catch (err: any) {
    console.warn(
      "[listUserOrgMembershipsWithToken] Could not list user org memberships:",
      err.message
    );
    return null;
  }
}

/**
 * Checks a GitHub user's role ("admin" | "member" | null) in a specific Organization
 * using the GitHub App Installation Token (cached for 5 minutes).
 */
export async function checkUserOrgRole(
  username: string,
  orgName?: string
): Promise<"admin" | "member" | null> {
  const targetOrg = normalizeOrgName(orgName || process.env.GITHUB_ORG_NAME);
  if (!targetOrg || !username) return null;

  try {
    return await cachedCall(
      ["github-org-role", username.toLowerCase(), targetOrg.toLowerCase()],
      { revalidate: GITHUB_LOOKUP_TTL_SECONDS, tags: [orgRoleTag(username, targetOrg)] },
      async () => {
        try {
          const octokit = await getInstallationOctokit(targetOrg);
          const { data: membership } = await octokit.rest.orgs.getMembershipForUser({
            org: targetOrg,
            username,
          });
          return membership.state === "active"
            ? membership.role === "admin"
              ? "admin"
              : "member"
            : null;
        } catch (err: any) {
          // 404(멤버 아님)는 확정 결과이므로 캐시한다.
          if (err?.status === 404) return null;
          // 403(App에 Members 읽기 권한이 없거나 조회 불가)도 Owner로 볼 수 없으므로 null로 캐시해
          // 요청마다 GitHub를 다시 부르지 않게 한다. 단 rate limit 403은 일시적이라 캐시하지 않는다.
          if (err?.status === 403 && !isRateLimitError(err)) return null;
          throw err;
        }
      }
    );
  } catch {
    return null;
  }
}

/**
 * Checks if a GitHub user is an Owner (admin) of the target Organization.
 * Uses GitHub App Installation Token with 'Members: Read-only' permission.
 */
export async function checkIsOrgOwner(username: string, orgName?: string): Promise<boolean> {
  const role = await checkUserOrgRole(username, orgName);
  return role === "admin";
}

/**
 * 로그인한 사용자의 GitHub 계정에 등록·인증된 이메일 목록(비공개 이메일 포함)을 가져온다.
 * OAuth scope `user:email`이 필요하다. 공개 프로필 검색으로는 비공개 이메일을 찾을 수 없으므로,
 * 학생이 GitRepoTrack에 로그인할 때 이 목록을 받아 두었다가 명단 CSV의 이메일과 매칭한다.
 * 실패하면 null (기존 저장값을 지우지 않도록 "이메일 없음([])"과 구분).
 */
export async function listVerifiedEmailsWithToken(
  userAccessToken: string
): Promise<string[] | null> {
  if (!userAccessToken) return null;
  try {
    const octokit = new Octokit({ auth: userAccessToken });
    const { data } = await octokit.rest.users.listEmailsForAuthenticatedUser({ per_page: 100 });
    const emails = data
      .filter((e) => e.verified && e.email)
      .map((e) => e.email.trim().toLowerCase());
    return Array.from(new Set(emails));
  } catch (err: any) {
    console.warn("[listVerifiedEmailsWithToken] Could not list user emails:", err?.status ?? "", err?.message ?? "");
    return null;
  }
}
