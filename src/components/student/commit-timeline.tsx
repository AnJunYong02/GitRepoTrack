"use client";

import { useEffect, useMemo, useState } from "react";
import { GitCommit } from "lucide-react";
import {
  formatAbsoluteKst,
  formatRelativeTime,
  splitCommitMessage,
} from "@/lib/student/time-utils";

interface CommitTimelineProps {
  commits: { committed_at: string; message?: string | null }[];
  limit?: number;
}

export function CommitTimeline({ commits, limit = 10 }: CommitTimelineProps) {
  // 상대 시간은 마운트 이후에만 계산 (SSR/CSR hydration 불일치 방지)
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const recent = useMemo(
    () =>
      [...(commits || [])]
        .sort(
          (a, b) =>
            new Date(b.committed_at).getTime() - new Date(a.committed_at).getTime()
        )
        .slice(0, limit),
    [commits, limit]
  );

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">최근 커밋 이력</h3>
        <span className="text-xs text-slate-500">
          최근 {recent.length}개 / 총 {commits?.length || 0}개
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center text-xs text-slate-400">
          기록된 커밋 내역이 없습니다.
        </div>
      ) : (
        <ol className="relative space-y-3 border-l border-slate-200 dark:border-slate-700 ml-2 max-h-[420px] overflow-y-auto pr-1">
          {recent.map((c, idx) => {
            const { title, body } = splitCommitMessage(c.message);
            const relative = nowMs !== null ? formatRelativeTime(c.committed_at, nowMs) : null;
            return (
              <li key={`${c.committed_at}-${idx}`} className="ml-4 space-y-0.5">
                <span className="absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white dark:bg-slate-900 ring-1 ring-slate-300 dark:ring-slate-600">
                  <GitCommit className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                </span>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 break-words">
                  {title}
                </p>
                {body && (
                  <p className="text-[11px] text-slate-500 whitespace-pre-line line-clamp-2 break-words">
                    {body}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 font-mono">
                  {relative ? `${relative} · ` : ""}
                  {formatAbsoluteKst(c.committed_at)}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
