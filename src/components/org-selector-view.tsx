"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Shield,
  GraduationCap,
  ArrowRight,
  ExternalLink,
  Loader2,
  ChevronDown,
  AlertCircle,
  FolderGit2,
  Search,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import type { OrganizationOption } from "@/lib/org/active-org";

interface OrgSelectorViewProps {
  organizations: OrganizationOption[];
  githubLogin?: string;
}

export function OrgSelectorView({
  organizations: initialOrganizations,
  githubLogin,
}: OrgSelectorViewProps) {
  const router = useRouter();
  const [organizations, setOrganizations] =
    useState<OrganizationOption[]>(initialOrganizations);
  const [selectingOrg, setSelectingOrg] = useState<string | null>(null);
  const [toggleOpen, setToggleOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const handleEnterOrganization = async (
    orgNameInput: string,
    isOwnerHint = false
  ) => {
    const cleanName = orgNameInput.trim();
    if (!cleanName) return;

    setErrorMsg("");
    setInfoMsg("");
    setSelectingOrg(cleanName);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: cleanName,
          registerAsOwner: isOwnerHint,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Organization 연결에 실패했습니다.");
      }

      const destination =
        data.targetPath ||
        (isOwnerHint
          ? `/admin?org=${encodeURIComponent(cleanName)}`
          : `/dashboard?org=${encodeURIComponent(cleanName)}`);

      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 이동 중 오류가 발생했습니다.");
      setSelectingOrg(null);
    }
  };

  const handleScanOrganizations = async (queryOverride?: string) => {
    setIsScanning(true);
    setErrorMsg("");
    setInfoMsg("");
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();

    try {
      const res = await fetch(
        `/api/organizations?refresh=1${q ? `&q=${encodeURIComponent(q)}` : ""}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Organization 검색에 실패했습니다.");
      }
      if (Array.isArray(data.organizations)) {
        setOrganizations(data.organizations);
        setInfoMsg(
          q
            ? `"${q}" 검색을 포함하여 총 ${data.organizations.length}개의 연결 가능한 Organization을 불러왔습니다.`
            : `내 GitHub 계정과 연결된 최신 Organization 목록(${data.organizations.length}개)을 불러왔습니다.`
        );
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 스캔 중 오류가 발생했습니다.");
    } finally {
      setIsScanning(false);
    }
  };

  const trimmedQuery = searchQuery.trim();
  const filteredOrganizations = organizations.filter((org) => {
    if (!trimmedQuery) return true;
    const q = trimmedQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      (org.description || "").toLowerCase().includes(q)
    );
  });

  const exactMatchExists = organizations.some(
    (org) => org.name.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const canConnectNewSlug =
    trimmedQuery.length >= 2 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(trimmedQuery) &&
    !exactMatchExists;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/70 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Building2 className="w-3.5 h-3.5" />
              <span>
                {githubLogin ? `@${githubLogin} 계정 연동` : "GitHub 계정 연동"} · 수업 Organization 선택
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              이동할 GitHub Organization을 선택해주세요
            </h1>
          </div>

          {/* Quick Toggle Dropdown Selector */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setToggleOpen((prev) => !prev)}
              aria-expanded={toggleOpen}
              disabled={Boolean(selectingOrg)}
              className="inline-flex w-full sm:w-auto items-center justify-between gap-2.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm disabled:opacity-60"
            >
              <Building2 className="w-4 h-4" />
              <span>내 Organization 선택 ({organizations.length})</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  toggleOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {toggleOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 z-50 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  연결된 Organization 선택
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {organizations.map((org) => (
                    <button
                      key={org.name}
                      type="button"
                      disabled={Boolean(selectingOrg)}
                      onClick={() => {
                        setToggleOpen(false);
                        handleEnterOrganization(org.name, org.isOwner);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-indigo-50/50 dark:hover:bg-slate-800/60 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {org.name}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {org.isOwner
                            ? "👑 Owner (관리자 대시보드 진입)"
                            : "🎓 학생 (내 과제 목록 진입)"}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Search & Connect New Organization Bar */}
        <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/60 bg-slate-50/80 dark:bg-slate-950/60 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              <span>내 계정과 연결된 Organization 검색 및 새 Organization 등록</span>
            </span>
            <button
              type="button"
              onClick={() => handleScanOrganizations("")}
              disabled={isScanning || Boolean(selectingOrg)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? "animate-spin" : ""}`} />
              <span>내 GitHub 계정 Organization 전체 다시 스캔</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                aria-label="연결할 GitHub Organization 이름 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.nativeEvent.isComposing) return;
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleScanOrganizations(searchQuery);
                  }
                }}
                placeholder="연결할 Organization 이름 입력 또는 검색 (예: 2026-2-WebService)..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 pl-10 pr-16 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600"
                >
                  지우기
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleScanOrganizations(searchQuery)}
              disabled={isScanning || Boolean(selectingOrg)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition shrink-0 disabled:opacity-50"
            >
              {isScanning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              <span>GitHub에서 검색</span>
            </button>

            {canConnectNewSlug && (
              <button
                type="button"
                onClick={() => handleEnterOrganization(trimmedQuery, true)}
                disabled={Boolean(selectingOrg)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-xs shrink-0 disabled:opacity-50"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>&ldquo;{trimmedQuery}&rdquo; 바로 등록 및 연결</span>
              </button>
            )}
          </div>
        </div>

        {infoMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{infoMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/60 p-3 text-xs text-red-600 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Organization Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredOrganizations.map((org) => {
          const isSelectingThis =
            selectingOrg?.toLowerCase() === org.name.toLowerCase();

          return (
            <div
              key={org.name}
              onClick={() => {
                if (!selectingOrg) {
                  handleEnterOrganization(org.name, org.isOwner);
                }
              }}
              className={`group relative rounded-2xl border p-5 sm:p-6 bg-white dark:bg-slate-900 shadow-sm transition cursor-pointer flex flex-col justify-between gap-4 ${
                org.isOwner
                  ? "border-indigo-200/80 dark:border-indigo-900/60 hover:border-indigo-500 hover:shadow-md"
                  : "border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:shadow-md"
              } ${selectingOrg && !isSelectingThis ? "opacity-50 pointer-events-none" : ""}`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {org.avatarUrl ? (
                      <img
                        src={org.avatarUrl}
                        alt={org.name}
                        className="h-12 w-12 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${
                          org.isOwner
                            ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400"
                            : "bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        <Building2 className="w-6 h-6" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {org.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {org.isOwner ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20">
                            <Shield className="w-3 h-3" />
                            <span>Organization Owner (관리자)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20">
                            <GraduationCap className="w-3 h-3" />
                            <span>학생 (Member)</span>
                          </span>
                        )}
                        {org.assignmentCount > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <FolderGit2 className="w-3 h-3" />
                            <span>등록된 과제 {org.assignmentCount}개</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <a
                    href={org.htmlUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition shrink-0"
                    title="GitHub Organization 페이지 열기"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>

                {org.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {org.description}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {org.isOwner
                    ? "클릭 시 관리자 과제 관리 대시보드가 열립니다"
                    : "클릭 시 내 과제 제출 현황 대시보드가 열립니다"}
                </span>

                <button
                  type="button"
                  disabled={Boolean(selectingOrg)}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEnterOrganization(org.name, org.isOwner);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition shadow-xs ${
                    org.isOwner
                      ? "bg-indigo-600 group-hover:bg-indigo-500"
                      : "bg-blue-600 group-hover:bg-blue-500"
                  }`}
                >
                  {isSelectingThis ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>이동 중...</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {org.isOwner ? "관리자 대시보드 입장" : "과제 목록 입장"}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
