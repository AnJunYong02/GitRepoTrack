"use client";

import { useMemo, useState } from "react";
import { ArrowDown } from "lucide-react";
import { formatKstDateTime, splitCommitMessage } from "@/lib/student/time-utils";

interface CommitTimelineProps {
  commits: { committed_at: string; message?: string | null }[];
  /** 처음 보여줄 개수 (더 보기 누를 때마다 같은 수만큼 늘어남) */
  limit?: number;
}

const KST_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });

/** "feat: add x" → { type: "feat", text: "add x" } (Conventional Commits 타입만 분리) */
const COMMIT_TYPE = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\([^)]*\))?!?:\s*(.+)$/i;
function splitCommitType(title: string): { type: string | null; text: string } {
  const m = title.match(COMMIT_TYPE);
  return m ? { type: m[1].toLowerCase(), text: m[3] } : { type: null, text: title };
}

/** 최근 커밋 이력 (가장 최근 커밋 날짜의 커밋은 초록 점) */
export function CommitTimeline({ commits, limit = 10 }: CommitTimelineProps) {
  const [shown, setShown] = useState(limit);

  const sorted = useMemo(
    () =>
      [...(commits || [])].sort((a, b) => new Date(b.committed_at).getTime() - new Date(a.committed_at).getTime()),
    [commits]
  );
  const recent = sorted.slice(0, shown);
  const latestDay = sorted[0] ? KST_DAY.format(new Date(sorted[0].committed_at)) : null;

  return (
    <section aria-label="최근 커밋 이력" className="space-y-5">
      <div className="flex items-end justify-between">
        <h2 className="text-[20px] font-bold tracking-tight text-fg">최근 커밋 이력</h2>
        <span className="text-[12px] text-fg-3">
          최근 {recent.length}개 / 총 {sorted.length}개
        </span>
      </div>

      {recent.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-[13px] text-fg-3">기록된 커밋이 없어요.</p>
      ) : (
        <ol className="space-y-[14px]">
          {recent.map((c, idx) => {
            const { title, body } = splitCommitMessage(c.message);
            const { type, text } = splitCommitType(title);
            const isLatestDay = KST_DAY.format(new Date(c.committed_at)) === latestDay;
            return (
              <li key={`${c.committed_at}-${idx}`} className="flex items-center gap-4" title={body || undefined}>
                <span
                  aria-hidden
                  className={`h-3 w-3 shrink-0 rounded-full border-2 ${isLatestDay ? "border-brand" : "border-line"}`}
                />
                <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-fg">
                  {type && <span className="mr-2 font-mono text-[12px] font-normal text-fg-3">{type}</span>}
                  {text}
                </p>
                <time dateTime={c.committed_at} className="shrink-0 text-[12px] tabular-nums text-fg-3">
                  {formatKstDateTime(c.committed_at)}
                </time>
              </li>
            );
          })}
        </ol>
      )}

      {sorted.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + limit)}
          className="inline-flex items-center gap-1 pl-7 text-[12px] text-fg-2 hover:text-fg"
        >
          이전 커밋 더 보기 <ArrowDown className="h-3 w-3" />
        </button>
      )}
    </section>
  );
}
