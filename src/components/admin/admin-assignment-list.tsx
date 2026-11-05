"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  Users,
  Trophy,
  List,
  LayoutGrid,
  Check,
  Clock,
  Search,
  RefreshCw,
  FolderGit2,
  ExternalLink,
  PlusCircle,
  Loader2,
} from "lucide-react";
import { ParsedRepoInfo, normalizeCategoryKey } from "@/lib/github/repo-parser";

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

interface CategoryData {
  category: string;
  label: string;
  count: number;
  isStudentCategory: boolean;
  repos: ParsedRepoInfo[];
  existingAssignmentId?: string;
  existingAssignmentTitle?: string;
  existingRepoCount?: number;
}

interface UnifiedAssignmentEntry {
  key: string;
  sortKey: string;
  isRegistered: boolean;
  assignment?: AdminAssignmentItemData;
  categoryData?: CategoryData;
}

interface AdminAssignmentListProps {
  items: AdminAssignmentItemData[];
  activeOrg?: string;
}

const STORAGE_KEY = "repotrack-admin-layout";

export function AdminAssignmentList({
  items,
  activeOrg = "2026-2-WebService",
}: AdminAssignmentListProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [orgName, setOrgName] = useState(activeOrg);
  const [totalRepos, setTotalRepos] = useState(0);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [importingCat, setImportingCat] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "list" || saved === "grid") {
      setLayout(saved);
    }
  }, []);

  // Stopwatch while fetching/refreshing Organization repos
  useEffect(() => {
    if (!loadingOrg) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedMs(0);
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(timer);
  }, [loadingOrg]);

  const fetchOrgRepos = async (targetOrg = activeOrg, forceRefresh = false) => {
    setLoadingOrg(true);
    setErrorMsg("");
    setOrgName(targetOrg);
    try {
      const refreshParam = forceRefresh ? "&refresh=1" : "";
      const res = await fetch(
        `/api/admin/org-repos?org=${encodeURIComponent(targetOrg)}${refreshParam}`
      );
      const data = await res.json();
      if (!res.ok) {
        setCategories([]);
        setTotalRepos(0);
        throw new Error(data.error || "조직 저장소 목록 조회 실패");
      }
      setOrgName(data.orgName || targetOrg);
      setTotalRepos(data.totalRepos || 0);
      setCategories(data.categories || []);
    } catch (err: any) {
      setErrorMsg(err.message || "조직 저장소 조회 중 오류가 발생했습니다.");
    } finally {
      setLoadingOrg(false);
    }
  };

  useEffect(() => {
    setSuccessMsg("");
    fetchOrgRepos(activeOrg, false);
  }, [activeOrg]);

  const handleLayoutChange = (nextLayout: "grid" | "list") => {
    setLayout(nextLayout);
    window.localStorage.setItem(STORAGE_KEY, nextLayout);
  };

  const handleImportCategory = async (
    catData: CategoryData,
    overrideTitle?: string
  ) => {
    setImportingCat(catData.category);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/org-repos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: catData.category,
          title: overrideTitle || catData.label,
          orgName: activeOrg,
          repos: catData.repos,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "과제 등록 및 동기화에 실패했습니다.");
      }

      setSuccessMsg(
        `🎉 ${overrideTitle || catData.label} 저장소 ${data.importedCount}개가 동기화되었습니다!`
      );
      await fetchOrgRepos(activeOrg, false);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "과제 동기화 중 오류가 발생했습니다.");
    } finally {
      setImportingCat(null);
    }
  };

  // Build unified assignment entries (registered DB assignments + unregistered student categories from Org)
  const matchedCatKeys = new Set<string>();
  const unifiedEntries: UnifiedAssignmentEntry[] = [];

  for (const a of items) {
    const normTitleKey = normalizeCategoryKey(a.title);
    const matchedCat = categories.find(
      (c) =>
        c.existingAssignmentId === a.id ||
        normalizeCategoryKey(c.category) === normTitleKey
    );
    if (matchedCat) {
      matchedCatKeys.add(matchedCat.category);
    }
    unifiedEntries.push({
      key: a.id,
      sortKey: normTitleKey,
      isRegistered: true,
      assignment: a,
      categoryData: matchedCat,
    });
  }

  for (const cat of categories) {
    if (!cat.isStudentCategory) continue;
    if (matchedCatKeys.has(cat.category)) continue;
    if (cat.existingAssignmentId && items.some((i) => i.id === cat.existingAssignmentId)) {
      continue;
    }
    unifiedEntries.push({
      key: `unregistered-${cat.category}`,
      sortKey: normalizeCategoryKey(cat.category),
      isRegistered: false,
      categoryData: cat,
    });
  }

  unifiedEntries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  // Filter by search query
  const query = searchQuery.trim().toLowerCase();

  // Matching individual student repos when search query is entered
  const matchedRepos: {
    repo: ParsedRepoInfo;
    categoryLabel: string;
    assignmentId?: string;
  }[] = [];

  if (query) {
    for (const cat of categories) {
      for (const r of cat.repos) {
        const studentMatch = r.studentNo?.toLowerCase().includes(query);
        const nameMatch = r.name.toLowerCase().includes(query);
        const catMatch =
          cat.category.toLowerCase().includes(query) ||
          cat.label.toLowerCase().includes(query);
        if (studentMatch || nameMatch || catMatch) {
          matchedRepos.push({
            repo: r,
            categoryLabel: cat.label,
            assignmentId: cat.existingAssignmentId,
          });
        }
      }
    }
  }

  const filteredEntries = unifiedEntries.filter((entry) => {
    if (!query) return true;
    const titleMatch =
      entry.assignment?.title.toLowerCase().includes(query) ||
      entry.categoryData?.label.toLowerCase().includes(query) ||
      entry.categoryData?.category.toLowerCase().includes(query);
    if (titleMatch) return true;

    const repoMatch = entry.categoryData?.repos.some(
      (r) =>
        r.studentNo?.toLowerCase().includes(query) ||
        r.name.toLowerCase().includes(query)
    );
    return Boolean(repoMatch);
  });

  return (
    <div className="space-y-6">
      {/* 1. Top Repo Search Bar Only */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="저장소 및 과제 검색"
              placeholder="학번(예: 22100063), 과제명(예: assign01) 또는 저장소 이름으로 Repo 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 py-2 pl-10 pr-16 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                지우기
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => fetchOrgRepos(activeOrg, true)}
            disabled={loadingOrg}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-xs disabled:opacity-70 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loadingOrg ? "animate-spin text-indigo-600" : ""
              }`}
            />
            <span>
              {loadingOrg
                ? `Repo 동기화 중 (${(elapsedMs / 1000).toFixed(1)}초)`
                : `Repo 새로고침 (${orgName}${totalRepos ? ` · ${totalRepos}개` : ""})`}
            </span>
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950/60 p-3 text-xs text-red-600 dark:text-red-300">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            {successMsg}
          </div>
        )}

        {/* Matching Student Repositories Result Panel (Only shown when searching) */}
        {query && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                검색된 학생 저장소 ({matchedRepos.length}개)
              </span>
              {matchedRepos.length > 24 && (
                <span className="text-[11px] text-slate-400">
                  상위 24개 결과만 표시됩니다
                </span>
              )}
            </div>

            {matchedRepos.length === 0 ? (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 p-4 text-center text-xs text-slate-400">
                &ldquo;{searchQuery}&rdquo; 검색어와 일치하는 저장소가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                {matchedRepos.slice(0, 24).map(({ repo, categoryLabel, assignmentId }) => (
                  <div
                    key={repo.repoId}
                    className="flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-2.5 text-xs hover:border-indigo-300 transition"
                  >
                    <div className="space-y-0.5 truncate pr-2 min-w-0">
                      <div className="flex items-center gap-1.5 font-medium truncate">
                        <FolderGit2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate font-mono text-[11px] text-slate-800 dark:text-slate-200">
                          {repo.name}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 pl-5">
                        {repo.studentNo && (
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                            학번: {repo.studentNo}
                          </span>
                        )}
                        <span className="truncate">{categoryLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {assignmentId && (
                        <Link
                          href={`/admin/assignments/${assignmentId}`}
                          className="rounded px-1.5 py-1 text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100"
                          title="과제 현황 관리로 이동"
                        >
                          관리
                        </Link>
                      )}
                      {repo.htmlUrl && (
                        <a
                          href={repo.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                          title="GitHub 저장소 열기"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Single Unified Assignments List + Google Drive Style Layout Switcher */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight">과제 목록</h2>
            <p className="text-xs text-slate-500">
              총 {filteredEntries.length}개 과제 ({orgName})
            </p>
          </div>

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

        {filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-400 text-sm">
            {query
              ? "검색어와 일치하는 과제가 없습니다."
              : "등록된 과제가 없습니다. 우측 상단의 '새 과제 직접 등록' 버튼을 눌러 과제를 추가하세요."}
          </div>
        ) : layout === "grid" ? (
          /* GRID VIEW (바둑판 형식) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEntries.map((entry) => {
              if (!entry.isRegistered && entry.categoryData) {
                const cat = entry.categoryData;
                const isImporting = importingCat === cat.category;
                return (
                  <div
                    key={entry.key}
                    className="rounded-xl border border-dashed border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-bold text-base">{cat.label}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Org: {orgName} · 감지된 저장소 {cat.repos.length}개
                          </p>
                        </div>
                        <span className="rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
                          미등록 과제
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleImportCategory(cat)}
                        disabled={isImporting}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm disabled:opacity-50"
                      >
                        {isImporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PlusCircle className="w-3.5 h-3.5" />
                        )}
                        <span>과제 등록 및 학생 Repo 일괄 동기화 ({cat.repos.length}개)</span>
                      </button>
                    </div>
                  </div>
                );
              }

              const a = entry.assignment!;
              const cat = entry.categoryData;
              const unsyncedCount =
                cat && cat.repos.length > a.totalStudents
                  ? cat.repos.length - a.totalStudents
                  : 0;
              const isImporting = cat ? importingCat === cat.category : false;
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

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                    <span className="text-xs text-slate-400">
                      마감: {a.deadlineFormatted}
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      {unsyncedCount > 0 && cat && (
                        <button
                          type="button"
                          onClick={() => handleImportCategory(cat, a.title)}
                          disabled={isImporting}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50"
                        >
                          {isImporting ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <PlusCircle className="w-3.5 h-3.5" />
                          )}
                          <span>+{unsyncedCount}명 동기화</span>
                        </button>
                      )}

                      <Link
                        href={`/assignments/${a.id}/leaderboard`}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-100 transition"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>순위표</span>
                      </Link>

                      <Link
                        href={`/admin/assignments/${a.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500 transition shadow-xs"
                      >
                        <span>과제 관리 바로가기</span>
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
            {filteredEntries.map((entry) => {
              if (!entry.isRegistered && entry.categoryData) {
                const cat = entry.categoryData;
                const isImporting = importingCat === cat.category;
                return (
                  <div
                    key={entry.key}
                    className="p-4 sm:px-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-indigo-50/20 dark:bg-indigo-950/10 hover:bg-indigo-50/40 transition"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">
                          {cat.label}
                        </h3>
                        <span className="rounded-full bg-indigo-100 dark:bg-indigo-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                          미등록 과제 ({cat.repos.length}개 repo 감지됨)
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Org: {orgName} · 아직 과제로 등록되지 않은 저장소 묶음입니다.
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleImportCategory(cat)}
                        disabled={isImporting}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm disabled:opacity-50"
                      >
                        {isImporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PlusCircle className="w-3.5 h-3.5" />
                        )}
                        <span>과제 등록 및 학생 Repo 일괄 동기화 ({cat.repos.length}개)</span>
                      </button>
                    </div>
                  </div>
                );
              }

              const a = entry.assignment!;
              const cat = entry.categoryData;
              const unsyncedCount =
                cat && cat.repos.length > a.totalStudents
                  ? cat.repos.length - a.totalStudents
                  : 0;
              const isImporting = cat ? importingCat === cat.category : false;
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
                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    {unsyncedCount > 0 && cat && (
                      <button
                        type="button"
                        onClick={() => handleImportCategory(cat, a.title)}
                        disabled={isImporting}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-indigo-100 transition disabled:opacity-50"
                      >
                        {isImporting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <PlusCircle className="w-3.5 h-3.5" />
                        )}
                        <span>+{unsyncedCount}명 동기화</span>
                      </button>
                    )}

                    <Link
                      href={`/assignments/${a.id}/leaderboard`}
                      className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-100 transition"
                    >
                      <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      <span>순위표</span>
                    </Link>

                    <Link
                      href={`/admin/assignments/${a.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-indigo-500 transition shadow-xs"
                    >
                      <span>과제 관리 바로가기</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
