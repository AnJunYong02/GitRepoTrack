"use client";

import { useEffect, useState } from "react";
import { Timer, CheckCircle2, AlertTriangle, Clock, CircleDashed } from "lucide-react";
import {
  computeCountdown,
  formatAbsoluteKst,
  getDeadlineBadgeKind,
  DeadlineBadgeKind,
} from "@/lib/student/time-utils";

interface DeadlineCountdownProps {
  deadlineAt: string | null;
  commitDates: string[];
  isSubmitted: boolean;
}

const BADGES: Record<
  DeadlineBadgeKind,
  { text: string; className: string; Icon: typeof CheckCircle2 }
> = {
  on_time_submitted: {
    text: "기한 내 제출 완료",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300",
    Icon: CheckCircle2,
  },
  on_time_partial: {
    text: "기한 내 커밋 확인 (조건 보완 필요)",
    className:
      "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-950/60 dark:text-blue-300",
    Icon: Clock,
  },
  late: {
    text: "기한 후 커밋 (지각)",
    className:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300",
    Icon: AlertTriangle,
  },
  none: {
    text: "아직 커밋 없음 (제출 전)",
    className:
      "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300",
    Icon: CircleDashed,
  },
};

export function DeadlineCountdown({
  deadlineAt,
  commitDates,
  isSubmitted,
}: DeadlineCountdownProps) {
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
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-slate-100 dark:border-slate-800 pt-3">
      <div className="flex items-center gap-2">
        <Timer
          className={`w-5 h-5 ${
            countdown?.expired ? "text-slate-400" : "text-blue-600 dark:text-blue-400"
          }`}
        />
        <div>
          <p className="text-[11px] text-slate-500">마감까지</p>
          <p
            className={`text-lg font-bold leading-tight ${
              countdown?.expired
                ? "text-slate-400"
                : countdown && countdown.days < 1
                ? "text-red-600 dark:text-red-400"
                : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {!deadlineAt ? "마감 없음" : countdown ? countdown.label : "계산 중..."}
          </p>
        </div>
      </div>

      <div className="text-[11px] text-slate-500 space-y-0.5">
        {deadlineAt && <p>마감 일시: {formatAbsoluteKst(deadlineAt)} (KST)</p>}
        <p>마지막 커밋: {latestCommit ? `${formatAbsoluteKst(latestCommit)} (KST)` : "-"}</p>
      </div>

      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badge.className}`}
      >
        <badge.Icon className="w-3.5 h-3.5" />
        <span>{badge.text}</span>
      </span>
    </div>
  );
}
