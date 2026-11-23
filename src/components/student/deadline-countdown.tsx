"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Timer } from "lucide-react";
import {
  computeCountdown,
  formatKstDateTime,
  getDeadlineBadgeKind,
  DeadlineBadgeKind,
} from "@/lib/student/time-utils";

interface DeadlineCountdownProps {
  deadlineAt: string | null;
  commitDates: string[];
  isSubmitted: boolean;
}

const BADGES: Record<DeadlineBadgeKind, { text: string; className: string; Icon: typeof CheckCircle2 }> = {
  on_time_submitted: { text: "기한 내 제출 완료", className: "text-brand", Icon: CheckCircle2 },
  on_time_partial: { text: "기한 내 커밋 · 조건 보완 필요", className: "text-danger", Icon: Timer },
  late: { text: "기한 후 커밋 (지각)", className: "text-danger", Icon: AlertTriangle },
  none: { text: "아직 커밋 없음", className: "text-fg-3", Icon: CircleDashed },
};

/** 제출 요약의 "마감 준수" 칸: 마감 · 마지막 커밋 시각 비교 + 상태 + 남은 시간 */
export function DeadlineCountdown({ deadlineAt, commitDates, isSubmitted }: DeadlineCountdownProps) {
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 30 * 1000);
    return () => clearInterval(timer);
  }, []);

  const kind = getDeadlineBadgeKind({ deadlineIso: deadlineAt, commitDates, isSubmitted });
  const badge = BADGES[kind];
  const countdown = deadlineAt && nowMs !== null ? computeCountdown(deadlineAt, nowMs) : null;

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

      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
        <span className={`inline-flex items-center gap-1 font-semibold ${badge.className}`}>
          <badge.Icon className="h-3.5 w-3.5" />
          {badge.text}
        </span>
        {deadlineAt && (
          <strong
            className={`font-semibold ${
              countdown && !countdown.expired && countdown.days < 1 ? "text-danger" : "text-fg"
            }`}
          >
            {countdown ? countdown.label : "계산 중..."}
          </strong>
        )}
      </p>
    </div>
  );
}
