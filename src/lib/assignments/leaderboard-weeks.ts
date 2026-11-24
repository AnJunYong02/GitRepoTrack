// 순위표 주차 드롭다운 옵션 계산 (DB 접근 없는 순수 함수)
import { formatAssignmentTitle } from "@/lib/admin/assignment-title";
import { extractWeekNo } from "@/lib/student/student-assignments";

export interface LeaderboardAssignmentRow {
  id: string;
  title: string | null;
  deadline_at?: string | null;
  ranking_mode?: string | null;
}

export interface WeekOption {
  id: string;
  label: string;
  weekNo: number | null;
  isMidterm: boolean;
}

/**
 * org의 과제 목록 → 드롭다운 옵션.
 * - Owner가 아니면 순위표가 비활성화(ranking_mode=none)된 과제는 제외
 * - 주차 번호가 큰(최신) 순, 주차를 모르는 과제는 마감일 최신순으로 뒤에 배치
 */
export function buildWeekOptions(
  assignments: LeaderboardAssignmentRow[],
  { isOwner }: { isOwner: boolean }
): WeekOption[] {
  return assignments
    .filter((a) => isOwner || a.ranking_mode !== "none")
    .map((a) => {
      const view = formatAssignmentTitle(a.title);
      return {
        option: {
          id: a.id,
          label: view.isMidterm ? `${view.label} (중간고사)` : view.label,
          weekNo: extractWeekNo(null, a.title),
          isMidterm: view.isMidterm,
        } satisfies WeekOption,
        deadlineMs: a.deadline_at ? new Date(a.deadline_at).getTime() : 0,
      };
    })
    .sort((a, b) => {
      const wa = a.option.weekNo;
      const wb = b.option.weekNo;
      if (wa !== null && wb !== null) return wb - wa;
      if (wa !== null) return -1;
      if (wb !== null) return 1;
      return b.deadlineMs - a.deadlineMs;
    })
    .map((x) => x.option);
}
