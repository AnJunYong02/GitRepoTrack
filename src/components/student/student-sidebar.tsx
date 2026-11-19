"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Repeat2,
  Shield,
  User,
} from "lucide-react";

import { SIDEBAR_COOKIE } from "@/components/student/sidebar-cookie";

export interface StudentSidebarProps {
  activeOrg: string;
  orgAvatarUrl?: string | null;
  isOwner: boolean;
  githubLogin?: string | null;
  avatarUrl?: string | null;
  /** 사이드바 하단 "과제 상태" 숫자 (없으면 카드를 숨김) */
  status?: { satisfied: number; unmet: number; pending: number };
  /** 현재 화면이 학생 대시보드면 "dashboard" (분석 대시보드 등 하위 화면은 "none") */
  active?: "dashboard" | "none";
  /** 쿠키에 저장된 접기 상태 (서버에서 전달) */
  defaultCollapsed?: boolean;
}

const SECTION_LABEL = "px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";
const NAV_BASE = "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition";
const NAV_ITEM = `${NAV_BASE} text-ink/80 hover:text-ink hover:bg-surface-raised/60`;
const NAV_ITEM_ACTIVE = `${NAV_BASE} font-medium text-ink bg-surface-raised shadow-neu-sm ring-1 ring-white/70 dark:ring-white/5`;

/** 접힌 상태에서 아이콘 오른쪽에 뜨는 말풍선 (데스크톱만) */
function Tip({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-xl bg-surface px-3 py-1.5 text-xs font-medium text-ink shadow-neu-sm lg:group-hover:block lg:group-focus-visible:block"
    >
      {children}
    </span>
  );
}

/** 학생 대시보드 왼쪽 사이드바 (모바일에서는 상단 카드, 데스크톱에서는 접기/펼치기 가능) */
export function StudentSidebar({
  activeOrg,
  orgAvatarUrl,
  isOwner,
  githubLogin,
  avatarUrl,
  status,
  active = "dashboard",
  defaultCollapsed = false,
}: StudentSidebarProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    // 1년 유지, 모든 경로에서 공유 (학생 대시보드 ↔ 분석 대시보드)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
  };

  // 접힘은 데스크톱(lg 이상)에서만 적용. 모바일 클래스에는 영향 없음
  const c = collapsed;
  const hideWhenCollapsed = c ? "lg:hidden" : "";
  const centerWhenCollapsed = c ? "lg:justify-center lg:px-0" : "";
  const dashboardHref = `/dashboard?org=${encodeURIComponent(activeOrg)}`;
  const orgGithubHref = `https://github.com/${encodeURIComponent(activeOrg)}`;

  return (
    <div
      className={`relative lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:shrink-0 lg:transition-[width] lg:duration-300 ${
        c ? "lg:w-20" : "lg:w-64"
      }`}
    >
      <aside
        aria-label="대시보드 메뉴"
        className={`flex h-full flex-col gap-6 rounded-[28px] bg-surface shadow-neu ${
          c ? "p-5 lg:items-center lg:px-3 lg:overflow-visible" : "p-5 lg:overflow-y-auto"
        }`}
      >
        {/* 로고 + (모바일) 프로필 */}
        <div className={`flex items-center justify-between gap-3 ${centerWhenCollapsed}`}>
          <Link href="/" className="group relative flex items-center gap-2 px-1" aria-label="GitRepoTrack 홈">
            <GitBranch className="h-5 w-5 shrink-0 text-lilac-ink" />
            <span className={`text-sm font-bold uppercase tracking-[0.18em] text-ink ${hideWhenCollapsed}`}>
              GitRepoTrack
            </span>
            <Tip show={c}>GitRepoTrack 홈</Tip>
          </Link>
          <div className="lg:hidden">
            <ProfileRow githubLogin={githubLogin} avatarUrl={avatarUrl} isOwner={isOwner} activeOrg={activeOrg} />
          </div>
        </div>

        {/* 메뉴 */}
        <nav aria-label="학생 메뉴" className={`space-y-5 ${c ? "lg:w-full" : ""}`}>
          <div className="space-y-2">
            <p className={`${SECTION_LABEL} ${hideWhenCollapsed}`}>Workspace</p>
            {c && <div className="mx-auto hidden h-px w-8 bg-muted/25 lg:block" aria-hidden />}
            <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
              <Link
                href={dashboardHref}
                aria-current={active === "dashboard" ? "page" : undefined}
                aria-label="대시보드"
                className={`${active === "dashboard" ? NAV_ITEM_ACTIVE : NAV_ITEM} shrink-0 ${centerWhenCollapsed}`}
              >
                <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
                <span className={hideWhenCollapsed}>대시보드</span>
                <Tip show={c}>대시보드</Tip>
              </Link>
              <Link
                href="/dashboard"
                title={c ? undefined : "다른 Organization 선택 또는 새로 등록하기"}
                aria-label="Organization 변경"
                className={`${NAV_ITEM} shrink-0 ${centerWhenCollapsed}`}
              >
                <Repeat2 className="h-[18px] w-[18px] shrink-0" />
                <span className={hideWhenCollapsed}>Organization 변경</span>
                <Tip show={c}>Organization 변경</Tip>
              </Link>
            </div>
          </div>

          {isOwner && (
            <div className="space-y-2">
              <p className={`${SECTION_LABEL} ${hideWhenCollapsed}`}>Management</p>
              {c && <div className="mx-auto hidden h-px w-8 bg-muted/25 lg:block" aria-hidden />}
              <Link
                href={`/admin?org=${encodeURIComponent(activeOrg)}`}
                aria-label="관리자 대시보드"
                className={`${NAV_ITEM} ${centerWhenCollapsed}`}
              >
                <Shield className="h-[18px] w-[18px] shrink-0" />
                <span className={hideWhenCollapsed}>관리자 대시보드</span>
                <Tip show={c}>관리자 대시보드</Tip>
              </Link>
            </div>
          )}
        </nav>

        {/* 현재 Organization */}
        <div className="space-y-2">
          <p className={`${SECTION_LABEL} ${hideWhenCollapsed}`}>Organization</p>
          {c && <div className="mx-auto hidden h-px w-8 bg-muted/25 lg:block" aria-hidden />}

          {/* 접힌 상태(데스크톱): 아바타만, 클릭 시 GitHub org 새 창 */}
          {c && (
            <a
              href={orgGithubHref}
              target="_blank"
              rel="noreferrer"
              aria-label={`${activeOrg} GitHub Organization 페이지 새 창으로 열기`}
              className="group relative mx-auto hidden h-11 w-11 items-center justify-center rounded-2xl shadow-neu-inset lg:flex"
            >
              <OrgAvatar url={orgAvatarUrl} name={activeOrg} />
              {isOwner && (
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  <Shield className="h-2.5 w-2.5" />
                </span>
              )}
              <Tip show>
                {activeOrg}
                {isOwner ? " · Owner" : ""} · GitHub 열기
              </Tip>
            </a>
          )}

          {/* 펼친 상태 (모바일은 항상 이 모양) */}
          <div className={`flex items-center gap-3 rounded-2xl p-3 shadow-neu-inset ${hideWhenCollapsed}`}>
            <OrgAvatar url={orgAvatarUrl} name={activeOrg} />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold text-ink" title={activeOrg}>
                {activeOrg}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {isOwner && (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300">
                    <Shield className="h-3 w-3" />
                    Owner
                  </span>
                )}
                <a
                  href={orgGithubHref}
                  target="_blank"
                  rel="noreferrer"
                  title={`${activeOrg} GitHub Organization 페이지 새 창으로 열기`}
                  className="inline-flex items-center gap-1 text-muted hover:text-ink"
                >
                  GitHub 열기
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 하단: 과제 상태 + 프로필 */}
        <div className={`mt-auto space-y-4 ${c ? "lg:w-full" : ""}`}>
          {status && (
            <div className={`rounded-2xl bg-surface p-4 shadow-neu-sm ${c ? "lg:px-0 lg:py-3" : ""}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] text-muted ${hideWhenCollapsed}`}>
                과제 상태
              </p>
              <ul className={`mt-2 space-y-1.5 text-sm text-ink/80 ${c ? "lg:mt-0 lg:space-y-2" : ""}`}>
                {[
                  { dot: "bg-accent", value: status.satisfied, label: "충족" },
                  { dot: "bg-amber-500", value: status.unmet, label: "미충족" },
                  { dot: "bg-muted", value: status.pending, label: "분석 필요" },
                ].map((row) => (
                  <li
                    key={row.label}
                    className={`group relative flex items-center gap-2 ${c ? "lg:justify-center" : ""}`}
                    aria-label={c ? `${row.label} ${row.value}개` : undefined}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${row.dot}`} />
                    <strong className="font-semibold text-ink">{row.value}</strong>
                    <span className={hideWhenCollapsed}>{row.label}</span>
                    <Tip show={c}>
                      {row.label} {row.value}개
                    </Tip>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="hidden lg:block">
            {c ? (
              <div className="flex flex-col items-center gap-2">
                <span className="group relative" aria-label={`${githubLogin ?? ""}${isOwner ? " (Owner)" : ""}`}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={githubLogin ?? ""} className="h-8 w-8 rounded-full shadow-neu-sm" />
                  ) : (
                    <User className="h-5 w-5 text-muted" />
                  )}
                  <Tip show>
                    {githubLogin}
                    {isOwner ? " · OWNER" : ""}
                  </Tip>
                </span>
                <LogoutButton />
              </div>
            ) : (
              <ProfileRow githubLogin={githubLogin} avatarUrl={avatarUrl} isOwner={isOwner} activeOrg={activeOrg} />
            )}
          </div>
        </div>
      </aside>

      {/* 사이드바 옆 접기/펼치기 버튼 (데스크톱만) */}
      <button
        type="button"
        onClick={toggle}
        aria-label={c ? "사이드바 펼치기" : "사이드바 접기"}
        title={c ? "사이드바 펼치기" : "사이드바 접기"}
        aria-expanded={!c}
        className="absolute -right-3.5 top-10 z-10 hidden h-7 w-7 items-center justify-center rounded-full bg-surface text-muted shadow-neu-sm transition hover:text-ink hover:shadow-neu-inset lg:flex"
      >
        {c ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </div>
  );
}

function OrgAvatar({ url, name }: { url?: string | null; name: string }) {
  return url ? (
    <img src={url} alt={name} className="h-9 w-9 shrink-0 rounded-xl" />
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lilac text-lilac-ink">
      <Building2 className="h-4 w-4" />
    </div>
  );
}

/** Navbar와 같은 /auth/signout 폼 */
function LogoutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        title="로그아웃"
        aria-label="로그아웃"
        className="rounded-xl p-2 text-muted transition hover:text-ink hover:shadow-neu-sm"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </form>
  );
}

/** 아바타 · GitHub 아이디 · OWNER 배지 · 로그아웃 */
function ProfileRow({
  githubLogin,
  avatarUrl,
  isOwner,
  activeOrg,
}: Pick<StudentSidebarProps, "githubLogin" | "avatarUrl" | "isOwner" | "activeOrg">) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl px-1">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        {avatarUrl ? (
          <img src={avatarUrl} alt={githubLogin ?? ""} className="h-7 w-7 shrink-0 rounded-full shadow-neu-sm" />
        ) : (
          <User className="h-4 w-4 text-muted" />
        )}
        <span className="hidden truncate font-medium text-ink sm:inline">{githubLogin}</span>
        {isOwner && (
          <span
            className="shrink-0 rounded-md bg-lilac px-1.5 py-0.5 text-[10px] font-bold text-lilac-ink"
            title={`${activeOrg} Organization의 Owner`}
          >
            OWNER
          </span>
        )}
      </div>
      <LogoutButton />
    </div>
  );
}
