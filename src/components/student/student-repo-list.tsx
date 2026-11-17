"use client";

import { useState, useEffect, type ReactNode } from "react";
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
  /** 목록 위에 들어가는 강조 영역 (직전 과제 요약) */
  topSlot?: ReactNode;
}

const STORAGE_KEY = "repotrack-student-layout";

const PILL = "inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 shadow-neu-inset";
const ACTION_LINK =
  "inline-flex items-center gap-1 rounded-xl bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-neu-sm transition hover:shadow-neu-inset";

/** 보라 원 아이콘 (사진의 Agent Activity 행 아이콘) */
function RowIcon() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lilac text-lilac-ink">
      <FolderGit2 className="h-4 w-4" />
    </span>
  );
}

function RepoLink({ fullName }: { fullName: string }) {
  return (
    <a
      href={`https://github.com/${fullName}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 break-all font-mono text-xs text-muted hover:text-ink hover:underline"
    >
      <span>{fullName}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
    </a>
  );
}

function CommitStatus({ item, compact }: { item: StudentRepoItemData; compact?: boolean }) {
  if (!item.hasSnapshot) {
    return (
      <span className="font-medium text-muted">
        분석 필요 {!compact && item.minCommits > 0 ? `(기준 ${item.minCommits}개)` : ""}
      </span>
    );
  }
  if (item.isCommitsSatisfied) {
    const count = item.minCommits > 0 ? `${item.commitCount}/${item.minCommits}개` : `${item.commitCount}개`;
    return (
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        {compact ? `✓ ${count}` : `✓ 충족 (${count})`}
      </span>
    );
  }
  if (!item.hasPushed) {
    return (
      <span className="font-semibold text-red-600 dark:text-red-400">
        {compact
          ? "✕ 0개"
          : `✕ 0개 (${item.minCommits > 0 ? `기준 ${item.minCommits}개 부족` : "Push된 커밋 없음"})`}
      </span>
    );
  }
  return (
    <span className="font-semibold text-amber-600 dark:text-amber-400">
      {compact
        ? `⚠ ${item.commitShortfall}개 부족 (${item.commitCount}/${item.minCommits})`
        : `⚠ 커밋 ${item.commitShortfall}개 부족 (${item.commitCount}/${item.minCommits}개)`}
    </span>
  );
}

function ReadmeStatus({ item, compact }: { item: StudentRepoItemData; compact?: boolean }) {
  if (!item.hasSnapshot) {
    return (
      <span className="font-medium text-muted">
        분석 필요 {!compact && item.totalKeywords > 0 ? `(기준 ${item.totalKeywords}개)` : ""}
      </span>
    );
  }
  if (item.totalKeywords > 0) {
    return item.isReadmeSatisfied ? (
      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
        {compact
          ? `✓ ${item.passedKeywordsCount}/${item.totalKeywords}개 통과`
          : `✓ 통과 (${item.passedKeywordsCount}/${item.totalKeywords}개)`}
      </span>
    ) : (
      <span className="font-semibold text-amber-600 dark:text-amber-400">
        {compact
          ? `⚠ ${item.missingKeywordsCount}개 부족 (${item.passedKeywordsCount}/${item.totalKeywords})`
          : `⚠ 키워드 ${item.missingKeywordsCount}개 부족 (${item.passedKeywordsCount}/${item.totalKeywords}개 통과)`}
      </span>
    );
  }
  return item.isReadmeSatisfied ? (
    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
      {compact ? "✓ 확인됨" : "✓ README 확인됨"}
    </span>
  ) : (
    <span className="font-semibold text-amber-600 dark:text-amber-400">
      {compact ? "⚠ 누락" : "⚠ README.md 파일 누락"}
    </span>
  );
}

export function StudentRepoList({ items, topSlot }: StudentRepoListProps) {
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

  const toggleClass = (active: boolean) =>
    `inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
      active ? "bg-surface text-ink shadow-neu-sm" : "text-muted hover:text-ink"
    }`;

  return (
    <section
      aria-label="내 과제 목록"
      className="flex h-full flex-col rounded-[28px] bg-surface p-6 shadow-neu"
    >
      {/* 헤더: 제목 + 개수 + 레이아웃 전환 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          내 과제 목록
          <span className="font-medium normal-case tracking-normal text-muted">({items.length}개)</span>
        </h2>

        <div
          className="inline-flex items-center gap-1 rounded-2xl p-1 shadow-neu-inset"
          role="group"
          aria-label="과제 목록 레이아웃 선택"
        >
          <button
            type="button"
            onClick={() => handleLayoutChange("list")}
            title="목록 레이아웃"
            aria-label="목록 레이아웃"
            aria-pressed={layout === "list"}
            className={toggleClass(layout === "list")}
          >
            {layout === "list" && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">목록</span>
          </button>
          <button
            type="button"
            onClick={() => handleLayoutChange("grid")}
            title="그리드 레이아웃"
            aria-label="그리드 레이아웃"
            aria-pressed={layout === "grid"}
            className={toggleClass(layout === "grid")}
          >
            {layout === "grid" && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">그리드</span>
          </button>
        </div>
      </div>

      {topSlot && <div className="mt-5">{topSlot}</div>}

      {/* 스크롤 영역 */}
      <div className="-mx-2 mt-4 max-h-[40rem] flex-1 overflow-y-auto px-2 pb-2">
        {layout === "grid" ? (
          /* GRID VIEW (바둑판 형식) */
          <div className="grid grid-cols-1 gap-4 pt-1 md:grid-cols-2 xl:grid-cols-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between gap-4 rounded-3xl bg-surface p-5 shadow-neu-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <RowIcon />
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">{item.assignmentTitle}</h3>
                      <RepoLink fullName={item.fullName} />
                    </div>
                  </div>

                  {/* 조건 상세 */}
                  <div className="space-y-2 rounded-2xl p-3 text-xs shadow-neu-inset">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <GitCommit className="h-3.5 w-3.5" />
                        <span>커밋(Commit) 조건</span>
                      </span>
                      <CommitStatus item={item} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <FileText className="h-3.5 w-3.5" />
                        <span>README 키워드 조건</span>
                      </span>
                      <ReadmeStatus item={item} />
                    </div>
                    {item.deadlineFormatted && (
                      <div className="flex items-center gap-1.5 border-t border-muted/15 pt-2 text-muted">
                        <Clock className="h-3.5 w-3.5" />
                        <span>마감: {item.deadlineFormatted}</span>
                      </div>
                    )}
                  </div>

                  {item.isStale && (
                    <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      ⚠️ 최신 push가 감지되었거나 아직 분석 전입니다. [분석 대시보드]에서 분석을 실행하세요.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <Link href={`/dashboard/${item.id}`} className={ACTION_LINK}>
                    <span>분석 대시보드</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* LIST VIEW (사진의 Agent Activity 행 형식) */
          <ul className="divide-y divide-muted/15">
            {items.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-4 2xl:flex-row 2xl:items-center">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <RowIcon />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="truncate text-sm font-medium text-ink">{item.assignmentTitle}</h3>
                      {item.deadlineFormatted && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted">
                          <Clock className="h-3 w-3" />
                          <span>마감: {item.deadlineFormatted}</span>
                        </span>
                      )}
                    </div>
                    <RepoLink fullName={item.fullName} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-[52px] text-xs 2xl:pl-0">
                  <div className={PILL}>
                    <GitCommit className="h-3.5 w-3.5 text-muted" />
                    <span className="text-muted">커밋:</span>
                    <CommitStatus item={item} compact />
                  </div>
                  <div className={PILL}>
                    <FileText className="h-3.5 w-3.5 text-muted" />
                    <span className="text-muted">README:</span>
                    <ReadmeStatus item={item} compact />
                  </div>
                  <Link href={`/dashboard/${item.id}`} className={ACTION_LINK}>
                    <span>분석 대시보드</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
