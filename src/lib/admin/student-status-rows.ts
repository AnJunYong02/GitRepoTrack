// 관리자 과제 관리 화면 "학생별 제출 현황" 표의 한 줄 계산 (DB 접근 없는 순수 함수)
// 기존 admin/assignments/[id]/page.tsx 안에 있던 규칙을 그대로 옮겼다.

/** submitted: 커밋 있음, unsubmitted: 분석됐지만 커밋 없음, pending: 아직 분석 전 */
export type SubmitState = "submitted" | "unsubmitted" | "pending";

export interface StudentStatusRow {
  id: string;
  studentNo: string | null;
  /** 이름: 학생 관리 명단 → student_repos.student_name → null */
  studentName: string | null;
  /** GitHub ID: 학생 관리 명단 → 로그인한 학생 프로필 → null */
  githubLogin: string | null;
  fullName: string;
  repoName: string;
  submitState: SubmitState;
  commitCount: number;
  /** 0이면 기준 없음 */
  minCommits: number;
  commitsMet: boolean;
  /** 0이면 README 기준이 없거나 표시할 값 없음 */
  readmeTotal: number;
  readmePassed: number;
  /** 표시할 값이 있는지 (분석 전·커밋 없음·키워드 없음이면 false → "-") */
  readmeShown: boolean;
  /** 마지막 push 시각 (ISO), 없으면 null */
  lastPushAt: string | null;
}

/** 학생 관리 명단의 한 명 (학번으로 찾은 값) */
export interface RosterEntry {
  name: string;
  githubLogin: string | null;
}

/**
 * student_repos 조회 행 1개 → 표의 한 줄
 * @param activeKeywords 현재 기준의 README 키워드 (평가 결과 details가 없을 때 개수 기준)
 * @param rosterEntry 학생 관리 명단에서 이 학번으로 찾은 값 (없으면 DB 값으로 대체)
 */
export function toStudentStatusRow(
  sr: any,
  minCommits: number,
  activeKeywords: string[],
  rosterEntry?: RosterEntry | null
): StudentStatusRow {
  const status = sr.repo_status;
  const snapshot = status?.snapshots;
  const hasSnapshot = Boolean(status?.latest_snapshot_id && snapshot);
  const evals = snapshot?.evaluations;
  const latestEval = Array.isArray(evals) ? evals[0] : evals;
  const readmeResults = latestEval?.readme_results;
  const details: { found: boolean }[] = Array.isArray(readmeResults?.details) ? readmeResults.details : [];

  const readmeTotal = details.length > 0 ? details.length : activeKeywords.length;
  const readmePassed =
    details.length > 0 ? details.filter((d) => d.found).length : readmeResults?.satisfied ? readmeTotal : 0;

  const commits: { committed_at: string }[] = Array.isArray(sr.commits) ? sr.commits : [];
  const commitCount: number = snapshot?.commit_count ?? (commits.length ? commits.length : 0);

  // 마지막 push: 실제 커밋 시각 우선, 없으면 (커밋이 있는) 스냅샷 관측 시각
  let lastPushAt: string | null = null;
  if (commits.length > 0) {
    const latest = Math.max(...commits.map((c) => new Date(c.committed_at).getTime()));
    lastPushAt = new Date(latest).toISOString();
  } else if (hasSnapshot && commitCount > 0 && snapshot?.observed_at) {
    lastPushAt = new Date(snapshot.observed_at).toISOString();
  }

  const submitState: SubmitState = commitCount > 0 ? "submitted" : hasSnapshot ? "unsubmitted" : "pending";

  return {
    id: sr.id,
    studentNo: sr.student_no || null,
    studentName: rosterEntry?.name || sr.student_name || null,
    githubLogin: rosterEntry?.githubLogin || sr.profiles?.github_login || null,
    fullName: sr.full_name,
    repoName: (sr.full_name || "").split("/").pop() || sr.full_name,
    submitState,
    commitCount,
    minCommits,
    commitsMet: minCommits > 0 ? commitCount >= minCommits : commitCount > 0,
    readmeTotal,
    readmePassed,
    readmeShown: hasSnapshot && commitCount > 0 && readmeTotal > 0,
    lastPushAt,
  };
}

/** 과제 관리 상단 요약 숫자 */
export function summarizeStatusRows(rows: Pick<StudentStatusRow, "submitState">[]) {
  const total = rows.length;
  const submitted = rows.filter((r) => r.submitState === "submitted").length;
  const pending = rows.filter((r) => r.submitState === "pending").length;
  return { total, submitted, pending, unsubmitted: Math.max(0, total - submitted - pending) };
}
