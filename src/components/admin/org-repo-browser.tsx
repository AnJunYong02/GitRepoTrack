"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  FolderGit2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  PlusCircle,
  Loader2,
  Layers,
  Sparkles,
  ArrowRight,
  Clock,
} from "lucide-react";
import { ParsedRepoInfo } from "@/lib/github/repo-parser";

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

interface OrgRepoBrowserProps {
  activeOrg?: string;
}

export function OrgRepoBrowser({
  activeOrg = "2026-2-WebService",
}: OrgRepoBrowserProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [importingCat, setImportingCat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgName, setOrgName] = useState(activeOrg);
  const [totalRepos, setTotalRepos] = useState(0);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Live 0.1s ticking stopwatch while loading/refreshing
  useEffect(() => {
    if (!loading) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedMs(0);
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(timer);
  }, [loading]);

  const fetchData = async (targetOrg = activeOrg, forceRefresh = false) => {
    setLoading(true);
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
      setOrgName(data.orgName);
      setTotalRepos(data.totalRepos);
      setCategories(data.categories || []);

      // Keep all categories collapsed by default so the list looks neat and organized
      setExpandedCats({});
    } catch (err: any) {
      setErrorMsg(err.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSuccessMsg("");
    fetchData(activeOrg, false);
  }, [activeOrg]);

  const toggleCategory = (cat: string) => {
    setExpandedCats((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handleImportCategory = async (catData: CategoryData) => {
    setImportingCat(catData.category);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/admin/org-repos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: catData.category,
          title: catData.label,
          orgName: activeOrg,
          repos: catData.repos,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "과제 등록에 실패했습니다.");
      }

      setSuccessMsg(
        `🎉 ${catData.label} 저장소 ${data.importedCount}개가 과제로 등록되었습니다!`
      );
      // Refresh local data & router
      await fetchData();
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "과제 등록 중 오류가 발생했습니다.");
    } finally {
      setImportingCat(null);
    }
  };

  // Filter categories and repos based on search query
  const query = searchQuery.trim().toLowerCase();
  const filteredCategories = categories
    .map((cat) => {
      if (!query) return cat;

      const matchedRepos = cat.repos.filter((r) => {
        const studentMatch = r.studentNo?.toLowerCase().includes(query);
        const nameMatch = r.name.toLowerCase().includes(query);
        const catMatch = cat.category.toLowerCase().includes(query) || cat.label.toLowerCase().includes(query);
        return studentMatch || nameMatch || catMatch;
      });

      return {
        ...cat,
        repos: matchedRepos,
      };
    })
    .filter((cat) => cat.repos.length > 0);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600">
                <Layers className="w-3.5 h-3.5" />
              </span>
              <h2 className="text-base font-bold tracking-tight">
                Organization 저장소 &amp; 과제 자동 분류
              </h2>
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                {orgName} ({totalRepos}개)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              학생 저장소 이름(<code className="font-mono text-[11px]">assign01_학번</code>)을 자동 파싱하여 과제별로 분류하고, 1-클릭으로 과제 및 학생 Repo를 등록합니다.
            </p>
          </div>

          <button
            onClick={() => fetchData(activeOrg, true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-70"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-600" : ""}`} />
            <span>
              {loading
                ? `새로고침 중... (${(elapsedMs / 1000).toFixed(1)}초)`
                : "새로고침"}
            </span>
          </button>
        </div>

        {/* Realtime Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="학번(예: 22100063), 과제명(예: assign01) 또는 저장소 이름으로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/80 py-2 pl-9 pr-4 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 focus:outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600"
            >
              지우기
            </button>
          )}
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
      </div>

      {/* Body: Categories list */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {loading && (
          <div className="p-6 sm:p-8 bg-indigo-50/30 dark:bg-indigo-950/20">
            <div className="mx-auto max-w-md space-y-4 text-center">
              {/* Live Elapsed Stopwatch Pill */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 shadow-sm ring-1 ring-indigo-500/20">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>새로고침 및 저장소 스캔 중...</span>
                <span
                  aria-hidden="true"
                  className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 font-mono text-[11px] text-indigo-700 dark:text-indigo-300"
                >
                  <Clock className="w-3 h-3" />
                  {(elapsedMs / 1000).toFixed(1)}초 경과
                </span>
              </div>

              {/* Dynamic Stage Message */}
              <div className="space-y-1" aria-live="polite">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {elapsedMs < 700
                    ? `1/3단계: GitHub Organization (${orgName}) 연결 및 인증 확인 중...`
                    : elapsedMs < 1800
                    ? `2/3단계: ${orgName} 내 학생 과제 저장소 목록을 불러오는 중...`
                    : `3/3단계: 과제 카테고리(assign01~) 및 학번 자동 파싱·분류 마무리 중...`}
                </p>
                <p className="text-[11px] text-slate-400">
                  GitHub API로부터 최신 저장소 상태를 안전하게 동기화하고 있습니다. 잠시만 기다려주세요!
                </p>
              </div>

              {/* Smooth Animated Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-indigo-600 transition-all duration-150 ease-out"
                  style={{
                    width: `${Math.min(
                      94,
                      Math.max(15, Math.round((1 - Math.exp(-elapsedMs / 1400)) * 95))
                    )}%`,
                  }}
                />
              </div>

              {/* 3-Step Indicator Dots */}
              <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] font-medium">
                <div
                  className={`rounded-lg py-1.5 px-2 border transition ${
                    elapsedMs >= 0
                      ? "border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-semibold"
                      : "border-slate-100 text-slate-400"
                  }`}
                >
                  1. Org 인증 연결
                </div>
                <div
                  className={`rounded-lg py-1.5 px-2 border transition ${
                    elapsedMs >= 700
                      ? "border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-semibold"
                      : "border-slate-100 dark:border-slate-800 text-slate-400"
                  }`}
                >
                  2. 저장소 스캔
                </div>
                <div
                  className={`rounded-lg py-1.5 px-2 border transition ${
                    elapsedMs >= 1800
                      ? "border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-semibold"
                      : "border-slate-100 dark:border-slate-800 text-slate-400"
                  }`}
                >
                  3. 과제 자동 분류
                </div>
              </div>
            </div>
          </div>
        )}
        {!loading && filteredCategories.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            검색 결과와 일치하는 저장소가 없습니다.
          </div>
        ) : (
          filteredCategories.map((cat) => {
            const isExpanded = expandedCats[cat.category] || !!query;
            const isImporting = importingCat === cat.category;
            const isRegistered = !!cat.existingAssignmentId;

            return (
              <div key={cat.category} className="p-4 sm:p-5 transition hover:bg-slate-50/40 dark:hover:bg-slate-800/20">
                {/* Category Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    onClick={() => toggleCategory(cat.category)}
                    aria-expanded={isExpanded}
                    className="flex items-center gap-2.5 text-left font-semibold text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{cat.label}</span>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          {cat.repos.length}개 repo
                        </span>
                        {isRegistered && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-600/20">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>과제 등록됨 ({cat.existingRepoCount}명 배정)</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Actions for this category */}
                  <div className="flex items-center gap-2">
                    {cat.isStudentCategory && (
                      <>
                        {isRegistered ? (
                          <Link
                            href={`/admin/assignments/${cat.existingAssignmentId}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition shadow-sm"
                          >
                            <span>과제 관리 바로가기</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        ) : (
                          <button
                            onClick={() => handleImportCategory(cat)}
                            disabled={isImporting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm disabled:opacity-50"
                          >
                            {isImporting ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <PlusCircle className="w-3.5 h-3.5" />
                            )}
                            <span>과제 등록 및 학생 Repo 일괄 동기화 ({cat.repos.length}개)</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded Repo List */}
                {isExpanded && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {cat.repos.map((r) => (
                        <div
                          key={r.repoId}
                          className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-2 text-xs"
                        >
                          <div className="space-y-0.5 truncate pr-2">
                            <div className="flex items-center gap-1.5 font-medium truncate">
                              <FolderGit2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate font-mono text-[11px]">{r.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 pl-5">
                              {r.studentNo && (
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                  학번: {r.studentNo}
                                </span>
                              )}
                              {r.classCode && <span>분반: {r.classCode}</span>}
                            </div>
                          </div>

                          {r.htmlUrl && (
                            <a
                              href={r.htmlUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                              title="GitHub 저장소 보기"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
