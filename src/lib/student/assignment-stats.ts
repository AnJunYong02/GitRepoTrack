// 학생 대시보드 "이번주 과제 / 직전 과제" 카드용 통계 계산 (순수 함수, DB 접근 없음)

export interface StatsSourceRepo {
  hasSnapshot: boolean;
  hasPushed: boolean;
  isSubmitted: boolean;
  isLateSubmission: boolean;
  isPastDeadlineUnpushed: boolean;
  minCommits: number;
  commitCount: number;
  isCommitsSatisfied: boolean;
  totalKeywords: number;
  passedKeywordsCount: number;
  isReadmeSatisfied: boolean;
  missingKeywords: string[];
  deadlineAt: string | null;
}

/** none: 마감 없음, open: 진행 중, onTime: 기한 내 제출, late: 지각 제출, overdue: 기한 경과 미제출 */
export type DeadlineState = "none" | "open" | "onTime" | "late" | "overdue";

export interface AssignmentStats {
  analyzed: boolean;
  commit: {
    current: number;
    target: number;
    percent: number;
    shortfall: number;
    satisfied: boolean;
  };
  readme: {
    passed: number;
    total: number;
    percent: number;
    missing: string[];
    satisfied: boolean;
  };
  deadline: {
    at: string | null;
    daysLeft: number | null;
    state: DeadlineState;
  };
}

const DAY_MS = 86_400_000;

function toPercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

export function buildAssignmentStats(item: StatsSourceRepo, nowMs: number): AssignmentStats {
  // 커밋: 기준이 0이면 최소 1개 (dashboard/page.tsx의 targetCommits 규칙과 동일)
  const target = item.minCommits > 0 ? item.minCommits : 1;
  const current = item.commitCount;

  // README: 키워드 기준이 없으면 README 존재 여부로 0/100%
  const total = item.totalKeywords;
  const passed = item.passedKeywordsCount;
  const readmePercent = total > 0 ? toPercent(passed, total) : item.isReadmeSatisfied ? 100 : 0;

  // 마감 상태
  const deadlineMs = item.deadlineAt ? new Date(item.deadlineAt).getTime() : NaN;
  const hasDeadline = Number.isFinite(deadlineMs);
  let state: DeadlineState = "none";
  if (hasDeadline) {
    if (item.isLateSubmission) state = "late";
    else if (item.isSubmitted) state = "onTime";
    else if (nowMs > deadlineMs) state = "overdue";
    else state = "open";
  }

  return {
    analyzed: item.hasSnapshot,
    commit: {
      current,
      target,
      percent: toPercent(current, target),
      shortfall: Math.max(0, target - current),
      satisfied: item.isCommitsSatisfied,
    },
    readme: {
      passed,
      total,
      percent: readmePercent,
      missing: item.missingKeywords,
      satisfied: item.isReadmeSatisfied,
    },
    deadline: {
      at: hasDeadline ? item.deadlineAt : null,
      daysLeft: hasDeadline ? Math.ceil((deadlineMs - nowMs) / DAY_MS) : null,
      state,
    },
  };
}
