import { formatKstDateTime } from "@/lib/student/time-utils";

interface DeadlineCountdownProps {
  deadlineAt: string | null;
  commitDates: string[];
}

/** 제출 요약의 "마감 준수" 칸: 마감 시각과 마지막 커밋 시각을 나란히 비교 */
export function DeadlineCountdown({ deadlineAt, commitDates }: DeadlineCountdownProps) {
  const latestCommit =
    commitDates.length > 0
      ? commitDates.reduce((a, b) => (new Date(a).getTime() > new Date(b).getTime() ? a : b))
      : null;

  return (
    <div className="space-y-5" aria-label="마감 준수">
      <h2 className="text-[18px] font-bold text-fg">마감 준수</h2>

      <dl className="space-y-1.5 text-[14px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[13px] text-fg-3">마감</dt>
          <dd className="font-semibold text-fg">{deadlineAt ? formatKstDateTime(deadlineAt) : "마감 없음"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-[13px] text-fg-3">마지막 커밋</dt>
          <dd className="font-semibold text-fg">{latestCommit ? formatKstDateTime(latestCommit) : "-"}</dd>
        </div>
      </dl>
    </div>
  );
}
