"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Users,
  Trophy,
  List,
  LayoutGrid,
  Check,
  Clock,
} from "lucide-react";

export interface AdminAssignmentItemData {
  id: string;
  title: string;
  orgName: string;
  branch: string;
  rankingMode: "live" | "none";
  deadlineFormatted: string;
  totalStudents: number;
  submittedStudents: number;
  unanalyzedStudents: number;
}

interface AdminAssignmentListProps {
  items: AdminAssignmentItemData[];
}

const STORAGE_KEY = "repotrack-admin-layout";

export function AdminAssignmentList({ items }: AdminAssignmentListProps) {
  const [layout, setLayout] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "list" || saved === "grid") {
      setLayout(saved);
    }
  }, []);

  const handleLayoutChange = (nextLayout: "grid" | "list") => {
    setLayout(nextLayout);
    window.localStorage.setItem(STORAGE_KEY, nextLayout);
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Section Header + Google Drive Style Layout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">등록된 과제 목록</h2>
          <p className="text-xs text-slate-500">
            총 {items.length}개 과제 운영 중
          </p>
        </div>

        <div
          className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
          role="group"
          aria-label="등록된 과제 목록 레이아웃 선택"
        >
          <button
            type="button"
            onClick={() => handleLayoutChange("list")}
            title="목록 레이아웃"
            aria-label="목록 레이아웃"
            aria-pressed={layout === "list"}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition ${
              layout === "list"
                ? "bg-blue-100/90 text-blue-900 dark:bg-blue-900/70 dark:text-blue-100"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {layout === "list" && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            <List className="w-4 h-4" />
            <span className="hidden sm:inline">목록 레이아웃</span>
          </button>

          <div className="w-px h-5 bg-slate-300 dark:bg-slate-700" />

          <button
            type="button"
            onClick={() => handleLayoutChange("grid")}
            title="그리드 레이아웃"
            aria-label="그리드 레이아웃"
            aria-pressed={layout === "grid"}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition ${
              layout === "grid"
                ? "bg-blue-100/90 text-blue-900 dark:bg-blue-900/70 dark:text-blue-100"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {layout === "grid" && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
            <LayoutGrid className="w-4 h-4" />
            <span className="hidden sm:inline">그리드 레이아웃</span>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-400 text-sm">
          등록된 과제가 없습니다. 우측 상단의 &quot;새 과제 직접 등록&quot; 버튼을 누르거나 위에서 Organization 과제를 일괄 등록하세요.
        </div>
      ) : layout === "grid" ? (
        /* GRID VIEW (바둑판 형식) */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((a) => {
            const percent = a.totalStudents
              ? Math.round((a.submittedStudents / a.totalStudents) * 100)
              : 0;

            return (
              <div
                key={a.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 hover:border-indigo-400 transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base">{a.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Org: {a.orgName} · Branch: {a.branch}
                      </p>
                    </div>
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                      {a.rankingMode === "live" ? "순위표 활성" : "일반 과제"}
                    </span>
                  </div>

                  {/* Submission Progress */}
                  <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Users className="w-3.5 h-3.5" />
                        <span>제출 현황</span>
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        <strong>{a.submittedStudents}</strong> / {a.totalStudents}명 ({percent}%)
                        {a.unanalyzedStudents > 0 && (
                          <span className="ml-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            · 미분석 {a.unanalyzedStudents}명
                          </span>
                        )}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label="제출 진행률"
                      className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                    >
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-400">
                    마감: {a.deadlineFormatted}
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/assignments/${a.id}/leaderboard`}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-100 transition"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>순위표</span>
                    </Link>

                    <Link
                      href={`/admin/assignments/${a.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-100 transition"
                    >
                      <span>현황 관리</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW (일자 리스트 형식) */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {items.map((a) => {
            const percent = a.totalStudents
              ? Math.round((a.submittedStudents / a.totalStudents) * 100)
              : 0;

            return (
              <div
                key={a.id}
                className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
              >
                {/* Left: Title & Info */}
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                      {a.title}
                    </h3>
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                      {a.rankingMode === "live" ? "순위표 활성" : "일반 과제"}
                    </span>
                    {a.unanalyzedStudents > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-600/20">
                        <Clock className="w-3 h-3" />
                        <span>미분석 {a.unanalyzedStudents}명</span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>
                      Org: {a.orgName} · Branch: {a.branch}
                    </span>
                    <span className="text-slate-400">· 마감: {a.deadlineFormatted}</span>
                  </div>
                </div>

                {/* Middle: Progress Bar */}
                <div className="w-full lg:w-56 space-y-1 shrink-0">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="flex items-center gap-1 text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span>제출 현황</span>
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">
                      <strong>{a.submittedStudents}</strong> / {a.totalStudents}명 ({percent}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center justify-end gap-2 shrink-0">
                  <Link
                    href={`/assignments/${a.id}/leaderboard`}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-100 transition"
                  >
                    <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>순위표</span>
                  </Link>

                  <Link
                    href={`/admin/assignments/${a.id}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-100 transition"
                  >
                    <span>현황 관리</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
