"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import {
  clampTimelineStart,
  getItemStatus,
  timelineInitialStart,
  timelineRangeLabel,
  type ItemStatus,
  type StudentRepoItemData,
  type StudentStatusCounts,
  type UpcomingAssignment,
} from "@/lib/student/student-assignments";
import { formatKstMonthDay } from "@/lib/student/time-utils";

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
const NAV_BTN =
  "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-line bg-canvas text-fg shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition hover:bg-chip disabled:cursor-default disabled:opacity-30 disabled:hover:bg-canvas";

/** 한 화면에 보이는 주차 수: 데스크톱 6, 태블릿 3, 모바일 2 */
const DESKTOP_VISIBLE = 6;
function visibleForWidth(width: number): number {
  if (width >= 1024) return DESKTOP_VISIBLE;
  if (width >= 640) return 3;
  return 2;
}

function deadlineMs(iso: string | null): number {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

/** 메인 대시보드 하단: 주차별 과제를 왼쪽(과거) → 오른쪽(미래)으로, ‹ › 버튼으로 한 주차씩 이동 */
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

  const total = entries.length;
  const currentIdx = entries.findIndex((e) => e.key === currentId);

  // 서버 렌더는 데스크톱 기준(6칸), 마운트 후 실제 화면 폭에 맞춤
  const [visible, setVisible] = useState(DESKTOP_VISIBLE);
  const [start, setStart] = useState(() => timelineInitialStart(total, currentIdx, DESKTOP_VISIBLE));

  useEffect(() => {
    const update = () => setVisible(visibleForWidth(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // 보이는 칸 수가 바뀌면 이번 주가 보이는 위치로 다시 맞춤
  useEffect(() => {
    setStart(timelineInitialStart(total, currentIdx, visible));
  }, [visible, total, currentIdx]);

  const canSlide = total > visible;
  const maxStart = Math.max(0, total - visible);
  const move = (delta: number) => setStart((s) => clampTimelineStart(s + delta, total, visible));

  const firstVisible = entries[start];
  const lastVisible = entries[Math.min(total, start + visible) - 1];

  return (
    <section aria-label="과제 타임라인" className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-[20px] font-bold tracking-tight text-fg">과제 타임라인</h2>
        <p className="text-[13px] text-fg-3">
          {items.length}개 중 {counts.satisfied}개 충족
          {counts.unmet > 0 && ` · ${counts.unmet}개 보완 필요`}
          {counts.pending > 0 && ` · ${counts.pending}개 분석 필요`}
        </p>
      </div>

      <div className="space-y-8">
        <div className="flex items-start gap-3 sm:gap-5">
          {canSlide && (
            // 버튼 가운데(26px)가 타임라인 선 높이(위 여백 8px + 점 중심 10px)에 오도록
            <button type="button" onClick={() => move(-1)} disabled={start === 0} aria-label="이전 주차" className={`${NAV_BTN} -mt-2`}>
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* 보이는 영역: 전체 칸을 한 줄로 그려 두고 translateX로 한 칸씩 밀어 이동 */}
          <div className="min-w-0 flex-1 overflow-hidden pl-[6px] pt-2">
            <ol
              className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${(start * 100) / visible}%)` }}
              aria-live="polite"
            >
              {entries.map((entry, idx) => {
                const isCurrent = idx === currentIdx;
                const lineDone = currentIdx >= 0 ? idx < currentIdx : entry.kind === "repo";
                const label = entry.weekNo !== null ? `${entry.weekNo}주차` : entry.title;
                const hidden = idx < start || idx >= start + visible;
                return (
                  <li
                    key={entry.key}
                    className="relative min-w-0 pr-4"
                    style={{ flex: `0 0 ${100 / visible}%` }}
                    aria-hidden={hidden || undefined}
                  >
                    {/* 다음 칸까지 이어지는 선 (맨 끝 칸만 오른쪽 끝까지) */}
                    <span
                      aria-hidden
                      className={`absolute left-[10px] top-[9px] h-[2px] ${
                        idx === total - 1 ? "right-0" : "right-[-10px]"
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
                    <p className="mt-1 truncate text-[12px] text-fg-3">
                      {entry.deadlineAt ? `${formatKstMonthDay(entry.deadlineAt)} 마감` : "마감 미정"}
                    </p>

                    <div className="mt-4">
                      {entry.kind === "upcoming" ? (
                        <span className="inline-block py-1.5 text-[12px] text-fg-3">공개 전</span>
                      ) : isCurrent ? (
                        <Link
                          href={`/dashboard/${entry.item.id}`}
                          tabIndex={hidden ? -1 : undefined}
                          className={`${BTN} bg-brand text-white hover:brightness-110`}
                        >
                          대시보드 <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : entry.status === "unmet" ? (
                        <Link
                          href={`/dashboard/${entry.item.id}`}
                          tabIndex={hidden ? -1 : undefined}
                          className={`${BTN} bg-danger-soft text-danger hover:brightness-95`}
                        >
                          보완하러 가기 <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/${entry.item.id}`}
                          tabIndex={hidden ? -1 : undefined}
                          className={`${BTN} bg-chip text-fg-2 hover:text-fg`}
                        >
                          대시보드 <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {canSlide && (
            <button
              type="button"
              onClick={() => move(1)}
              disabled={start >= maxStart}
              aria-label="다음 주차"
              className={`${NAV_BTN} -mt-2`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* 위치 표시: 이동 가능한 위치마다 점, 현재 위치는 초록 막대 */}
        {canSlide && firstVisible && lastVisible && (
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-1.5" role="group" aria-label="타임라인 위치">
              {Array.from({ length: maxStart + 1 }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setStart(i)}
                  aria-label={`${i + 1}번째 위치로 이동`}
                  aria-current={i === start || undefined}
                  className={`h-1.5 rounded-full transition-all ${i === start ? "w-6 bg-brand" : "w-1.5 bg-line hover:bg-fg-3"}`}
                />
              ))}
            </div>
            <p className="text-[13px] text-fg-3">
              {timelineRangeLabel(firstVisible, lastVisible)} · 전체 {total}주차
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
