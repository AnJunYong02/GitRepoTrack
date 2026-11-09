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
  AlertCircle,
  FolderGit2,
  Search,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Trash2,
  Info,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { OrganizationOption } from "@/lib/org/active-org";

interface OrgSelectorViewProps {
  organizations: OrganizationOption[];
  githubLogin?: string;
}

const ORG_SLUG_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

function OrgAvatar({ org, size }: { org: OrganizationOption; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 rounded-xl" : "h-9 w-9 rounded-lg";
  if (org.avatarUrl) {
    return (
      <img
        src={org.avatarUrl}
        alt={org.name}
        className={`${box} border border-slate-200 dark:border-slate-700 shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${box} flex items-center justify-center shrink-0 ${
        org.isOwner
          ? "bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400"
          : "bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400"
      }`}
    >
      <Building2 className={size === "lg" ? "w-6 h-6" : "w-4 h-4"} />
    </div>
  );
}

function RoleBadge({ isOwner }: { isOwner: boolean }) {
  return isOwner ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20">
      <Shield className="w-3 h-3" />
      <span>Owner (관리자)</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/80 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20">
      <GraduationCap className="w-3 h-3" />
      <span>학생 (Member)</span>
    </span>
  );
}

export function OrgSelectorView({
  organizations: initialOrganizations,
  githubLogin,
}: OrgSelectorViewProps) {
  const router = useRouter();
  const [organizations, setOrganizations] =
    useState<OrganizationOption[]>(initialOrganizations);
  // 현재 처리 중인 org 이름 (입장/등록/삭제 버튼 중복 클릭 방지)
  const [busyOrg, setBusyOrg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [infoMsg, setInfoMsg] = useState("");

  const isBusy = Boolean(busyOrg) || isReconnecting;

  const fetchOrganizations = async (query = "", forceRefresh = false) => {
    const params = new URLSearchParams();
    if (forceRefresh) params.set("refresh", "1");
    if (query) params.set("q", query);
    const res = await fetch(`/api/organizations?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Organization 목록 조회에 실패했습니다.");
    }
    if (Array.isArray(data.organizations)) {
      setOrganizations(data.organizations);
    }
    return data.organizations as OrganizationOption[];
  };

  const resetMessages = () => {
    setErrorMsg("");
    setInfoMsg("");
  };

  // 등록된 org 카드에서 대시보드로 입장
  const handleEnter = async (org: OrganizationOption) => {
    resetMessages();
    setBusyOrg(org.name);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: org.name, action: "enter" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Organization 입장에 실패했습니다.");
      }
      router.push(
        data.targetPath ||
          (org.isOwner
            ? `/admin?org=${encodeURIComponent(org.name)}`
            : `/dashboard?org=${encodeURIComponent(org.name)}`)
      );
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 이동 중 오류가 발생했습니다.");
      setBusyOrg(null);
    }
  };

  // 목록의 org를 대시보드 카드로 등록 (이동하지 않음)
  const handleRegister = async (orgName: string) => {
    resetMessages();
    setBusyOrg(orgName);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, action: "register" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Organization 등록에 실패했습니다.");
      }
      await fetchOrganizations(orgName);
      setInfoMsg(`"${orgName}"을(를) 등록했습니다. 아래 카드에서 대시보드로 입장할 수 있습니다.`);
      setSearchQuery("");
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 등록 중 오류가 발생했습니다.");
    } finally {
      setBusyOrg(null);
    }
  };

  // 등록된 org 카드 삭제 (GitRepoTrack 등록 목록에서만 제거)
  const handleUnregister = async (orgName: string) => {
    const confirmed = window.confirm(
      `"${orgName}"을(를) 대시보드 목록에서 삭제할까요?\n\nGitHub Organization과 과제·학생 데이터는 삭제되지 않으며, 언제든 다시 등록할 수 있습니다.`
    );
    if (!confirmed) return;

    resetMessages();
    setBusyOrg(orgName);
    try {
      const res = await fetch("/api/organizations", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Organization 삭제에 실패했습니다.");
      }
      await fetchOrganizations();
      setInfoMsg(`"${orgName}"을(를) 대시보드 목록에서 삭제했습니다.`);
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 삭제 중 오류가 발생했습니다.");
    } finally {
      setBusyOrg(null);
    }
  };

  const handleSearch = async () => {
    resetMessages();
    setIsScanning(true);
    const q = searchQuery.trim();
    try {
      const orgs = await fetchOrganizations(q, true);
      setInfoMsg(
        q
          ? `"${q}" 검색을 포함해 ${orgs.length}개의 Organization을 불러왔습니다.`
          : `Organization 목록(${orgs.length}개)을 새로 불러왔습니다.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 검색 중 오류가 발생했습니다.");
    } finally {
      setIsScanning(false);
    }
  };

  // GitHub OAuth를 다시 거쳐 새 토큰으로 내 org 멤버십 전체를 다시 읽어 온다
  const handleReconnectGitHub = async () => {
    resetMessages();
    setIsReconnecting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          scopes: "read:user user:email read:org",
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || "GitHub 다시 연결 중 오류가 발생했습니다.");
      setIsReconnecting(false);
    }
  };

  const trimmedQuery = searchQuery.trim();
  const listedOrganizations = organizations.filter((org) => {
    if (!trimmedQuery) return true;
    const q = trimmedQuery.toLowerCase();
    return (
      org.name.toLowerCase().includes(q) ||
      (org.description || "").toLowerCase().includes(q)
    );
  });
  const registeredOrganizations = organizations.filter((org) => org.isRegistered);

  const canRegisterNewSlug =
    trimmedQuery.length >= 2 &&
    ORG_SLUG_PATTERN.test(trimmedQuery) &&
    !organizations.some((org) => org.name.toLowerCase() === trimmedQuery.toLowerCase());

  return (
    <div className="space-y-6">
      {/* 헤더 + 내 GitHub Organization 목록 */}
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
              내 GitHub Organization
            </h1>
            <p className="text-xs text-slate-500">
              사용할 Organization을 <strong>등록</strong>하면 아래에 대시보드 입장 카드가 생깁니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReconnectGitHub}
            disabled={isBusy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-800 transition shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? "animate-spin" : ""}`} />
            <span>GitHub 다시 연결 (목록 새로고침)</span>
          </button>
        </div>

        {/* 검색 + 이름으로 직접 등록 */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              aria-label="GitHub Organization 이름 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSearch();
                }
              }}
              placeholder="Organization 이름 검색 또는 입력 (예: 2026-2-WebService)"
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
            onClick={handleSearch}
            disabled={isScanning || isBusy}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition shrink-0 disabled:opacity-50"
          >
            {isScanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>GitHub에서 검색</span>
          </button>
          {canRegisterNewSlug && (
            <button
              type="button"
              onClick={() => handleRegister(trimmedQuery)}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shrink-0 disabled:opacity-50"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>&ldquo;{trimmedQuery}&rdquo; 등록</span>
            </button>
          )}
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

        {/* GitHub 설정 화면처럼 행 목록 */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {listedOrganizations.length === 0 ? (
            <p className="p-5 text-center text-xs text-slate-500">
              {trimmedQuery
                ? `"${trimmedQuery}"와(과) 일치하는 Organization이 없습니다.`
                : "불러온 Organization이 없습니다."}
            </p>
          ) : (
            listedOrganizations.map((org) => {
              const isThisBusy = busyOrg?.toLowerCase() === org.name.toLowerCase();
              return (
                <div
                  key={org.name}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <OrgAvatar org={org} size="sm" />
                    <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                      <a
                        href={org.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-bold text-slate-900 dark:text-slate-100 hover:text-indigo-600 truncate"
                      >
                        {org.name}
                      </a>
                      <RoleBadge isOwner={org.isOwner} />
                    </div>
                  </div>

                  {org.isRegistered ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>등록됨</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleRegister(org.name)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shrink-0 disabled:opacity-50"
                    >
                      {isThisBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <PlusCircle className="w-3.5 h-3.5" />
                      )}
                      <span>등록</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-start gap-2 rounded-xl bg-slate-50 dark:bg-slate-950/60 p-3 text-[11px] text-slate-600 dark:text-slate-400">
          <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <p>
            속한 Organization이 목록에 없다면, 해당 Organization이 외부 앱 접근을 제한하고 있기 때문입니다. <br/>
            GitHub → Settings → Applications → Authorized OAuth Apps에서 이 서비스를 선택한 뒤{" "}
            <strong>Organization access</strong>에서 <strong>Grant</strong>(Owner) 또는{" "}
            <strong>Request</strong>(Member)를 누르고, 위의 <strong>GitHub 다시 연결</strong>을 눌러주세요.
          </p>
        </div>
      </div>

      {/* 등록된 Organization 카드 */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">
          등록된 Organization ({registeredOrganizations.length})
        </h2>

        {registeredOrganizations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 p-10 text-center text-xs text-slate-500">
            등록된 Organization이 없습니다. 위 목록에서 <strong>등록</strong>을 눌러주세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {registeredOrganizations.map((org) => {
              const isThisBusy = busyOrg?.toLowerCase() === org.name.toLowerCase();
              return (
                <div
                  key={org.name}
                  className={`group relative rounded-2xl border p-5 sm:p-6 bg-white dark:bg-slate-900 shadow-sm transition flex flex-col justify-between gap-4 ${
                    org.isOwner
                      ? "border-indigo-200/80 dark:border-indigo-900/60 hover:border-indigo-500 hover:shadow-md"
                      : "border-slate-200 dark:border-slate-800 hover:border-blue-500 hover:shadow-md"
                  } ${busyOrg && !isThisBusy ? "opacity-50" : ""}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <OrgAvatar org={org} size="lg" />
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                            {org.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <RoleBadge isOwner={org.isOwner} />
                            {org.assignmentCount > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                <FolderGit2 className="w-3 h-3" />
                                <span>등록된 과제 {org.assignmentCount}개</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <a
                          href={org.htmlUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 transition"
                          title="GitHub Organization 페이지 열기"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => handleUnregister(org.name)}
                          disabled={isBusy}
                          aria-label={`${org.name} 대시보드 목록에서 삭제`}
                          title="대시보드 목록에서 삭제"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-600 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {org.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {org.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {org.isOwner
                        ? "관리자 과제 관리 대시보드가 열립니다"
                        : "내 과제 제출 현황 대시보드가 열립니다"}
                    </span>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleEnter(org)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white transition shrink-0 disabled:opacity-60 ${
                        org.isOwner
                          ? "bg-indigo-600 hover:bg-indigo-500"
                          : "bg-blue-600 hover:bg-blue-500"
                      }`}
                    >
                      {isThisBusy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>처리 중...</span>
                        </>
                      ) : (
                        <>
                          <span>{org.isOwner ? "관리자 대시보드 입장" : "과제 목록 입장"}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
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
