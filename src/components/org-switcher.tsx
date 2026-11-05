"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Check,
  ChevronDown,
  ExternalLink,
  Loader2,
  Shield,
  GraduationCap,
  LayoutGrid,
  AlertCircle,
  Search,
  RefreshCw,
  PlusCircle,
} from "lucide-react";
import type { OrganizationOption } from "@/lib/org/active-org";

interface OrganizationSwitcherProps {
  activeOrg: string;
  organizations: OrganizationOption[];
  basePath: "/dashboard" | "/admin";
  role?: "student" | "staff";
}

export function OrganizationSwitcher({
  activeOrg,
  organizations: initialOrganizations,
  basePath,
  role = "student",
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const [organizations, setOrganizations] =
    useState<OrganizationOption[]>(initialOrganizations);
  const [isOpen, setIsOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOrganizations(initialOrganizations);
  }, [initialOrganizations]);

  const currentOrgObj = organizations.find(
    (o) => o.name.toLowerCase() === activeOrg.toLowerCase()
  );
  const isCurrentOrgOwner = currentOrgObj?.isOwner ?? role === "staff";

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleSelectOrg = async (orgNameInput: string, isOwnerHint = false) => {
    const cleanName = orgNameInput.trim();
    if (!cleanName) return;

    setErrorMsg("");
    setSwitchingTo(cleanName);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: cleanName,
          registerAsOwner: isOwnerHint || role === "staff",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Organization 전환에 실패했습니다.");
      }

      setIsOpen(false);
      const destination =
        data.targetPath ||
        (isOwnerHint
          ? `/admin?org=${encodeURIComponent(cleanName)}`
          : `${basePath}?org=${encodeURIComponent(cleanName)}`);

      router.push(destination);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 전환 중 오류가 발생했습니다.");
    } finally {
      setSwitchingTo(null);
    }
  };

  const handleScanOrgs = async (queryOverride?: string) => {
    setIsScanning(true);
    setErrorMsg("");
    const q = (queryOverride !== undefined ? queryOverride : searchQuery).trim();
    try {
      const res = await fetch(
        `/api/organizations?refresh=1&org=${encodeURIComponent(activeOrg)}${
          q ? `&q=${encodeURIComponent(q)}` : ""
        }`
      );
      const data = await res.json();
      if (res.ok && Array.isArray(data.organizations)) {
        setOrganizations(data.organizations);
      }
    } catch {
      // ignore
    } finally {
      setIsScanning(false);
    }
  };

  const trimmedQuery = searchQuery.trim();
  const filteredOrganizations = organizations.filter((org) => {
    if (!trimmedQuery) return true;
    return org.name.toLowerCase().includes(trimmedQuery.toLowerCase());
  });
  const exactMatchExists = organizations.some(
    (org) => org.name.toLowerCase() === trimmedQuery.toLowerCase()
  );
  const canConnectNewSlug =
    trimmedQuery.length >= 2 &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(trimmedQuery) &&
    !exactMatchExists;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Current Organization Info */}
        <div className="flex items-start sm:items-center gap-3">
          {currentOrgObj?.avatarUrl ? (
            <img
              src={currentOrgObj.avatarUrl}
              alt={activeOrg}
              className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                현재 선택된 Organization
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600/20">
                <span>{activeOrg}</span>
              </span>
              {isCurrentOrgOwner ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20">
                  <Shield className="w-3 h-3" />
                  <span>Owner (관리자)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/70 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20">
                  <GraduationCap className="w-3 h-3" />
                  <span>학생 (Member)</span>
                </span>
              )}
              <a
                href={`https://github.com/${encodeURIComponent(activeOrg)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-300 transition"
                title={`${activeOrg} GitHub Organization 페이지 새 창으로 열기`}
              >
                <span>GitHub 열기</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              우측 토글에서 내 계정과 연결된 Organization을 검색하거나 새로운 Organization을 등록해 이동할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Right: Toggle Dropdown Button for User's Connected GitHub Organizations */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            disabled={Boolean(switchingTo)}
            className="inline-flex w-full sm:w-auto items-center justify-between gap-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition shadow-sm disabled:opacity-60"
          >
            <div className="flex items-center gap-2">
              {switchingTo ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              )}
              <span>
                {switchingTo
                  ? `${switchingTo} 이동 중...`
                  : `내 연결 Organization 전환·등록 (${organizations.length})`}
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-150 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Toggle Dropdown Menu */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl ring-1 ring-black/5 z-50 overflow-hidden">
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    연결된 Organization 검색 및 새 등록
                  </span>
                  <button
                    type="button"
                    onClick={() => handleScanOrgs(searchQuery)}
                    disabled={isScanning}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`w-2.5 h-2.5 ${isScanning ? "animate-spin" : ""}`}
                    />
                    <span>GitHub 다시 스캔</span>
                  </button>
                </div>

                {/* Search Input inside Dropdown */}
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      aria-label="Organization 검색 또는 새 Organization 이름 입력"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleScanOrgs(searchQuery);
                        }
                      }}
                      placeholder="Organization 이름 검색·등록..."
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 pl-8 pr-2 text-xs placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleScanOrgs(searchQuery)}
                    disabled={isScanning}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 shrink-0"
                  >
                    검색
                  </button>
                </div>

                {canConnectNewSlug && (
                  <button
                    type="button"
                    onClick={() => handleSelectOrg(trimmedQuery, role === "staff")}
                    disabled={Boolean(switchingTo)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 py-1.5 px-3 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>&ldquo;{trimmedQuery}&rdquo; 새 Organization 연결 및 이동</span>
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredOrganizations.map((org) => {
                  const isCurrent =
                    org.name.toLowerCase() === activeOrg.toLowerCase();
                  const isLoadingThis =
                    switchingTo?.toLowerCase() === org.name.toLowerCase();

                  return (
                    <button
                      key={org.name}
                      type="button"
                      disabled={Boolean(switchingTo)}
                      onClick={() => handleSelectOrg(org.name, org.isOwner)}
                      className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition ${
                        isCurrent
                          ? "bg-indigo-50/70 dark:bg-indigo-950/40"
                          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {org.avatarUrl ? (
                          <img
                            src={org.avatarUrl}
                            alt={org.name}
                            className="h-8 w-8 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-xs font-bold truncate ${
                                isCurrent
                                  ? "text-indigo-700 dark:text-indigo-300"
                                  : "text-slate-800 dark:text-slate-200"
                              }`}
                            >
                              {org.name}
                            </span>
                            {org.assignmentCount > 0 && (
                              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[10px] font-semibold text-slate-500">
                                과제 {org.assignmentCount}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {org.isOwner ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                                <Shield className="w-2.5 h-2.5" />
                                <span>Owner · 관리자 대시보드</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                                <GraduationCap className="w-2.5 h-2.5" />
                                <span>학생 · 내 과제 대시보드</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isLoadingThis ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        ) : isCurrent ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            <Check className="w-3 h-3 stroke-[2.5]" />
                            <span>선택됨</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            이동 →
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="p-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
                <Link
                  href="/dashboard"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Organization 선택 및 새 등록 화면으로</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/60 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
