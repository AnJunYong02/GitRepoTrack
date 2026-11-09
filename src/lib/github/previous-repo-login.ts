/**
 * 학생 명단 CSV에 GitHub ID가 없을 때, Owner가 이전 과제 repo(`assign09-c01-<학번>`)에
 * 직접 넣어 둔 collaborator로 학생의 GitHub 계정을 알아내기 위한 순수 함수들.
 */
import { parseRepoName } from "./repo-parser";
import { DEFAULT_CLASS_CODE } from "./student-repo-name";

export interface OrgRepoSummary {
  name: string;
  updated_at?: string | null;
  pushed_at?: string | null;
}

export interface CollaboratorSummary {
  login: string;
  type?: string;
  permissions?: { admin?: boolean } | null;
}

/**
 * org repo 목록에서 같은 학번·같은 분반의 "이전 과제" repo 이름을 최근 활동순으로 반환한다.
 * currentRepoPrefix(`assign10-c01`)로 시작하는 이번 과제 repo는 제외한다.
 */
export function findPreviousStudentRepos(
  repos: OrgRepoSummary[],
  studentNo: string,
  currentRepoPrefix?: string | null,
  classCode: string = DEFAULT_CLASS_CODE
): string[] {
  const currentPrefix = currentRepoPrefix ? `${currentRepoPrefix.toLowerCase()}-` : null;

  const activityTime = (r: OrgRepoSummary) =>
    new Date(r.pushed_at || r.updated_at || 0).getTime() || 0;

  return repos
    .filter((repo) => {
      if (currentPrefix && repo.name.toLowerCase().startsWith(currentPrefix)) return false;
      const parsed = parseRepoName({ id: 0, name: repo.name, full_name: repo.name });
      return (
        parsed.studentNo === studentNo &&
        (parsed.classCode || "").toLowerCase() === classCode.toLowerCase()
      );
    })
    .sort((a, b) => activityTime(b) - activityTime(a))
    .map((repo) => repo.name);
}

function isBot(login: string, type?: string): boolean {
  return type === "Bot" || login.toLowerCase().endsWith("[bot]");
}

/**
 * repo에 직접 추가된 collaborator 중 학생 1명을 고른다.
 * admin 권한(Owner, 조교)과 봇은 제외하고, 남은 계정이 정확히 1명일 때만 반환한다.
 * 0명이거나 2명 이상이면 잘못 추가하지 않도록 null.
 */
export function pickStudentCollaborator(collaborators: CollaboratorSummary[]): string | null {
  const candidates = collaborators.filter(
    (c) => c.login && !c.permissions?.admin && !isBot(c.login, c.type)
  );
  return candidates.length === 1 ? candidates[0].login : null;
}

/**
 * 아직 수락하지 않은 초대 목록에서 학생 1명을 고른다(초대받은 계정이 정확히 1명일 때만).
 */
export function pickInvitedStudent(
  invitations: { invitee?: { login: string; type?: string } | null }[]
): string | null {
  const invitees = invitations
    .map((inv) => inv.invitee)
    .filter((u): u is { login: string; type?: string } => Boolean(u?.login))
    .filter((u) => !isBot(u.login, u.type));
  return invitees.length === 1 ? invitees[0].login : null;
}

/**
 * 동시 실행 개수를 제한해 비동기 작업을 처리한다(GitHub API 속도 제한·Vercel 실행 시간 대비).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * 이메일 검색(search.users "<email> in:email") 결과에서 학생 계정을 고른다.
 * 결과가 정확히 1명일 때만 반환한다(여러 명이면 잘못 추가하지 않도록 null).
 */
export function pickUserFromEmailSearch(
  items: { login: string; type?: string }[]
): string | null {
  const users = items.filter((u) => u.login && !isBot(u.login, u.type));
  return users.length === 1 ? users[0].login : null;
}

/**
 * GitHub API 속도 제한 오류인지 판별한다(검색 API는 분당 30회 제한).
 */
export function isGitHubRateLimitError(err: any): boolean {
  const status = err?.status;
  if (status === 429) return true;
  if (status !== 403) return false;
  const remaining = err?.response?.headers?.["x-ratelimit-remaining"];
  return remaining === "0" || /rate limit/i.test(String(err?.message || ""));
}

export interface VerifiedEmailUser {
  githubLogin: string;
  /** GitHub가 인증한 이메일 (소문자) */
  verifiedEmails: string[];
}

/**
 * 명단 CSV 이메일과 GitRepoTrack 로그인 때 저장한 "GitHub 인증 이메일"을 비교해 학생 계정을 고른다.
 * 일치하는 사용자가 정확히 1명일 때만 반환한다(대소문자 무시).
 */
export function matchLoginByVerifiedEmail(
  users: VerifiedEmailUser[],
  emails: string[]
): { login: string; email: string } | null {
  const wanted = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return null;

  const matches = new Map<string, string>(); // login(소문자) -> 일치한 이메일
  const logins = new Map<string, string>(); // login(소문자) -> 원래 표기
  for (const user of users) {
    if (!user.githubLogin) continue;
    const owned = new Set(user.verifiedEmails.map((e) => e.trim().toLowerCase()));
    const hit = wanted.find((e) => owned.has(e));
    if (hit) {
      const key = user.githubLogin.toLowerCase();
      matches.set(key, hit);
      logins.set(key, user.githubLogin);
    }
  }

  if (matches.size !== 1) return null;
  const [key, email] = Array.from(matches.entries())[0];
  return { login: logins.get(key) as string, email };
}
