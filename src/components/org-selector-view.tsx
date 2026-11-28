"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Shield,
  ArrowRight,
  ExternalLink,
  Loader2,
  AlertCircle,
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
}

const BTN = "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-semibold transition disabled:opacity-50";
const BTN_GRAY = `${BTN} bg-chip px-4 py-3 text-[13px] text-fg-2 hover:text-fg`;
const BTN_GRAY_SM = `${BTN} bg-chip px-3 py-1.5 text-[12px] text-fg-2 hover:text-fg`;
const BTN_GREEN = `${BTN} bg-brand px-4 py-3 text-[13px] text-white hover:brightness-110`;

function OrgAvatar({ org, size }: { org: OrganizationOption; size: "sm" | "lg" }) {
  const box = size === "lg" ? "h-12 w-12 rounded-xl" : "h-9 w-9 rounded-lg";
  if (org.avatarUrl) {
    return <img src={org.avatarUrl} alt="" className={`${box} shrink-0 bg-chip`} />;
  }
  return (
    <div className={`${box} flex shrink-0 items-center justify-center bg-brand-soft text-brand`}>
      <Building2 className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
    </div>
  );
}

// Owner인 org에만 작은 표시, 아니면 아무 표시도 하지 않는다
function RoleBadge({ isOwner }: { isOwner: boolean }) {
  if (!isOwner) return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-amber-500">
      <Shield className="h-3 w-3" />
      Owner
    </span>
  );
}

export function OrgSelectorView({
  organizations: initialOrganizations,
}: OrgSelectorViewProps) {
  const router = useRouter();
  const [organizations, setOrganizations] =
    useState<OrganizationOption[]>(initialOrganizations);
  // 현재 처리 중인 org 이름 (입장/등록/삭제 버튼 중복 클릭 방지)
  const [busyOrg, setBusyOrg] = useState<string | null>(null);
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

  const registeredOrganizations = organizations.filter((org) => org.isRegistered);

  return (
    <div className="space-y-16">
      {/* 내 GitHub Organization */}
      <section aria-label="내 GitHub Organization" className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[20px] font-bold tracking-tight text-fg">내 과목</h2>
          <div className="flex flex-wrap gap-2">
            <a href="https://github.com/organizations/plan" target="_blank" rel="noreferrer" className={BTN_GREEN}>
              <PlusCircle className="h-4 w-4" /> 과목 추가 <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button type="button" onClick={handleReconnectGitHub} disabled={isBusy} className={BTN_GRAY}>
              <RefreshCw className={`h-3.5 w-3.5 ${isReconnecting ? "animate-spin" : ""}`} />
              GitHub 다시 연결
            </button>
          </div>
        </div>

        {infoMsg && (
          <p role="status" className="flex items-center gap-1.5 text-[13px] text-brand">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {infoMsg}
          </p>
        )}
        {errorMsg && (
          <p role="alert" className="flex items-center gap-1.5 text-[13px] text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </p>
        )}

        <p className="text-[12px] text-fg-3">GitHub에서 과목 조직을 만든 뒤 ‘GitHub 다시 연결’을 눌러 등록하세요.</p>
        {/* Organization 행 목록 */}
        <ul className="divide-y divide-line border-y border-line">
          {organizations.length === 0 ? (
            <li className="py-10 text-center text-[13px] text-fg-3">불러온 Organization이 없습니다.</li>
          ) : (
            organizations.map((org) => {
              const isThisBusy = busyOrg?.toLowerCase() === org.name.toLowerCase();
              return (
                <li key={org.name} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <OrgAvatar org={org} size="sm" />
                    <a
                      href={org.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[15px] font-bold text-fg hover:underline"
                    >
                      {org.name}
                    </a>
                    <RoleBadge isOwner={org.isOwner} />
                  </div>
                  {org.isRegistered ? (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                      등록됨
                    </span>
                  ) : (
                    <button type="button" onClick={() => handleRegister(org.name)} disabled={isBusy} className={BTN_GRAY_SM}>
                      {isThisBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlusCircle className="h-3.5 w-3.5" />}
                      등록
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <p className="flex items-start gap-2 text-[12px] leading-relaxed text-fg-3">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            속한 Organization이 목록에 없다면, 해당 Organization이 외부 앱 접근을 제한하고 있기 때문입니다.
            <br />
            GitHub → Settings → Applications → Authorized OAuth Apps에서 이 서비스를 선택한 뒤{" "}
            <strong className="font-semibold text-fg-2">Organization access</strong>에서{" "}
            <strong className="font-semibold text-fg-2">Grant</strong>(Owner) 또는{" "}
            <strong className="font-semibold text-fg-2">Request</strong>(Member)를 누르고, 위의{" "}
            <strong className="font-semibold text-fg-2">GitHub 다시 연결</strong>을 눌러주세요.
          </span>
        </p>
      </section>

      {/* 등록된 Organization */}
      <section aria-label="등록된 Organization" className="space-y-5">
        <div className="flex items-end justify-between gap-2">
          <h2 className="text-[20px] font-bold tracking-tight text-fg">등록된 Organization</h2>
          <span className="text-[12px] text-fg-3">{registeredOrganizations.length}개</span>
        </div>

        {registeredOrganizations.length === 0 ? (
          <p className="border-y border-line py-12 text-center text-[14px] text-fg-3">
            등록된 Organization이 없습니다. 위 목록에서 <strong className="text-fg-2">등록</strong>을 눌러주세요.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-x-14 border-b border-line md:grid-cols-2">
            {registeredOrganizations.map((org) => {
              const isThisBusy = busyOrg?.toLowerCase() === org.name.toLowerCase();
              return (
                <li
                  key={org.name}
                  className={`flex min-w-0 flex-col gap-5 border-t border-line py-7 transition-opacity ${
                    busyOrg && !isThisBusy ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-4">
                      <OrgAvatar org={org} size="lg" />
                      <div className="min-w-0 space-y-1">
                        <h3 className="truncate text-[20px] font-bold text-fg">{org.name}</h3>
                        <p className="flex flex-wrap items-center gap-2 text-[13px] text-fg-3">
                          <span>등록된 과제 {org.assignmentCount}개</span>
                          <RoleBadge isOwner={org.isOwner} />
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <a
                        href={org.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg p-2 text-fg-3 transition hover:bg-chip hover:text-fg"
                        title="GitHub Organization 페이지 열기"
                        aria-label={`${org.name} GitHub 페이지 열기`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleUnregister(org.name)}
                        disabled={isBusy}
                        aria-label={`${org.name} 대시보드 목록에서 삭제`}
                        title="대시보드 목록에서 삭제"
                        className="rounded-lg p-2 text-fg-3 transition hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {org.description && <p className="line-clamp-2 text-[13px] text-fg-2">{org.description}</p>}

                  <button type="button" disabled={isBusy} onClick={() => handleEnter(org)} className={`${BTN_GREEN} w-fit`}>
                    {isThisBusy ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        처리 중...
                      </>
                    ) : (
                      <>
                        {org.isOwner ? "관리자 대시보드 입장" : "과제 목록 입장"}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
