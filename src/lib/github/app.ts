import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";

let appOctokitInstance: Octokit | null = null;

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
    .trim();
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

/**
 * Checks if a GitHub user is an Owner (admin) of the target Organization.
 * Uses GitHub App Installation Token with 'Members: Read-only' permission.
 */
export async function checkIsOrgOwner(username: string, orgName?: string): Promise<boolean> {
  const targetOrg = normalizeOrgName(orgName || process.env.GITHUB_ORG_NAME);
  if (!targetOrg) {
    console.warn("[checkIsOrgOwner] GITHUB_ORG_NAME is not set.");
    return false;
  }

  try {
    const octokit = await getInstallationOctokit(targetOrg);
    const { data: membership } = await octokit.rest.orgs.getMembershipForUser({
      org: targetOrg,
      username: username,
    });

    const isOwner = membership.state === "active" && membership.role === "admin";
    console.log(
      `[checkIsOrgOwner] User: ${username}, Org: ${targetOrg}, State: ${membership.state}, Role: ${membership.role} => Owner: ${isOwner}`
    );
    return isOwner;
  } catch (err: any) {
    if (err.status === 404) {
      console.log(`[checkIsOrgOwner] User ${username} is not an active member of ${targetOrg} (or app not installed).`);
      return false;
    }
    console.error(`[checkIsOrgOwner] Error checking org membership for ${username} in ${targetOrg}:`, err.message);
    return false;
  }
}
