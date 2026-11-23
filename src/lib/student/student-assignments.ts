// 학생 화면(메인 대시보드·내 과제·분석 대시보드 사이드바) 공통 표시 데이터 계산
// DB 접근 없는 순수 함수만 둔다. 조회는 load-student-assignments.ts 담당.
import { parseRepoName } from "@/lib/github/repo-parser";

export interface StudentRepoItemData {
  id: string;
  fullName: string;
  assignmentId: string | null;
  assignmentTitle: string;
  /** 주차 번호 (repo 이름 assign12 → 12, 없으면 제목의 "N주차", 그래도 없으면 null) */
  weekNo: number | null;
  branch: string;
  rankingMode: "live" | "none";
  deadlineFormatted: string | null;
  deadlineAt: string | null; // ISO 원본
  hasSnapshot: boolean;
  hasPushed: boolean;
  isSubmitted: boolean;
  isLateSubmission: boolean;
  isPastDeadlineUnpushed: boolean;
  unmetSummary: string;
  minCommits: number;
  commitCount: number;
  commitShortfall: number;
  isCommitsSatisfied: boolean;
  totalKeywords: number;
  passedKeywordsCount: number;
  missingKeywordsCount: number;
  missingKeywords: string[];
  isReadmeSatisfied: boolean;
  isStale: boolean;
  latestCommitAt: string | null;
}

/** 타임라인 "공개 전" 칸: 같은 org에서 마감 전이지만 내 repo가 아직 없는 과제 */
export interface UpcomingAssignment {
  id: string;
  title: string;
  weekNo: number | null;
  deadlineAt: string;
}

export interface StudentStatusCounts {
  satisfied: number;
  unmet: number;
  pending: number;
}

/** 과제 상태 3분류: 충족 / 보완 필요(분석됐지만 미충족) / 분석 필요 */
export type ItemStatus = "satisfied" | "unmet" | "pending";

export function getItemStatus(item: Pick<StudentRepoItemData, "hasSnapshot" | "isSubmitted">): ItemStatus {
  if (!item.hasSnapshot) return "pending";
  return item.isSubmitted ? "satisfied" : "unmet";
}

/** repo 이름(assign12-…) 또는 과제 제목("12주차")에서 주차 번호 추출 */
export function extractWeekNo(fullName: string | null | undefined, title?: string | null): number | null {
  const name = (fullName || "").split("/").pop() || "";
  if (name) {
    const parsed = parseRepoName({ id: 0, name, full_name: fullName || name });
    const m = parsed.category.match(/^assign(\d+)/);
    if (m) return Number(m[1]);
  }
  // 제목: "12주차" → "assign12" → "12차" 순서로 찾음 (예: "과제 12차 (assign12)")
  const text = title || "";
  const t =
    text.match(/(\d+)\s*주차/) ||
    text.match(/assign(?:ment)?[_-]?0*(\d+)/i) ||
    text.match(/(\d+)\s*차/);
  return t ? Number(t[1]) : null;
}

/** 화면 제목: "12주차 과제" (주차를 모르면 과제 제목 그대로) */
export function weekTitle(weekNo: number | null, fallback: string): string {
  return weekNo !== null ? `${weekNo}주차 과제` : fallback;
}

export function belongsToOrg(sr: any, activeOrg: string): boolean {
  const target = activeOrg.toLowerCase();
  const assignmentOrg = (sr.assignments?.org_name || "").toLowerCase();
  if (assignmentOrg && assignmentOrg === target) return true;
  const fullName = (sr.full_name || "").toLowerCase();
  return fullName.startsWith(`${target}/`);
}

/** 최신 과제 먼저 (assign10 → assign09 → assign08_midterm → … → assign01) */
export function sortReposNewestFirst<T extends { full_name?: string; repo_id?: number }>(repos: T[]): T[] {
  return [...repos].sort((a, b) => {
    const nameA = (a.full_name || "").split("/").pop() || a.full_name || "";
    const nameB = (b.full_name || "").split("/").pop() || b.full_name || "";
    const pa = parseRepoName({ id: a.repo_id || 0, name: nameA, full_name: a.full_name || "" });
    const pb = parseRepoName({ id: b.repo_id || 0, name: nameB, full_name: b.full_name || "" });
    return pb.category.localeCompare(pa.category);
  });
}

/** student_repos 조회 행 1개 → 화면 표시 데이터 (기존 dashboard/page.tsx 규칙 그대로) */
export function toStudentRepoItem(sr: any): StudentRepoItemData {
  const assignment = sr.assignments;
  const status = sr.repo_status;
  const snapshot = status?.snapshots;
  const hasSnapshot = Boolean(status?.latest_snapshot_id && snapshot);
  const evals = snapshot?.evaluations;
  const latestEval = Array.isArray(evals) ? evals[0] : evals;

  // 기준
  const rules = assignment?.criteria_versions?.rules || {};
  const minCommits = typeof rules.minCommits === "number" ? rules.minCommits : 0;
  const configuredKeywords: string[] = Array.isArray(rules.readme?.headerKeywords)
    ? rules.readme.headerKeywords
    : Array.isArray(rules.readmeKeywords)
    ? rules.readmeKeywords
    : [];
  const totalKeywords = configuredKeywords.length;

  // 커밋
  const commitCount = snapshot?.commit_count ?? 0;
  const hasPushed = hasSnapshot && commitCount > 0;
  const targetCommits = minCommits > 0 ? minCommits : 1;
  const commitShortfall = Math.max(0, targetCommits - commitCount);
  const isCommitsSatisfied = hasPushed && commitCount >= targetCommits;

  // README 키워드
  const readmeResults = latestEval?.readme_results;
  const readmeDetails: { keyword: string; found: boolean }[] = Array.isArray(readmeResults?.details)
    ? readmeResults.details
    : [];
  const passedKeywordsCount = readmeDetails.filter((d) => d.found).length;
  const missingKeywordsCount =
    totalKeywords > 0 ? Math.max(0, totalKeywords - passedKeywordsCount) : readmeResults?.satisfied ? 0 : 1;
  const isReadmeSatisfied = hasSnapshot && Boolean(readmeResults?.satisfied);

  // 마감·지각
  const deadline = assignment?.deadline_at ? new Date(assignment.deadline_at) : null;
  const commitsList: { committed_at: string }[] = Array.isArray(sr.commits) ? sr.commits : [];
  const latestCommitMs =
    commitsList.length > 0 ? Math.max(...commitsList.map((c) => new Date(c.committed_at).getTime())) : null;
  const nowMs = Date.now();

  const isLateSubmission =
    Boolean(deadline) && hasPushed && latestCommitMs !== null && latestCommitMs > deadline!.getTime();
  const isPastDeadlineUnpushed = Boolean(deadline) && !hasPushed && nowMs > deadline!.getTime();

  const isSubmitted = hasPushed && isCommitsSatisfied && isReadmeSatisfied;

  const unmetReasons: string[] = [];
  if (hasSnapshot) {
    if (!hasPushed) unmetReasons.push("커밋 없음");
    else if (!isCommitsSatisfied) unmetReasons.push(`커밋 ${commitShortfall}개 부족`);
    if (!isReadmeSatisfied) {
      unmetReasons.push(totalKeywords > 0 ? `키워드 ${missingKeywordsCount}개 부족` : "README 누락");
    }
  }

  return {
    id: sr.id,
    fullName: sr.full_name,
    assignmentId: assignment?.id || null,
    assignmentTitle: assignment?.title || "과제",
    weekNo: extractWeekNo(sr.full_name, assignment?.title),
    branch: assignment?.branch || "main",
    rankingMode: assignment?.ranking_mode === "none" ? "none" : "live",
    deadlineFormatted: deadline ? deadline.toLocaleString("ko-KR") : null,
    deadlineAt: assignment?.deadline_at ?? null,
    hasSnapshot,
    hasPushed,
    isSubmitted,
    isLateSubmission,
    isPastDeadlineUnpushed,
    unmetSummary: unmetReasons.join(" · ") || "조건 미충족",
    minCommits,
    commitCount,
    commitShortfall,
    isCommitsSatisfied,
    totalKeywords,
    passedKeywordsCount,
    missingKeywordsCount,
    missingKeywords: readmeDetails.filter((d) => !d.found).map((d) => d.keyword),
    isReadmeSatisfied,
    isStale: Boolean(status?.stale),
    latestCommitAt: latestCommitMs !== null ? new Date(latestCommitMs).toISOString() : null,
  };
}

export function countStatuses(items: Pick<StudentRepoItemData, "hasSnapshot" | "isSubmitted">[]): StudentStatusCounts {
  const counts: StudentStatusCounts = { satisfied: 0, unmet: 0, pending: 0 };
  for (const item of items) counts[getItemStatus(item)] += 1;
  return counts;
}

/**
 * 이번 주 과제: 마감이 아직 안 지난 과제 중 마감이 가장 가까운 것.
 * 모두 지났거나 마감이 없으면 목록 첫 번째(가장 최신 과제).
 */
export function pickCurrentItem<T extends Pick<StudentRepoItemData, "deadlineAt">>(
  items: T[],
  nowMs: number
): T | null {
  let best: T | null = null;
  let bestMs = Infinity;
  for (const item of items) {
    const ms = item.deadlineAt ? new Date(item.deadlineAt).getTime() : NaN;
    if (Number.isFinite(ms) && ms >= nowMs && ms < bestMs) {
      best = item;
      bestMs = ms;
    }
  }
  return best ?? items[0] ?? null;
}

/** 사이드바 "순위표" 링크: 이번 주 과제의 순위표 (순위표 비활성 과제면 null) */
export function leaderboardHrefFor(
  item: Pick<StudentRepoItemData, "assignmentId" | "rankingMode"> | null | undefined
): string | null {
  if (!item?.assignmentId || item.rankingMode === "none") return null;
  return `/assignments/${item.assignmentId}/leaderboard`;
}

/**
 * 마감 표시 상태 (조건 충족 여부와 별개로 "마지막 커밋이 마감 전인지"만 본다)
 * onTime: 기한 내 커밋 있음, late: 마감 후 커밋, missing: 마감 지났는데 커밋 없음,
 * open: 마감 전 · 아직 커밋 없음, none: 마감 미설정
 */
export type DeadlineMark = "onTime" | "late" | "missing" | "open" | "none";

export function getDeadlineMark(
  item: Pick<StudentRepoItemData, "deadlineAt" | "hasPushed" | "isLateSubmission">,
  nowMs: number
): DeadlineMark {
  const ms = item.deadlineAt ? new Date(item.deadlineAt).getTime() : NaN;
  if (!Number.isFinite(ms)) return "none";
  if (item.isLateSubmission) return "late";
  if (item.hasPushed) return "onTime";
  return nowMs > ms ? "missing" : "open";
}
