import "server-only";

import type { Octokit } from "@octokit/rest";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { RosterStudent } from "@/lib/roster/parse-roster";
import { buildStudentRepoName } from "./student-repo-name";
import {
  findPreviousStudentRepos,
  isGitHubRateLimitError,
  matchLoginByVerifiedEmail,
  OrgRepoSummary,
  VerifiedEmailUser,
  pickInvitedStudent,
  pickStudentCollaborator,
  pickUserFromEmailSearch,
} from "./previous-repo-login";

export type CollaboratorStatus =
  | "added" // org 멤버 등: 바로 collaborator로 추가됨
  | "invited" // 초대 메일 발송 (학생이 수락해야 push 가능)
  | "skipped"; // 명단에 GitHub 아이디가 없어 건너뜀

/**
 * GitHub ID를 어디서 얻었는지
 * - csv: 명단 CSV의 GitHub 열
 * - previous-repo: 이전 과제 repo의 collaborator
 * - verified-email: RepoTrack 로그인 때 저장한 GitHub 인증 이메일과 일치 (비공개 이메일도 가능)
 * - email: GitHub 공개 이메일 검색
 */
export type GithubLoginSource = "csv" | "previous-repo" | "verified-email" | "email";

export interface ResolvedLogin {
  login: string;
  source: GithubLoginSource;
  /** source가 previous-repo일 때 참고한 repo 이름 */
  sourceRepo?: string;
  /** source가 verified-email/email일 때 일치한 이메일 */
  sourceEmail?: string;
}

/** GitHub ID 결정 결과. 못 찾았으면 이유를 함께 돌려준다 */
export interface LoginResolution {
  resolved: ResolvedLogin | null;
  missingReason?: string;
}

/** 한 번의 미리보기/생성 요청 안에서 공유하는 이메일 검색 상태 (속도 제한에 걸리면 이후 검색 중단) */
export interface EmailSearchState {
  rateLimited: boolean;
}

export const MISSING_REASONS = {
  noInfo: "이전 과제 repo·이메일 정보 없음",
  emailNotFound:
    "일치하는 GitHub 계정 없음 — 학생이 RepoTrack에 로그인하지 않았거나, 이 이메일이 GitHub 계정에 등록되지 않음",
  rateLimited: "GitHub 검색 제한 — 잠시 후 다시 미리보기",
} as const;

export interface ProvisionResult {
  studentNo: string;
  repoName: string;
  ok: boolean;
  githubLogin?: string | null;
  githubSource?: GithubLoginSource | null;
  /** repo를 새로 만들었으면 true, 이미 있어서 재사용했으면 false */
  created?: boolean;
  collaborator?: CollaboratorStatus;
  error?: string;
}

/**
 * GitHub API 오류를 Owner가 이해할 수 있는 한국어 메시지로 바꾼다.
 */
export function describeGitHubError(err: any): string {
  const status = err?.status;
  const message = String(err?.message || err || "알 수 없는 오류");
  if (status === 403 && /not accessible by integration/i.test(message)) {
    return "GitHub App에 repo 생성 권한이 없습니다. App 설정에서 'Administration: Read & write' 권한을 추가하고 Organization에서 승인해주세요.";
  }
  if (status === 404 && /user/i.test(message)) {
    return "명단의 GitHub 아이디를 GitHub에서 찾을 수 없습니다.";
  }
  if (status === 404) {
    return "Organization 또는 템플릿 repo를 찾을 수 없습니다. GitHub App이 설치되어 있는지 확인해주세요.";
  }
  return message;
}

// 학생 1명당 GitHub API 호출 수를 제한하기 위해 최근 repo 3개까지만 확인
const MAX_PREVIOUS_REPOS_TO_CHECK = 3;

/**
 * 이전 과제 repo(Owner가 학생을 직접 collaborator로 넣어 둔 repo)에서 학생 GitHub 계정을 찾는다.
 * candidateRepoNames는 findPreviousStudentRepos()로 구한 최근순 목록.
 */
export async function resolveLoginFromPreviousRepos(
  octokit: Octokit,
  org: string,
  candidateRepoNames: string[]
): Promise<ResolvedLogin | null> {
  for (const repo of candidateRepoNames.slice(0, MAX_PREVIOUS_REPOS_TO_CHECK)) {
    try {
      const { data: collaborators } = await octokit.rest.repos.listCollaborators({
        owner: org,
        repo,
        affiliation: "direct",
        per_page: 100,
      });
      const login = pickStudentCollaborator(collaborators);
      if (login) return { login, source: "previous-repo", sourceRepo: repo };

      // 학생이 아직 초대를 수락하지 않았다면 초대 목록에만 있다
      const { data: invitations } = await octokit.rest.repos.listInvitations({
        owner: org,
        repo,
        per_page: 100,
      });
      const invited = pickInvitedStudent(invitations);
      if (invited) return { login: invited, source: "previous-repo", sourceRepo: repo };
    } catch (err: any) {
      // 한 repo 조회 실패는 다음 repo로 넘어간다 (명단 내용은 로그에 남기지 않음)
      console.warn(`[resolveLoginFromPreviousRepos] ${repo}: ${err?.status ?? ""} ${err?.message ?? ""}`);
    }
  }
  return null;
}

/**
 * 학교 이메일로 GitHub 계정을 검색한다.
 * GitHub는 이메일을 공개(또는 검색 허용)한 계정만 찾을 수 있으므로, 못 찾는 경우가 많다.
 */
export async function resolveLoginByEmail(
  octokit: Octokit,
  emails: string[],
  state: EmailSearchState
): Promise<LoginResolution> {
  for (const email of emails) {
    if (state.rateLimited) {
      return { resolved: null, missingReason: MISSING_REASONS.rateLimited };
    }
    try {
      const { data } = await octokit.rest.search.users({ q: `${email} in:email`, per_page: 2 });
      const login = pickUserFromEmailSearch(data.items);
      if (login) {
        return { resolved: { login, source: "email", sourceEmail: email } };
      }
    } catch (err: any) {
      if (isGitHubRateLimitError(err)) {
        state.rateLimited = true;
        return { resolved: null, missingReason: MISSING_REASONS.rateLimited };
      }
      // 이메일 원문은 로그에 남기지 않는다
      console.warn(`[resolveLoginByEmail] search failed: ${err?.status ?? ""} ${err?.message ?? ""}`);
    }
  }
  return { resolved: null, missingReason: MISSING_REASONS.emailNotFound };
}

/**
 * RepoTrack에 로그인한 사용자들의 GitHub 인증 이메일 목록을 모은다(요청당 1회).
 * app_metadata.github_verified_emails는 로그인 callback에서 서비스 롤로만 저장되므로 위조할 수 없다.
 */
export async function loadVerifiedEmailIndex(): Promise<VerifiedEmailUser[]> {
  const usersWithEmails: { id: string; emails: string[]; fallbackLogin: string }[] = [];
  const PER_PAGE = 1000;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) throw error;
    for (const u of data.users) {
      const emails = u.app_metadata?.github_verified_emails;
      if (Array.isArray(emails) && emails.length > 0) {
        usersWithEmails.push({
          id: u.id,
          emails: emails.map((e: unknown) => String(e).toLowerCase()),
          fallbackLogin: u.user_metadata?.user_name || u.user_metadata?.preferred_username || "",
        });
      }
    }
    if (data.users.length < PER_PAGE) break;
  }
  if (usersWithEmails.length === 0) return [];

  // GitHub 아이디는 로그인 callback이 저장한 profiles.github_login을 우선 사용
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, github_login")
    .in(
      "id",
      usersWithEmails.map((u) => u.id)
    );
  const loginById = new Map((profiles || []).map((p: any) => [p.id, p.github_login as string]));

  return usersWithEmails
    .map((u) => ({
      githubLogin: loginById.get(u.id) || u.fallbackLogin,
      verifiedEmails: u.emails,
    }))
    .filter((u) => Boolean(u.githubLogin));
}

/**
 * 학생 GitHub ID 결정:
 * CSV GitHub 열 → 이전 과제 repo collaborator → RepoTrack 로그인 인증 이메일 → 공개 이메일 검색 → 없음(이유)
 * 미리보기와 실제 생성에서 같은 순서를 쓰도록 한 곳에 모은다.
 */
export async function resolveStudentLogin(params: {
  octokit: Octokit | null;
  org: string;
  student: RosterStudent;
  orgRepos: OrgRepoSummary[];
  currentRepoPrefix: string | null;
  emailSearch: EmailSearchState;
  /** loadVerifiedEmailIndex() 결과 (요청당 1회 조회해 전달) */
  verifiedUsers: VerifiedEmailUser[];
}): Promise<LoginResolution> {
  const { octokit, org, student, orgRepos, currentRepoPrefix, emailSearch, verifiedUsers } = params;

  if (student.githubLogin) {
    return { resolved: { login: student.githubLogin, source: "csv" } };
  }
  if (!octokit) {
    return { resolved: null, missingReason: "GitHub에 연결할 수 없음" };
  }

  const candidates = findPreviousStudentRepos(orgRepos, student.studentNo, currentRepoPrefix);
  if (candidates.length > 0) {
    const fromRepo = await resolveLoginFromPreviousRepos(octokit, org, candidates);
    if (fromRepo) return { resolved: fromRepo };
  }

  if (student.emails.length > 0) {
    // 비공개 이메일도 찾을 수 있는 로그인 인증 이메일을 먼저 확인 (GitHub API 호출 없음)
    const verified = matchLoginByVerifiedEmail(verifiedUsers, student.emails);
    if (verified) {
      return {
        resolved: { login: verified.login, source: "verified-email", sourceEmail: verified.email },
      };
    }
    return resolveLoginByEmail(octokit, student.emails, emailSearch);
  }

  return { resolved: null, missingReason: MISSING_REASONS.noInfo };
}

/**
 * repo를 만들거나(이미 있으면) 기존 repo를 가져온다.
 */
async function createOrGetRepo(
  octokit: Octokit,
  org: string,
  repoName: string,
  templateRepo?: string
): Promise<{ id: number; fullName: string; created: boolean }> {
  try {
    const { data } = templateRepo
      ? await octokit.rest.repos.createUsingTemplate({
          template_owner: org,
          template_repo: templateRepo,
          owner: org,
          name: repoName,
          private: true,
        })
      : await octokit.rest.repos.createInOrg({
          org,
          name: repoName,
          private: true,
          auto_init: true, // README.md + 기본 브랜치(main) 생성
        });
    return { id: data.id, fullName: data.full_name, created: true };
  } catch (err: any) {
    // 422: 같은 이름의 repo가 이미 있음 → 재실행해도 안전하도록 기존 repo를 사용
    if (err?.status === 422) {
      const { data } = await octokit.rest.repos.get({ owner: org, repo: repoName });
      return { id: data.id, fullName: data.full_name, created: false };
    }
    throw err;
  }
}

/**
 * 학생 1명의 repo를 준비한다.
 * 1) private repo 생성(또는 기존 repo 사용)
 * 2) 해당 학생 1명만 push 권한 collaborator로 등록
 * 3) 실제 GitHub 사용자 id 조회
 * 4) student_repos / repo_status 등록
 */
export async function provisionStudentRepo(params: {
  octokit: Octokit;
  org: string;
  assignmentId: string;
  assignmentPrefix: string;
  student: RosterStudent;
  templateRepo?: string;
  /** CSV에 GitHub ID가 없을 때 이전 과제 repo에서 찾는 함수 */
  resolveLogin?: () => Promise<ResolvedLogin | null>;
}): Promise<ProvisionResult> {
  const { octokit, org, assignmentId, assignmentPrefix, student, templateRepo, resolveLogin } =
    params;
  const repoName = buildStudentRepoName(assignmentPrefix, student.studentNo);

  try {
    // GitHub ID 결정: CSV 값 → 이전 과제 repo → 없음
    const resolved: ResolvedLogin | null = student.githubLogin
      ? { login: student.githubLogin, source: "csv" }
      : resolveLogin
      ? await resolveLogin()
      : null;

    const repo = await createOrGetRepo(octokit, org, repoName, templateRepo);

    let collaborator: CollaboratorStatus = "skipped";
    let githubId: number | null = null;

    if (resolved) {
      const { data: ghUser } = await octokit.rest.users.getByUsername({
        username: resolved.login,
      });
      githubId = ghUser.id;

      const res = await octokit.rest.repos.addCollaborator({
        owner: org,
        repo: repoName,
        username: ghUser.login,
        permission: "push",
      });
      // 201: 초대 생성, 204: 이미 접근 가능(org 멤버 등)하여 바로 추가됨
      collaborator = res.status === 201 ? "invited" : "added";
    }

    await upsertStudentRepoRow({
      assignmentId,
      fullName: repo.fullName,
      repoId: repo.id,
      studentNo: student.studentNo,
      studentName: student.name || null,
      githubId,
    });

    return {
      studentNo: student.studentNo,
      repoName,
      ok: true,
      created: repo.created,
      collaborator,
      githubLogin: resolved?.login ?? null,
      githubSource: resolved?.source ?? null,
    };
  } catch (err: any) {
    return {
      studentNo: student.studentNo,
      repoName,
      ok: false,
      error: describeGitHubError(err),
    };
  }
}

/**
 * student_repos 행을 만들거나 갱신한다.
 * 예전 import로 같은 repo가 (학번을 대신 쓴 가짜 github_id로) 이미 등록돼 있을 수 있으므로
 * full_name이 같은 행이 있으면 그 행을 갱신해 중복을 만들지 않는다.
 */
async function upsertStudentRepoRow(row: {
  assignmentId: string;
  fullName: string;
  repoId: number;
  studentNo: string;
  studentName: string | null;
  githubId: number | null;
}) {
  // GitHub 아이디가 없으면 기존 import 방식처럼 학번을 고유 id 대용으로 사용
  const githubId = row.githubId ?? Number(row.studentNo);

  let profileId: string | null = null;
  if (row.githubId) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("github_id", row.githubId)
      .maybeSingle();
    profileId = profile?.id ?? null;
  }

  const values: Record<string, any> = {
    assignment_id: row.assignmentId,
    full_name: row.fullName,
    repo_id: row.repoId,
    student_no: row.studentNo,
    github_id: githubId,
  };
  if (row.studentName) values.student_name = row.studentName;
  if (profileId) values.profile_id = profileId;

  const { data: existing } = await supabaseAdmin
    .from("student_repos")
    .select("id")
    .eq("assignment_id", row.assignmentId)
    .ilike("full_name", row.fullName)
    .maybeSingle();

  let studentRepoId: string;
  if (existing) {
    const { error } = await supabaseAdmin
      .from("student_repos")
      .update(values)
      .eq("id", existing.id);
    if (error) throw error;
    studentRepoId = existing.id;
  } else {
    const { data, error } = await supabaseAdmin
      .from("student_repos")
      .upsert(values, { onConflict: "assignment_id,github_id" })
      .select("id")
      .single();
    if (error || !data) throw error || new Error("student_repos 등록 실패");
    studentRepoId = data.id;
  }

  await supabaseAdmin.from("repo_status").upsert({
    student_repo_id: studentRepoId,
    stale: true,
    updated_at: new Date().toISOString(),
  });
}
