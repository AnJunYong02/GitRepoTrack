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

export function OrgRepoBrowser() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [importingCat, setImportingCat] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgName, setOrgName] = useState("2026-2-WebService");
  const [totalRepos, setTotalRepos] = useState(0);
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/org-repos");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "조직 저장소 목록 조회 실패");
      }
      setOrgName(data.orgName);
      setTotalRepos(data.totalRepos);
      setCategories(data.categories || []);

      // Expand the first 2 student categories by default
      const initialExpanded: Record<string, boolean> = {};
      data.categories?.slice(0, 2).forEach((c: CategoryData) => {
        initialExpanded[c.category] = true;
      });
      setExpandedCats(initialExpanded);
    } catch (err: any) {
      setErrorMsg(err.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>새로고침</span>
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
        {loading && categories.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span>Organization 저장소(275개)를 분석 및 분류하는 중입니다...</span>
          </div>
        ) : filteredCategories.length === 0 ? (
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
