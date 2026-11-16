"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  FolderGit2,
  Clock,
  ArrowRight,
  ExternalLink,
  GitCommit,
  FileText,
  List,
  LayoutGrid,
  Check,
} from "lucide-react";

export interface StudentRepoItemData {
  id: string;
  fullName: string;
  assignmentId: string | null;
  assignmentTitle: string;
  rankingMode: "live" | "none";
  deadlineFormatted: string | null;
  deadlineAt: string | null; // ISO 원본 (요약 패널의 다음 마감 계산용)
  hasSnapshot: boolean;
  hasPushed: boolean;
  isSubmitted: boolean;
  isLateSubmission: boolean;
  isPastDeadlineUnpushed: boolean;
  unmetSummary: string;
  minCommits: number;
  commitCount: number;
  commitShortfall: number;
  isCommitsSatisfied: boolean;
  totalKeywords: number;
  passedKeywordsCount: number;
  missingKeywordsCount: number;
  missingKeywords: string[]; // 부족한 README 키워드 이름 (대시보드 표시용)
  isReadmeSatisfied: boolean;
  isStale: boolean;
}

interface StudentRepoListProps {
  items: StudentRepoItemData[];
}

const STORAGE_KEY = "repotrack-student-layout";

export function StudentRepoList({ items }: StudentRepoListProps) {
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
    <div className="space-y-4">
      {/* Toolbar: Count + Google Drive Style Layout Switcher */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          전체 과제 ({items.length}개)
        </span>

        <div
          className="inline-flex items-center rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-xs"
          role="group"
          aria-label="과제 목록 레이아웃 선택"
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

      {/* GRID VIEW (바둑판 형식) */}
      {layout === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 hover:border-blue-400 transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base">{item.assignmentTitle}</h3>
                    <a
                      href={`https://github.com/${item.fullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline mt-1 break-all"
                    >
                      <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.fullName}</span>
                      <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                    </a>
                  </div>
                </div>

                {/* Detailed Condition Breakdown Box */}
                <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 p-3 space-y-2 text-xs">
                  {/* 1. Commit Condition */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <GitCommit className="w-3.5 h-3.5" />
                      <span>커밋(Commit) 조건</span>
                    </span>
                    {!item.hasSnapshot ? (
                      <span className="text-slate-400 font-medium">
                        분석 필요 {item.minCommits > 0 ? `(기준 ${item.minCommits}개)` : ""}
                      </span>
                    ) : item.isCommitsSatisfied ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ 충족 (
                        {item.minCommits > 0
                          ? `${item.commitCount}/${item.minCommits}개`
                          : `${item.commitCount}개`}
                        )
                      </span>
                    ) : !item.hasPushed ? (
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        ✕ 0개 (
                        {item.minCommits > 0
                          ? `기준 ${item.minCommits}개 부족`
                          : "Push된 커밋 없음"}
                        )
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        ⚠ 커밋 {item.commitShortfall}개 부족 ({item.commitCount}/{item.minCommits}개)
                      </span>
                    )}
                  </div>

                  {/* 2. README Keyword Condition */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-slate-500">
                      <FileText className="w-3.5 h-3.5" />
                      <span>README 키워드 조건</span>
                    </span>
                    {!item.hasSnapshot ? (
                      <span className="text-slate-400 font-medium">
                        분석 필요 {item.totalKeywords > 0 ? `(기준 ${item.totalKeywords}개)` : ""}
                      </span>
                    ) : item.totalKeywords > 0 ? (
                      item.isReadmeSatisfied ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ 통과 ({item.passedKeywordsCount}/{item.totalKeywords}개)
                        </span>
                      ) : (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          ⚠ 키워드 {item.missingKeywordsCount}개 부족 ({item.passedKeywordsCount}/
                          {item.totalKeywords}개 통과)
                        </span>
                      )
                    ) : item.isReadmeSatisfied ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ README 확인됨
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        ⚠ README.md 파일 누락
                      </span>
                    )}
                  </div>

                  {/* 3. Deadline / Late Status */}
                  {item.deadlineFormatted && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <span className="inline-flex items-center gap-1.5 text-slate-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>마감: {item.deadlineFormatted}</span>
                      </span>
                    </div>
                  )}
                </div>

                {item.isStale && (
                  <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ 최신 push가 감지되었거나 아직 분석 전입니다. [분석 대시보드]에서 분석을 실행하세요.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                <Link
                  href={`/dashboard/${item.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  <span>분석 대시보드</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* LIST VIEW (일자 리스트 형식) */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm divide-y divide-slate-200 dark:divide-slate-800 overflow-hidden">
          {items.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
            >
              {/* Left: Title & Repo Link & Deadline */}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                    {item.assignmentTitle}
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <a
                    href={`https://github.com/${item.fullName}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.fullName}</span>
                    <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                  </a>

                  {item.deadlineFormatted && (
                    <span className="inline-flex items-center gap-1 text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>마감: {item.deadlineFormatted}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Middle: Compact Inline Metrics (Commit & README) */}
              <div className="flex flex-wrap items-center gap-2 text-xs shrink-0">
                {/* Commit Pill */}
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">커밋:</span>
                  {!item.hasSnapshot ? (
                    <span className="text-slate-400 font-medium">분석 필요</span>
                  ) : item.isCommitsSatisfied ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ {item.minCommits > 0 ? `${item.commitCount}/${item.minCommits}개` : `${item.commitCount}개`}
                    </span>
                  ) : !item.hasPushed ? (
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      ✕ 0개
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      ⚠ {item.commitShortfall}개 부족 ({item.commitCount}/{item.minCommits})
                    </span>
                  )}
                </div>

                {/* README Pill */}
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">README:</span>
                  {!item.hasSnapshot ? (
                    <span className="text-slate-400 font-medium">분석 필요</span>
                  ) : item.totalKeywords > 0 ? (
                    item.isReadmeSatisfied ? (
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ {item.passedKeywordsCount}/{item.totalKeywords}개 통과
                      </span>
                    ) : (
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        ⚠ {item.missingKeywordsCount}개 부족 ({item.passedKeywordsCount}/{item.totalKeywords})
                      </span>
                    )
                  ) : item.isReadmeSatisfied ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      ✓ 확인됨
                    </span>
                  ) : (
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      ⚠ 누락
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center justify-end gap-2 shrink-0">
                <Link
                  href={`/dashboard/${item.id}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 transition"
                >
                  <span>분석 대시보드</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
