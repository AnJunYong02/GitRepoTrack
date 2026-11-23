import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  getItemStatus,
  type ItemStatus,
  type StudentRepoItemData,
  type StudentStatusCounts,
  type UpcomingAssignment,
} from "@/lib/student/student-assignments";
import { formatKstMonthDay } from "@/lib/student/time-utils";

const MAX_COLUMNS = 6;

type TimelineEntry =
  | { kind: "repo"; key: string; item: StudentRepoItemData; status: ItemStatus; deadlineAt: string | null; weekNo: number | null; title: string }
  | { kind: "upcoming"; key: string; deadlineAt: string; weekNo: number | null; title: string };

const DOT: Record<ItemStatus, string> = {
  satisfied: "bg-brand",
  unmet: "bg-danger",
  pending: "bg-fg-3",
};
const RING: Record<ItemStatus, string> = {
  satisfied: "border-brand ring-brand/15",
  unmet: "border-danger ring-danger/15",
  pending: "border-fg-3 ring-fg-3/15",
};

const BTN = "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition";

function deadlineMs(iso: string | null): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/** 메인 대시보드 하단: 주차별 과제를 왼쪽(과거) → 오른쪽(미래)으로 */
export function AssignmentTimeline({
  items,
  upcoming,
  currentId,
  counts,
}: {
  items: StudentRepoItemData[];
  upcoming: UpcomingAssignment[];
  currentId: string | null;
  counts: StudentStatusCounts;
}) {
  const entries: TimelineEntry[] = [
    ...items.map((item) => ({
      kind: "repo" as const,
      key: item.id,
      item,
      status: getItemStatus(item),
      deadlineAt: item.deadlineAt,
      weekNo: item.weekNo,
      title: item.assignmentTitle,
    })),
    ...upcoming.map((a) => ({ kind: "upcoming" as const, key: `up-${a.id}`, deadlineAt: a.deadlineAt, weekNo: a.weekNo, title: a.title })),
  ].sort((a, b) => deadlineMs(a.deadlineAt) - deadlineMs(b.deadlineAt));

  // 이번 주 과제 + 다음 1칸이 보이도록 최근 6칸
  const currentIdx = entries.findIndex((e) => e.key === currentId);
  const end = currentIdx >= 0 ? Math.min(entries.length, currentIdx + 2) : entries.length;
  const visible = entries.slice(Math.max(0, end - MAX_COLUMNS), end);
  const visibleCurrentIdx = visible.findIndex((e) => e.key === currentId);

  const total = items.length;

  return (
    <section aria-label="과제 타임라인" className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[20px] font-bold tracking-tight text-fg">과제 타임라인</h2>
        <p className="text-[13px] text-fg-3">
          {total}개 중 {counts.satisfied}개 충족
          {counts.unmet > 0 && ` · ${counts.unmet}개 보완 필요`}
          {counts.pending > 0 && ` · ${counts.pending}개 분석 필요`}
        </p>
      </div>

      <ol className="grid auto-cols-[minmax(150px,1fr)] grid-flow-col overflow-x-auto pb-2">
        {visible.map((entry, idx) => {
          const isCurrent = idx === visibleCurrentIdx;
          const lineDone = visibleCurrentIdx >= 0 ? idx < visibleCurrentIdx : entry.kind === "repo";
          const label = entry.weekNo !== null ? `${entry.weekNo}주차` : entry.title;
          return (
            <li key={entry.key} className="relative pr-4">
              {/* 다음 칸까지 이어지는 선 */}
              <span
                aria-hidden
                className={`absolute left-[10px] top-[9px] h-[2px] ${
                  idx === visible.length - 1 ? "right-0" : "right-[-10px]"
                } ${lineDone ? "bg-brand" : "bg-line"}`}
              />
              {/* 점 */}
              <span className="relative z-10 flex h-5 w-5 items-center justify-center">
                {entry.kind === "upcoming" ? (
                  <span className="h-3 w-3 rounded-full bg-line" />
                ) : isCurrent ? (
                  <span className={`h-5 w-5 rounded-full border-[4px] bg-canvas ring-[5px] ${RING[entry.status]}`} />
                ) : (
                  <span className={`h-3 w-3 rounded-full ${DOT[entry.status]}`} />
                )}
              </span>

              <p className="mt-5 truncate text-[15px] font-bold text-fg" title={entry.title}>
                {label}
                {isCurrent && " · 이번 주"}
              </p>
              <p className="mt-1 text-[12px] text-fg-3">
                {entry.deadlineAt ? `${formatKstMonthDay(entry.deadlineAt)} 마감` : "마감 미정"}
              </p>

              <div className="mt-4">
                {entry.kind === "upcoming" ? (
                  <span className="inline-block py-1.5 text-[12px] text-fg-3">공개 전</span>
                ) : isCurrent ? (
                  <Link href={`/dashboard/${entry.item.id}`} className={`${BTN} bg-brand text-white hover:brightness-110`}>
                    대시보드 <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : entry.status === "unmet" ? (
                  <Link href={`/dashboard/${entry.item.id}`} className={`${BTN} bg-danger-soft text-danger hover:brightness-95`}>
                    보완하러 가기 <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : (
                  <Link href={`/dashboard/${entry.item.id}`} className={`${BTN} bg-chip text-fg-2 hover:text-fg`}>
                    대시보드 <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
