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
    <div className="neu-hover rounded-[28px] bg-surface p-6 shadow-neu space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">최근 커밋 이력</h3>
        <span className="text-xs text-muted">
          최근 {recent.length}개 / 총 {commits?.length || 0}개
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="rounded-2xl p-6 text-center text-xs text-muted shadow-neu-inset">
          기록된 커밋 내역이 없습니다.
        </div>
      ) : (
        <ol className="max-h-[420px] overflow-y-auto pr-1">
          {recent.map((c, idx) => {
            const { title, body } = splitCommitMessage(c.message);
            const relative = nowMs !== null ? formatRelativeTime(c.committed_at, nowMs) : null;
            return (
              <li key={`${c.committed_at}-${idx}`} className="relative space-y-0.5 pb-4 pl-9 last:pb-0">
                {/* 세로 선 (마지막 항목은 생략) */}
                {idx < recent.length - 1 && (
                  <span className="absolute left-[11px] top-6 bottom-0 w-px bg-muted/25" aria-hidden />
                )}
                <span className="absolute left-0 top-0 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-lilac">
                  <GitCommit className="w-3 h-3 text-lilac-ink" />
                </span>
                <p className="text-xs font-medium text-ink break-words">
                  {title}
                </p>
                {body && (
                  <p className="text-[11px] text-muted whitespace-pre-line line-clamp-2 break-words">
                    {body}
                  </p>
                )}
                <p className="text-[11px] text-muted font-mono">
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
