import "server-only";

import { getInstallationOctokit } from "@/lib/github/app";
import { loadSecretRoster, RosterNotConfiguredError } from "@/lib/roster/secret-roster";
import {
  DEFAULT_CLASS_CODE,
  buildRepoPrefix,
  buildStudentRepoName,
} from "@/lib/github/student-repo-name";
import {
  describeGitHubError,
  EmailSearchState,
  loadVerifiedEmailIndex,
  resolveStudentLogin,
} from "@/lib/github/create-student-repos";
import { mapWithConcurrency, OrgRepoSummary } from "@/lib/github/previous-repo-login";

// 학생별 GitHub ID를 찾을 때 동시에 보내는 GitHub API 요청 수
const LOOKUP_CONCURRENCY = 5;

/** org의 repo 목록 전체(이름·수정 시각·템플릿 여부 포함) */
export async function listOrgRepos(octokit: any, org: string): Promise<any[]> {
  return octokit.paginate(octokit.rest.repos.listForOrg, { org, per_page: 100 });
}

/**
 * repo 일괄 생성 미리보기.
 * 시크릿 명단 기준으로 학생별 예정 repo 이름, 이미 존재하는지, GitHub ID(와 출처)를 계산한다.
 * 호출 전에 반드시 Owner 권한을 확인해야 한다(명단 정보를 응답에 포함하므로).
 */
export async function buildProvisionPreview(org: string, prefix: string | null) {
  let roster;
  try {
    roster = await loadSecretRoster();
  } catch (err) {
    if (err instanceof RosterNotConfiguredError) {
      return { rosterConfigured: false as const, error: err.message };
    }
    throw err;
  }

  // Organization의 기존 repo 이름과 템플릿 repo 목록
  let existingNames = new Set<string>();
  let templates: string[] = [];
  let githubWarning: string | null = null;
  let octokit: any = null;
  let orgRepos: OrgRepoSummary[] = [];
  try {
    octokit = await getInstallationOctokit(org);
    const repos = await listOrgRepos(octokit, org);
    orgRepos = repos;
    existingNames = new Set(repos.map((r: any) => r.name.toLowerCase()));
    templates = repos.filter((r: any) => r.is_template).map((r: any) => r.name);
  } catch (err) {
    githubWarning = describeGitHubError(err);
  }

  // 학생별 GitHub ID: CSV 값 → 이전 과제 repo의 collaborator → 학교 이메일 검색 → 없음(이유)
  const currentRepoPrefix = prefix ? buildRepoPrefix(prefix) : null;
  const emailSearch: EmailSearchState = { rateLimited: false };
  const verifiedUsers = await loadVerifiedEmailIndex();
  const resolutions = await mapWithConcurrency(roster.students, LOOKUP_CONCURRENCY, (student) =>
    resolveStudentLogin({
      octokit,
      org,
      student,
      orgRepos,
      currentRepoPrefix,
      emailSearch,
      verifiedUsers,
    })
  );

  return {
    rosterConfigured: true as const,
    rosterSource: roster.source,
    orgName: org,
    classCode: DEFAULT_CLASS_CODE,
    prefix,
    repoPrefix: currentRepoPrefix,
    templates,
    githubWarning,
    invalidRows: roster.errors,
    students: roster.students.map((s, i) => {
      const repoName = prefix ? buildStudentRepoName(prefix, s.studentNo) : null;
      const { resolved, missingReason } = resolutions[i];
      return {
        studentNo: s.studentNo,
        name: s.name,
        githubLogin: resolved?.login ?? null,
        githubSource: resolved?.source ?? null,
        sourceRepo: resolved?.sourceRepo ?? null,
        // Owner 화면의 툴팁에만 쓰는 값 (어떤 이메일로 찾았는지)
        sourceEmail: resolved?.sourceEmail ?? null,
        missingReason: missingReason ?? null,
        repoName,
        exists: repoName ? existingNames.has(repoName.toLowerCase()) : false,
      };
    }),
  };
}
