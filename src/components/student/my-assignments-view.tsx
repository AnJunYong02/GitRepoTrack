"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Search } from "lucide-react";
import {
  getDeadlineMark,
  getItemStatus,
  weekTitle,
  type ItemStatus,
  type StudentRepoItemData,
  type StudentStatusCounts,
} from "@/lib/student/student-assignments";
import { formatKstDateTime, kstDaysUntil } from "@/lib/student/time-utils";

type Tab = "all" | ItemStatus;
type SortKey = "deadlineDesc" | "deadlineAsc" | "week";

const SORT_LABEL: Record<SortKey, string> = {
  deadlineDesc: "마감 최신순",
  deadlineAsc: "마감 오래된순",
  week: "주차 높은순",
};

const DOT: Record<ItemStatus, string> = {
  satisfied: "bg-brand",
  unmet: "bg-danger",
  pending: "bg-fg-3",
};

interface MyAssignmentsViewProps {
  items: StudentRepoItemData[];
  counts: StudentStatusCounts;
  currentId: string | null;
  /** 서버 렌더 시각 (D-day 계산이 서버·브라우저에서 같게) */
  nowMs: number;
}

function deadlineSortMs(item: StudentRepoItemData): number {
  const t = item.deadlineAt ? new Date(item.deadlineAt).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
}

/** 내 과제 화면: 요약 숫자 · 진행률 · 탭/검색/정렬 · 그룹별 과제 행 */
export function MyAssignmentsView({ items, counts, currentId, nowMs }: MyAssignmentsViewProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("deadlineDesc");

  const total = items.length;
  const satisfiedPct = total > 0 ? Math.round((counts.satisfied / total) * 100) : 0;
  const unmetPct = total > 0 ? Math.round((counts.unmet / total) * 100) : 0;

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (tab !== "all" && getItemStatus(item) !== tab) return false;
      if (!q) return true;
      const haystack = `${item.assignmentTitle} ${item.fullName} ${item.weekNo ?? ""}주차`.toLowerCase();
      return haystack.includes(q);
    });
    const sorted = [...filtered].sort((a, b) =>
      sort === "deadlineAsc"
        ? deadlineSortMs(a) - deadlineSortMs(b)
        : sort === "week"
        ? (b.weekNo ?? -1) - (a.weekNo ?? -1)
        : deadlineSortMs(b) - deadlineSortMs(a)
    );

    const thisWeek = sorted.filter((i) => i.id === currentId);
    const rest = sorted.filter((i) => i.id !== currentId);
    return [
      { key: "current", label: "이번 주", dot: "bg-brand", rows: thisWeek },
      { key: "unmet", label: "보완 필요", dot: "bg-danger", rows: rest.filter((i) => getItemStatus(i) === "unmet") },
      { key: "pending", label: "분석 필요", dot: "bg-fg-3", rows: rest.filter((i) => getItemStatus(i) === "pending") },
      { key: "past", label: "지난 과제", dot: "bg-fg-3", rows: rest.filter((i) => getItemStatus(i) === "satisfied") },
    ].filter((g) => g.rows.length > 0);
  }, [items, tab, query, sort, currentId]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "all", label: "전체", count: total },
    { key: "satisfied", label: "충족", count: counts.satisfied },
    { key: "unmet", label: "보완 필요", count: counts.unmet },
    ...(counts.pending > 0 ? [{ key: "pending" as const, label: "분석 필요", count: counts.pending }] : []),
  ];

  return (
    <div className="space-y-10">
      {/* 요약 숫자 + 전체 진행률 */}
      <section aria-label="과제 요약" className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-14">
          <BigStat value={counts.satisfied} label="충족" className="text-brand" />
          <BigStat value={counts.unmet} label="보완 필요" className="text-danger" />
          {counts.pending > 0 && <BigStat value={counts.pending} label="분석 필요" className="text-fg-3" />}
        </div>
        <div className="w-full space-y-3 pt-4 lg:w-[440px]">
          <div className="flex items-center justify-between text-[12px]">
            <span className="text-fg-2">전체 진행률</span>
            <span className="font-semibold text-brand">
              {total}개 중 {counts.satisfied}개 충족 · {satisfiedPct}%
            </span>
          </div>
          <div
            className="flex h-1.5 w-full overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-label="전체 진행률"
            aria-valuenow={satisfiedPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full bg-brand" style={{ width: `${satisfiedPct}%` }} />
            <div className="h-full bg-danger" style={{ width: `${unmetPct}%` }} />
          </div>
        </div>
      </section>

      {/* 탭 · 검색 · 정렬 */}
      <div className="flex flex-col gap-4 border-b border-line md:flex-row md:items-end md:justify-between">
        <div role="tablist" aria-label="과제 상태 필터" className="flex gap-7">
          {tabs.map((t) => {
            const on = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 pb-3 text-[14px] transition-colors ${
                  on ? "border-fg font-bold text-fg" : "border-transparent text-fg-3 hover:text-fg-2"
                }`}
              >
                {t.label} <span className="text-[12px] font-normal text-fg-3">{t.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 pb-3">
          <label className="relative flex-1 md:w-60 md:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="과제 이름, Repo 검색"
              aria-label="과제 이름, Repo 검색"
              className="w-full rounded-lg bg-chip py-2.5 pl-8 pr-3 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
          </label>
          <label className="relative inline-flex items-center">
            <span className="sr-only">정렬</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="appearance-none bg-transparent pr-4 text-[13px] text-fg-2 focus:outline-none"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {SORT_LABEL[k]}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0 h-3 w-3 text-fg-3" />
          </label>
        </div>
      </div>

      {/* 그룹별 과제 행 */}
      {groups.length === 0 ? (
        <p className="py-16 text-center text-[14px] text-fg-3">조건에 맞는 과제가 없어요.</p>
      ) : (
        <div className="-mt-4 space-y-2">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h2 className="flex items-center gap-2 pb-2 pt-6 text-[12px] font-medium text-fg-2">
                <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
                {g.label}
              </h2>
              <ul>
                {g.rows.map((item) => (
                  <AssignmentRow key={item.id} item={item} isCurrent={item.id === currentId} nowMs={nowMs} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function BigStat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div>
      <p className={`text-[44px] font-bold leading-none tracking-tight tabular-nums ${className}`}>{value}</p>
      <p className="mt-3 text-[13px] text-fg-2">{label}</p>
    </div>
  );
}

const ROW_BTN = "inline-flex items-center gap-1 rounded-lg px-3.5 py-2 text-[12px] font-semibold transition whitespace-nowrap";

function AssignmentRow({ item, isCurrent, nowMs }: { item: StudentRepoItemData; isCurrent: boolean; nowMs: number }) {
  const status = getItemStatus(item);
  const analyzed = item.hasSnapshot;
  const commitTarget = item.minCommits > 0 ? item.minCommits : 1;
  const commitPct = Math.min(100, Math.round((item.commitCount / commitTarget) * 100));

  // 마감 아래 작은 글씨
  const mark = getDeadlineMark(item, nowMs);
  const days = item.deadlineAt ? kstDaysUntil(item.deadlineAt, nowMs) : null;
  const isOpen = item.deadlineAt ? new Date(item.deadlineAt).getTime() > nowMs : false;
  const dPrefix = isOpen && days !== null ? (days > 0 ? `D-${days} · ` : "D-Day · ") : "";
  const deadlineNote =
    mark === "onTime"
      ? { text: `${dPrefix}${isOpen ? "기한 내" : "기한 내 제출"}`, cls: "text-brand" }
      : mark === "late"
      ? { text: "지각 제출", cls: "text-danger" }
      : mark === "missing"
      ? { text: "미제출", cls: "text-danger" }
      : mark === "open"
      ? { text: `${dPrefix}제출 전`, cls: "text-fg-3" }
      : null;

  return (
    <li
      className={`grid grid-cols-2 items-center gap-x-6 gap-y-4 border-b border-line py-4 md:grid-cols-[minmax(0,1fr)_150px_150px_200px_auto] lg:gap-x-10 ${
        isCurrent ? "-mx-4 border-b-0 bg-brand-soft/60 px-4" : ""
      }`}
    >
      {/* 제목 */}
      <div className="col-span-2 flex min-w-0 items-center gap-4 md:col-span-1">
        <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[status]}`} aria-label={status} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-fg">
            {item.preserveTitle ? item.assignmentTitle : item.weekNo !== null ? `과제 ${item.weekNo}주차` : weekTitle(null, item.assignmentTitle)}
          </p>
          <a
            href={`https://github.com/${item.fullName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate font-mono text-[11px] text-fg-3 hover:text-fg-2 hover:underline"
          >
            {item.fullName.split("/").pop()}
          </a>
        </div>
      </div>

      {/* 커밋 */}
      <div className="space-y-1">
        <p className="text-[11px] text-fg-3">커밋</p>
        {analyzed ? (
          <>
            <p className={`text-[14px] font-bold ${item.isCommitsSatisfied ? "text-brand" : "text-danger"}`}>
              {item.commitCount} / {commitTarget}개
            </p>
            <div className="h-[3px] w-[120px] overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${item.isCommitsSatisfied ? "bg-brand" : "bg-danger"}`}
                style={{ width: `${commitPct}%` }}
              />
            </div>
          </>
        ) : (
          <p className="text-[14px] font-semibold text-fg-3">분석 전</p>
        )}
      </div>

      {/* README */}
      <div className="space-y-1">
        <p className="text-[11px] text-fg-3">README</p>
        {!analyzed ? (
          <p className="text-[14px] font-semibold text-fg-3">분석 전</p>
        ) : item.totalKeywords > 0 ? (
          <p className={`text-[14px] font-bold ${item.isReadmeSatisfied ? "text-brand" : "text-danger"}`}>
            {item.passedKeywordsCount} / {item.totalKeywords}개
          </p>
        ) : item.isReadmeSatisfied ? (
          <p className="inline-flex items-center gap-1 text-[14px] font-bold text-brand">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
            확인됨
          </p>
        ) : (
          <p className="text-[14px] font-bold text-danger">README 누락</p>
        )}
      </div>

      {/* 마감 */}
      <div className="space-y-0.5">
        <p className="text-[11px] text-fg-3">마감</p>
        <p className="text-[14px] font-bold text-fg">{item.deadlineAt ? formatKstDateTime(item.deadlineAt) : "마감 미정"}</p>
        {deadlineNote && <p className={`text-[11px] ${deadlineNote.cls}`}>{deadlineNote.text}</p>}
      </div>

      {/* 버튼 */}
      <div className="flex justify-end">
        {isCurrent ? (
          <Link href={`/dashboard/${item.id}`} className={`${ROW_BTN} bg-brand text-white hover:brightness-110`}>
            대시보드 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : status === "unmet" ? (
          <Link href={`/dashboard/${item.id}`} className={`${ROW_BTN} bg-danger-soft text-danger hover:brightness-95`}>
            보완하러 가기 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <Link href={`/dashboard/${item.id}`} className={`${ROW_BTN} bg-chip text-fg-2 hover:text-fg`}>
            대시보드 <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </li>
  );
}
