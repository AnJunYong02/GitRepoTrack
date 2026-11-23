"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getSessionStorage,
  isFresh,
  ORG_REPOS_INVALIDATED_EVENT,
  ORG_REPOS_SESSION_TTL_MS,
  ORG_REPOS_UPDATED_EVENT,
  orgReposSessionKey,
  readSessionCache,
  writeSessionCache,
} from "@/lib/cache/session-cache";
import { ArrowRight, ArrowUpRight, Trophy, Search, PlusCircle, Loader2 } from "lucide-react";
import { ParsedRepoInfo, normalizeCategoryKey } from "@/lib/github/repo-parser";
import { formatAssignmentTitle } from "@/lib/admin/assignment-title";
import { formatKstMonthDay } from "@/lib/student/time-utils";

export interface AdminAssignmentItemData {
  id: string;
  title: string;
  orgName: string;
  branch: string;
  rankingMode: "live" | "none";
  /** 마감 일시 ISO (표시는 KST "11월 24일") */
  deadlineAt: string;
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

/** sessionStorage에 저장하는 org repo 조회 결과 */
interface OrgReposCacheData {
  orgName: string;
  totalRepos: number;
  categories: CategoryData[];
}

export function AdminAssignmentList({
  items,
  activeOrg = "2026-2-WebService",
}: AdminAssignmentListProps) {
  const router = useRouter();
  const [layout, setLayout] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  // loadingOrg: 캐시가 없어 처음 불러오는 중 (진행 표시). 캐시를 보여준 채 뒤에서 갱신할 때는 표시 없음
  const [loadingOrg, setLoadingOrg] = useState(false);
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

  // org repo 조회 결과를 화면 상태에 반영
  const applyOrgReposData = (data: OrgReposCacheData, targetOrg: string) => {
    setOrgName(data.orgName || targetOrg);
    setTotalRepos(data.totalRepos || 0);
    setCategories(data.categories || []);
  };

  /**
   * org repo 목록을 서버에서 조회한다.
   * background=true면 화면의 기존 목록을 유지한 채 뒤에서 갱신한다(로딩 표시 없음).
   */
  const fetchOrgRepos = async (
    targetOrg = activeOrg,
    forceRefresh = false,
    background = false
  ) => {
    if (!background) {
      setLoadingOrg(true);
      setErrorMsg("");
      setOrgName(targetOrg);
    }
    try {
      const refreshParam = forceRefresh ? "&refresh=1" : "";
      const res = await fetch(
        `/api/admin/org-repos?org=${encodeURIComponent(targetOrg)}${refreshParam}`
      );
      const data = await res.json();
      if (!res.ok) {
        if (!background) {
          setCategories([]);
          setTotalRepos(0);
        }
        throw new Error(data.error || "조직 저장소 목록 조회 실패");
      }
      const cacheData: OrgReposCacheData = {
        orgName: data.orgName || targetOrg,
        totalRepos: data.totalRepos || 0,
        categories: data.categories || [],
      };
      applyOrgReposData(cacheData, targetOrg);
      writeSessionCache(getSessionStorage(), orgReposSessionKey(targetOrg), cacheData);
      // 사이드바 "Repo 새로고침 N개"에도 같은 결과를 알림
      window.dispatchEvent(
        new CustomEvent(ORG_REPOS_UPDATED_EVENT, { detail: { orgName: targetOrg, data: cacheData } })
      );
    } catch (err: any) {
      setErrorMsg(err.message || "조직 저장소 조회 중 오류가 발생했습니다.");
    } finally {
      if (!background) setLoadingOrg(false);
    }
  };

  // 진입 시: 같은 탭에서 불러온 목록이 있으면 즉시 보여주고(로딩 없음), 3분이 지났으면 뒤에서 갱신
  useEffect(() => {
    setSuccessMsg("");
    const cached = readSessionCache<OrgReposCacheData>(
      getSessionStorage(),
      orgReposSessionKey(activeOrg)
    );
    if (cached) {
      applyOrgReposData(cached.data, activeOrg);
      if (!isFresh(cached, ORG_REPOS_SESSION_TTL_MS)) {
        fetchOrgRepos(activeOrg, false, true);
      }
    } else {
      fetchOrgRepos(activeOrg, false);
    }
  }, [activeOrg]);

  // 학생 repo 일괄 생성 등으로 org repo가 바뀌었다는 알림을 받으면 뒤에서 다시 조회
  useEffect(() => {
    const onInvalidated = (event: Event) => {
      const changedOrg = (event as CustomEvent<{ orgName?: string }>).detail?.orgName || "";
      if (changedOrg.toLowerCase() === activeOrg.toLowerCase()) {
        fetchOrgRepos(activeOrg, false, true);
      }
    };
    window.addEventListener(ORG_REPOS_INVALIDATED_EVENT, onInvalidated);
    return () => window.removeEventListener(ORG_REPOS_INVALIDATED_EVENT, onInvalidated);
  }, [activeOrg]);

  // 사이드바 "Repo 새로고침"이 새로 받아 온 결과를 그대로 반영 (추가 조회 없음)
  useEffect(() => {
    const onUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ orgName?: string; data?: OrgReposCacheData }>).detail;
      if ((detail?.orgName || "").toLowerCase() === activeOrg.toLowerCase() && detail?.data) {
        applyOrgReposData(detail.data, activeOrg);
        setErrorMsg("");
      }
    };
    window.addEventListener(ORG_REPOS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(ORG_REPOS_UPDATED_EVENT, onUpdated);
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
      // 등록 결과(기존 과제 연결)를 반영: 목록은 유지한 채 뒤에서 갱신
      await fetchOrgRepos(activeOrg, false, true);
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

  const registeredCount = filteredEntries.filter((e) => e.isRegistered).length;

  return (
    <section aria-label="과제 목록" className="space-y-5">
      {/* 제목 · 검색 · 레이아웃 전환 */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h2 className="flex items-baseline gap-2 text-[26px] font-bold tracking-tight text-fg">
          과제 목록
          <span className="text-[24px] font-semibold text-fg-3">{registeredCount}</span>
        </h2>
        <div className="flex items-center gap-3">
          <label className="relative flex-1 md:w-[420px] md:flex-none">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
            <input
              type="text"
              aria-label="저장소 및 과제 검색"
              placeholder="학번, 과제명(예: assign01), 저장소 이름으로 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-chip py-3 pl-10 pr-14 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-fg-3 hover:text-fg"
              >
                지우기
              </button>
            )}
          </label>
          <div role="group" aria-label="과제 목록 레이아웃 선택" className="flex shrink-0 items-center gap-1">
            {(["list", "grid"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleLayoutChange(mode)}
                aria-pressed={layout === mode}
                className={`rounded-lg px-3.5 py-2 text-[13px] font-semibold transition ${
                  layout === mode ? "bg-fg text-canvas" : "text-fg-2 hover:text-fg"
                }`}
              >
                {mode === "list" ? "목록" : "그리드"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 상태 · 메시지 */}
      {loadingOrg && (
        <p role="status" className="flex items-center gap-1.5 text-[13px] text-fg-3">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {orgName} 저장소 목록을 불러오는 중... ({(elapsedMs / 1000).toFixed(1)}초)
        </p>
      )}
      {errorMsg && (
        <p role="alert" className="text-[13px] text-danger">
          {errorMsg}
        </p>
      )}
      {successMsg && (
        <p role="status" className="text-[13px] text-brand">
          {successMsg}
        </p>
      )}

      {/* 검색 중: 일치하는 학생 저장소 */}
      {query && (
        <div className="space-y-2 border-y border-line py-4">
          <p className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-fg">검색된 학생 저장소 {matchedRepos.length}개</span>
            {matchedRepos.length > 24 && <span className="text-[12px] text-fg-3">상위 24개만 표시</span>}
          </p>
          {matchedRepos.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-fg-3">
              &ldquo;{searchQuery}&rdquo;와 일치하는 저장소가 없습니다.
            </p>
          ) : (
            <ul className="grid max-h-72 grid-cols-1 gap-x-8 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {matchedRepos.slice(0, 24).map(({ repo, categoryLabel, assignmentId }) => (
                <li key={repo.repoId} className="flex items-center justify-between gap-2 border-b border-line py-2.5 text-[12px]">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-fg">{repo.name}</p>
                    <p className="truncate text-[11px] text-fg-3">
                      {repo.studentNo && <span className="font-semibold text-fg-2">{repo.studentNo} · </span>}
                      {formatAssignmentTitle(categoryLabel).label}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {assignmentId && (
                      <Link
                        href={`/admin/assignments/${assignmentId}`}
                        className="rounded-md bg-chip px-2 py-1 text-[11px] font-semibold text-fg-2 hover:text-fg"
                      >
                        관리
                      </Link>
                    )}
                    {repo.htmlUrl && (
                      <a
                        href={repo.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-fg-3 hover:text-fg"
                        aria-label={`${repo.name} GitHub 열기`}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 과제 목록 / 그리드 */}
      {filteredEntries.length === 0 ? (
        <p className="border-y border-line py-12 text-center text-[14px] text-fg-3">
          {query ? "검색어와 일치하는 과제가 없습니다." : "등록된 과제가 없습니다. 오른쪽 위 '학생 Repo 일괄 생성'으로 과제를 만들어 주세요."}
        </p>
      ) : (
        <ul className={layout === "grid" ? "grid grid-cols-1 gap-x-12 md:grid-cols-2" : ""}>
          {filteredEntries.map((entry, idx) => (
            <AssignmentEntry
              key={entry.key}
              entry={entry}
              layout={layout}
              highlight={layout === "list" && idx === 0 && entry.isRegistered && !query}
              importingCat={importingCat}
              onImport={handleImportCategory}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

const BTN = "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition disabled:opacity-50";
const BTN_GRAY = `${BTN} bg-chip text-fg-2 hover:text-fg`;
const BTN_GREEN = `${BTN} bg-brand text-white hover:brightness-110`;

/** 과제 한 줄 (목록) 또는 한 칸 (그리드) */
function AssignmentEntry({
  entry,
  layout,
  highlight,
  importingCat,
  onImport,
}: {
  entry: UnifiedAssignmentEntry;
  layout: "list" | "grid";
  highlight: boolean;
  importingCat: string | null;
  onImport: (cat: CategoryData, overrideTitle?: string) => void;
}) {
  const isGrid = layout === "grid";
  const rowClass = isGrid
    ? "flex flex-col gap-5 border-b border-line py-7"
    : `grid grid-cols-1 items-center gap-4 border-b border-line py-6 lg:grid-cols-[minmax(0,1fr)_380px_auto] lg:gap-14 ${
        highlight ? "-mx-5 border-b-0 bg-brand-soft/50 px-5" : ""
      }`;

  // 아직 과제로 등록되지 않은 저장소 묶음
  if (!entry.isRegistered && entry.categoryData) {
    const cat = entry.categoryData;
    const title = formatAssignmentTitle(cat.label, cat.category);
    const isImporting = importingCat === cat.category;
    return (
      <li className={rowClass}>
        <div className="min-w-0 space-y-1.5">
          <p className="flex flex-wrap items-center gap-2 text-[19px] font-bold text-fg">
            {title.label}
            <span className="rounded-md bg-chart/10 px-2 py-0.5 text-[12px] font-semibold text-chart">미등록</span>
          </p>
          <p className="text-[14px] text-fg-3">감지된 학생 저장소 {cat.repos.length}개 · 아직 과제로 등록되지 않았어요</p>
        </div>
        {!isGrid && <div className="hidden lg:block" />}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          <button type="button" onClick={() => onImport(cat)} disabled={isImporting} className={BTN_GREEN}>
            {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
            과제 등록 및 동기화 ({cat.repos.length}개)
          </button>
        </div>
      </li>
    );
  }

  const a = entry.assignment!;
  const cat = entry.categoryData;
  const title = formatAssignmentTitle(a.title, cat?.category);
  const unsyncedCount = cat && cat.repos.length > a.totalStudents ? cat.repos.length - a.totalStudents : 0;
  const isImporting = cat ? importingCat === cat.category : false;
  const percent = a.totalStudents ? Math.round((a.submittedStudents / a.totalStudents) * 100) : 0;

  return (
    <li className={rowClass}>
      {/* 제목 · 마감 · 브랜치 */}
      <div className="min-w-0 space-y-1.5">
        <p className="flex flex-wrap items-center gap-2 text-[19px] font-bold text-fg" title={a.title}>
          {title.label}
          {title.isMidterm && (
            <span className="rounded-md bg-chart/10 px-2 py-0.5 text-[12px] font-semibold text-chart">중간고사</span>
          )}
        </p>
        <p className="text-[14px] text-fg-3">
          {formatKstMonthDay(a.deadlineAt)} 마감 · {a.branch} 브랜치
        </p>
      </div>

      {/* 제출 현황 */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12px] text-fg-3">
            제출 현황
            {a.unanalyzedStudents > 0 && <span className="ml-1.5">· 미분석 {a.unanalyzedStudents}명</span>}
          </span>
          <span className="text-[16px] font-bold tabular-nums text-fg">
            {a.submittedStudents} / {a.totalStudents}명{" "}
            <span className="text-[12px] font-medium text-fg-3">{percent}%</span>
          </span>
        </div>
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-line"
          role="progressbar"
          aria-label="제출 진행률"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {unsyncedCount > 0 && cat && (
          <button type="button" onClick={() => onImport(cat, a.title)} disabled={isImporting} className={BTN_GRAY}>
            {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}+
            {unsyncedCount}명 동기화
          </button>
        )}
        <Link href={`/assignments/${a.id}/leaderboard`} className={BTN_GRAY}>
          <Trophy className="h-4 w-4 text-chart" />
          순위표
        </Link>
        <Link href={`/admin/assignments/${a.id}`} className={BTN_GREEN}>
          과제 관리
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </li>
  );
}
