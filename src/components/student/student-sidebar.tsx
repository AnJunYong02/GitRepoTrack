import Link from "next/link";
import {
  Building2,
  ExternalLink,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Repeat2,
  Shield,
  User,
} from "lucide-react";

export interface StudentSidebarProps {
  activeOrg: string;
  orgAvatarUrl?: string | null;
  isOwner: boolean;
  githubLogin?: string | null;
  avatarUrl?: string | null;
  /** 사이드바 하단 "과제 상태" 숫자 */
  status: { satisfied: number; unmet: number; pending: number };
}

const SECTION_LABEL = "px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted";
const NAV_ITEM =
  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm text-ink/80 transition hover:text-ink hover:bg-surface-raised/60";
const NAV_ITEM_ACTIVE =
  "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-ink bg-surface-raised shadow-neu-sm ring-1 ring-white/70 dark:ring-white/5";

/** 학생 대시보드 왼쪽 사이드바 (모바일에서는 상단 카드) */
export function StudentSidebar({
  activeOrg,
  orgAvatarUrl,
  isOwner,
  githubLogin,
  avatarUrl,
  status,
}: StudentSidebarProps) {
  return (
    <aside
      aria-label="대시보드 메뉴"
      className="flex flex-col gap-6 rounded-[28px] bg-surface p-5 shadow-neu lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-64 lg:shrink-0 lg:overflow-y-auto"
    >
      {/* 로고 + (모바일) 프로필 */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 px-1">
          <GitBranch className="h-5 w-5 text-lilac-ink" />
          <span className="text-sm font-bold uppercase tracking-[0.18em] text-ink">GitRepoTrack</span>
        </Link>
        <div className="lg:hidden">
          <ProfileRow githubLogin={githubLogin} avatarUrl={avatarUrl} isOwner={isOwner} activeOrg={activeOrg} />
        </div>
      </div>

      {/* 메뉴 */}
      <nav aria-label="학생 메뉴" className="space-y-5">
        <div className="space-y-2">
          <p className={SECTION_LABEL}>Workspace</p>
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            <Link
              href={`/dashboard?org=${encodeURIComponent(activeOrg)}`}
              aria-current="page"
              className={`${NAV_ITEM_ACTIVE} shrink-0`}
            >
              <LayoutDashboard className="h-[18px] w-[18px]" />
              <span>대시보드</span>
            </Link>
            <Link
              href="/dashboard"
              title="다른 Organization 선택 또는 새로 등록하기"
              className={`${NAV_ITEM} shrink-0`}
            >
              <Repeat2 className="h-[18px] w-[18px]" />
              <span>Organization 변경</span>
            </Link>
          </div>
        </div>

        {isOwner && (
          <div className="space-y-2">
            <p className={SECTION_LABEL}>Management</p>
            <Link href={`/admin?org=${encodeURIComponent(activeOrg)}`} className={NAV_ITEM}>
              <Shield className="h-[18px] w-[18px]" />
              <span>관리자 대시보드</span>
            </Link>
          </div>
        )}
      </nav>

      {/* 현재 Organization */}
      <div className="space-y-2">
        <p className={SECTION_LABEL}>Organization</p>
        <div className="flex items-center gap-3 rounded-2xl p-3 shadow-neu-inset">
          {orgAvatarUrl ? (
            <img src={orgAvatarUrl} alt={activeOrg} className="h-9 w-9 shrink-0 rounded-xl" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-lilac text-lilac-ink">
              <Building2 className="h-4 w-4" />
            </div>
          )}
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
                href={`https://github.com/${encodeURIComponent(activeOrg)}`}
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
      <div className="mt-auto space-y-4">
        <div className="rounded-2xl bg-surface p-4 shadow-neu-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">과제 상태</p>
          <ul className="mt-2 space-y-1.5 text-sm text-ink/80">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <strong className="font-semibold text-ink">{status.satisfied}</strong> 충족
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              <strong className="font-semibold text-ink">{status.unmet}</strong> 미충족
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted" />
              <strong className="font-semibold text-ink">{status.pending}</strong> 분석 필요
            </li>
          </ul>
        </div>

        <div className="hidden lg:block">
          <ProfileRow githubLogin={githubLogin} avatarUrl={avatarUrl} isOwner={isOwner} activeOrg={activeOrg} />
        </div>
      </div>
    </aside>
  );
}

/** 아바타 · GitHub 아이디 · OWNER 배지 · 로그아웃 (Navbar와 같은 /auth/signout 폼) */
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
    </div>
  );
}
