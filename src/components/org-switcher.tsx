"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ExternalLink,
  ArrowRightLeft,
  Plus,
  Loader2,
  X,
  AlertCircle,
} from "lucide-react";
import type { OrganizationOption } from "@/lib/org/active-org";

interface OrganizationSwitcherProps {
  activeOrg: string;
  organizations: OrganizationOption[];
  basePath: "/dashboard" | "/admin";
  role?: "student" | "staff";
}

function cleanOrgInput(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/+$/, "")
    .split("/")[0]
    .trim();
}

export function OrganizationSwitcher({
  activeOrg,
  organizations,
  basePath,
  role = "student",
}: OrganizationSwitcherProps) {
  const router = useRouter();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customOrg, setCustomOrg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSelectOrg = async (rawTarget: string) => {
    const targetOrg = cleanOrgInput(rawTarget);
    if (!targetOrg) {
      setErrorMsg("이동할 GitHub Organization 이름이나 URL을 입력해주세요.");
      return;
    }
    if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(targetOrg)) {
      setErrorMsg(
        "유효한 GitHub Organization 형식이 아닙니다. (예: 2026-2-WebService)"
      );
      return;
    }

    setErrorMsg("");
    setSwitchingTo(targetOrg);

    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName: targetOrg }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Organization 전환에 실패했습니다.");
      }

      const finalOrg = data.activeOrg || targetOrg;
      setShowCustomInput(false);
      setCustomOrg("");
      router.push(`${basePath}?org=${encodeURIComponent(finalOrg)}`);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "Organization 전환 중 오류가 발생했습니다.");
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Current Active Organization Info */}
        <div className="flex items-start sm:items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                현재 선택된 GitHub Organization
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600/20">
                <span>{activeOrg}</span>
              </span>
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
              {role === "staff"
                ? "아래 목록에서 다른 수업/학기 Organization을 선택하거나 이름을 직접 입력해 해당 Organization의 과제를 관리할 수 있습니다."
                : "수강 중인 다른 수업/분반의 GitHub Organization으로 전환하여 해당 Organization의 내 과제 저장소를 확인할 수 있습니다."}
            </p>
          </div>
        </div>

        {/* Right: Button to toggle custom Organization input */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowCustomInput((prev) => !prev);
              setErrorMsg("");
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition shadow-sm ${
              showCustomInput
                ? "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                : "border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
            }`}
          >
            {showCustomInput ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>입력창 닫기</span>
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>다른 Organization 직접 입력·이동</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Organization Pills Bar */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <span className="text-[11px] font-semibold text-slate-400 mr-1">
          빠른 전환:
        </span>
        {organizations.map((org) => {
          const isCurrent =
            org.name.toLowerCase() === activeOrg.toLowerCase();
          const isLoadingThis =
            switchingTo?.toLowerCase() === org.name.toLowerCase();

          return (
            <button
              key={org.name}
              type="button"
              disabled={Boolean(switchingTo)}
              onClick={() => {
                if (!isCurrent) {
                  handleSelectOrg(org.name);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                isCurrent
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-600 dark:hover:text-indigo-400"
              } disabled:opacity-60`}
            >
              {isLoadingThis ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : isCurrent ? (
                <Check className="w-3 h-3 stroke-[2.5]" />
              ) : (
                <Building2 className="w-3 h-3 opacity-60" />
              )}
              <span>{org.name}</span>
              {org.assignmentCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isCurrent
                      ? "bg-indigo-700 text-indigo-100"
                      : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  과제 {org.assignmentCount}
                </span>
              )}
            </button>
          );
        })}

        {!showCustomInput && (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
          >
            <Plus className="w-3 h-3" />
            <span>Organization 추가/이동</span>
          </button>
        )}
      </div>

      {/* Custom Organization Input Form */}
      {showCustomInput && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSelectOrg(customOrg);
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80"
        >
          <input
            type="text"
            value={customOrg}
            onChange={(e) => setCustomOrg(e.target.value)}
            placeholder="이동할 GitHub Organization 이름 또는 URL 입력 (예: 2026-1-WebService 또는 https://github.com/...)"
            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
            disabled={Boolean(switchingTo)}
            autoFocus
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={Boolean(switchingTo) || !customOrg.trim()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-sm disabled:opacity-50"
            >
              {switchingTo ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-3.5 h-3.5" />
              )}
              <span>해당 Organization 대시보드로 이동</span>
            </button>
            {customOrg.trim() && (
              <a
                href={`https://github.com/${encodeURIComponent(
                  cleanOrgInput(customOrg)
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <span>GitHub에서 보기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </form>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/60 px-3 py-2 text-xs text-red-600 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
}
