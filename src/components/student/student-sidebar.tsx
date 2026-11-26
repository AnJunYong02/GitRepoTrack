"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  ClipboardList,
  ExternalLink,
  Home,
  ListChecks,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Repeat2,
  Shield,
  Sun,
  Trophy,
  User,
} from "lucide-react";

import { useThemeToggle } from "@/components/theme-toggle";
import { CreateStudentReposPanel } from "@/components/admin/create-student-repos-panel";
import { RepoRefreshButton } from "@/components/admin/repo-refresh-button";
import type { StudentStatusCounts } from "@/lib/student/student-assignments";
import { SIDEBAR_COOKIE } from "@/components/student/sidebar-cookie";

export type StudentNavKey = "dashboard" | "assignments" | "leaderboard" | "admin" | "none";

export interface StudentSidebarProps {
  /** student: 학생 화면 메뉴, admin: org Owner(교수·TA) 관리 화면 메뉴 */
  mode?: "student" | "admin";
  /** 현재 Organization (없으면 Organization 선택 화면: 메뉴 대신 안내만) */
  activeOrg?: string;
  isOwner: boolean;
  githubLogin?: string | null;
  avatarUrl?: string | null;
  studentNo?: string | null;
  /** "과제 현황" 숫자 (없으면 영역 숨김) */
  status?: StudentStatusCounts;
  active?: StudentNavKey;
  /** 순위표 주소 (학생: 이번 주 과제, 관리자: 가장 최근 과제 / 없으면 메뉴 숨김) */
  leaderboardHref?: string | null;
  /** 처음 열림 여부 (StudentShell이 쿠키에서 읽어 넘김, 기본 닫힘) */
  defaultOpen?: boolean;
}

/** 데스크톱에서 사이드바가 접혀 있으면 투명하게 숨기는 글자 (스크린리더는 계속 읽음) */
const HIDE_WHEN_CLOSED = "transition-opacity duration-150 lg:group-data-[open=false]/sb:opacity-0";
/** 접혀 있으면 완전히 숨겨 Tab 포커스도 받지 않게 함 (드롭다운 버튼 등 아이콘 없는 조작 요소) */
const INVISIBLE_WHEN_CLOSED = `${HIDE_WHEN_CLOSED} lg:group-data-[open=false]/sb:invisible`;

const NAV_BASE = "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors";
const NAV_IDLE = `${NAV_BASE} text-fg-2 hover:bg-chip hover:text-fg`;
const NAV_ACTIVE = `${NAV_BASE} bg-brand-soft font-semibold text-brand`;
const BOTTOM_BTN =
  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] text-fg-2 transition-colors hover:bg-chip hover:text-fg disabled:opacity-60";

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Link href={href} title={label} aria-current={active ? "page" : undefined} className={active ? NAV_ACTIVE : NAV_IDLE}>
      <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">{icon}</span>
      <span className={`whitespace-nowrap ${HIDE_WHEN_CLOSED}`}>{label}</span>
    </Link>
  );
}

/**
 * 학생 화면 왼쪽 사이드바
 * - 데스크톱: 오른쪽 모서리 버튼으로 64px 아이콘 줄 ↔ 232px 펼침을 고정 전환 (상태는 쿠키에 저장, 본문은 옆으로 밀림)
 * - 모바일: 상단 블록 (항상 펼친 모양, 버튼 없음)
 */
export function StudentSidebar({
  mode = "student",
  activeOrg,
  isOwner,
  githubLogin,
  avatarUrl,
  studentNo,
  status,
  active = "none",
  leaderboardHref,
  defaultOpen = false,
}: StudentSidebarProps) {
  const org = activeOrg ?? "";
  const hasOrg = Boolean(org);
  const q = `?org=${encodeURIComponent(org)}`;
  const isAdmin = mode === "admin";
  const homeHref = !hasOrg ? "/dashboard" : isAdmin ? `/admin${q}` : `/dashboard${q}`;

  const [open, setOpen] = useState(defaultOpen);

  // 버튼으로만 열고 닫음: 상태를 1년짜리 쿠키에 남겨 새로고침·페이지 이동 후에도 유지
  const toggle = () => {
    const next = !open;
    setOpen(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div
      data-open={open}
      data-sidebar-open={open}
      className={`group/sb relative lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:transition-[width] lg:duration-200 lg:ease-out ${
        open ? "lg:w-[232px]" : "lg:w-16"
      }`}
    >
      <div className="h-full border-b border-line bg-canvas lg:overflow-hidden lg:border-b-0 lg:border-r">
        <aside
          aria-label={isAdmin ? "관리자 메뉴" : "학생 메뉴"}
          className="flex flex-col gap-6 px-4 py-5 lg:h-full lg:w-[232px] lg:px-[10px] lg:py-7"
        >
      {/* 로고 */}
      <Link href={homeHref} className="flex items-center gap-2.5 px-3" aria-label="GitRepoTrack 대시보드">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full bg-brand" />
        </span>
        <span className={`whitespace-nowrap text-[17px] font-bold tracking-tight text-fg ${HIDE_WHEN_CLOSED}`}>
          GitRepoTrack
        </span>
      </Link>

      {/* Organization */}
      <div className={INVISIBLE_WHEN_CLOSED}>
        <OrgMenu org={org} />
        {isAdmin && hasOrg && (
          <a
            href={`https://github.com/${encodeURIComponent(org)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 whitespace-nowrap px-3 text-[12px] text-fg-3 hover:text-fg"
          >
            GitHub에서 열기
            <ArrowUpRight className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* 관리자 메뉴 */}
      {isAdmin && hasOrg && (
        <nav aria-label="관리자 메뉴" className="-mt-1 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          <NavItem
            href={`/admin${q}`}
            icon={<ClipboardList className="h-[18px] w-[18px]" />}
            label="과제 관리"
            active={active === "admin"}
          />
          {leaderboardHref && (
            <NavItem
              href={leaderboardHref}
              icon={<Trophy className="h-[17px] w-[17px]" />}
              label="순위표"
              active={active === "leaderboard"}
            />
          )}
          <CreateStudentReposPanel
            orgName={org}
            trigger="nav"
            navClassName={NAV_IDLE}
            hideClassName={HIDE_WHEN_CLOSED}
          />
        </nav>
      )}

      {!isAdmin && hasOrg && (
        <nav aria-label="학생 메뉴" className="-mt-1 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          <NavItem
            href={`/dashboard${q}`}
            icon={<Home className="h-[18px] w-[18px]" />}
            label="대시보드"
            active={active === "dashboard"}
          />
          <NavItem
            href={`/dashboard/assignments${q}`}
            icon={<ListChecks className="h-[18px] w-[18px]" />}
            label="내 과제"
            active={active === "assignments"}
          />
          {leaderboardHref && (
            <NavItem
              href={leaderboardHref}
              icon={<Trophy className="h-[17px] w-[17px]" />}
              label="순위표"
              active={active === "leaderboard"}
            />
          )}
          {isOwner && (
            <NavItem
              href={`/admin${q}`}
              icon={<Shield className="h-[17px] w-[17px]" />}
              label="관리자"
              active={false}
            />
          )}
        </nav>
      )}

      {/* 과제 현황 */}
      {status && (
        <div className="hidden space-y-1 lg:block">
          <p className={`whitespace-nowrap px-3 pb-1 text-[11px] font-medium text-fg-3 ${HIDE_WHEN_CLOSED}`}>과제 현황</p>
          <StatusRow dot="bg-brand" label="충족" value={status.satisfied} />
          <StatusRow dot="bg-danger" label="보완 필요" value={status.unmet} />
          {status.pending > 0 && <StatusRow dot="bg-fg-3" label="분석 필요" value={status.pending} />}
        </div>
      )}

      {/* 하단: 동기화 · 다크 모드 · 프로필 */}
      <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:items-center lg:mt-auto lg:block lg:space-y-1">
        {!isAdmin && hasOrg && studentNo && <SyncButton studentNo={studentNo} org={org} />}
        {isAdmin && hasOrg && (
          <RepoRefreshButton org={org} className={BOTTOM_BTN} hideClassName={HIDE_WHEN_CLOSED} />
        )}
        <ThemeButton />
        {isAdmin && (
          <form action="/auth/signout" method="post">
            <button type="submit" className={BOTTOM_BTN}>
              <LogOut className="h-[18px] w-[18px] shrink-0" />
              <span className={`whitespace-nowrap ${HIDE_WHEN_CLOSED}`}>로그아웃</span>
            </button>
          </form>
        )}
        <div className="col-span-2 border-line sm:ml-auto lg:!mt-3 lg:border-t lg:pt-4">
          <ProfileRow
            githubLogin={githubLogin}
            avatarUrl={avatarUrl}
            studentNo={isAdmin ? null : studentNo}
            isOwner={isOwner}
            adminLabel={isAdmin}
          />
        </div>
      </div>
        </aside>
      </div>
      {/* 열기/닫기 버튼 (데스크톱만): 오른쪽 경계선에 걸친 동그란 버튼, overflow-hidden 바깥이라 잘리지 않음 */}
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "사이드바 접기" : "사이드바 펼치기"}
        title={open ? "사이드바 접기" : "사이드바 펼치기"}
        className="absolute -right-3.5 top-8 z-10 hidden h-7 w-7 items-center justify-center rounded-full border border-line bg-canvas text-fg-3 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition hover:bg-chip hover:text-fg lg:flex"
      >
        {open ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function StatusRow({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 text-[14px] text-fg">
      <span className="inline-flex items-center gap-3">
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center" aria-hidden>
          <span className={`h-2 w-2 rounded-full ${dot}`} />
        </span>
        <span className={`whitespace-nowrap ${HIDE_WHEN_CLOSED}`}>{label}</span>
      </span>
      <span className={`text-[12px] tabular-nums text-fg-3 ${HIDE_WHEN_CLOSED}`}>{value}</span>
    </div>
  );
}

/** "Organization / 2026-2-WebService ▾" + 펼침 메뉴 */
function OrgMenu({ org }: { org: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!org) {
    return (
      <div className="px-3">
        <p className="text-[12px] text-fg-3">Organization</p>
        <p className="mt-1 text-[14px] font-semibold text-fg">선택해 주세요</p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative whitespace-nowrap px-3">
      <p className="text-[12px] text-fg-3">Organization</p>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="mt-1 inline-flex max-w-full items-center gap-1 text-[15px] font-bold text-fg"
        title={org}
      >
        <span className="truncate">{org}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-2 right-2 top-full z-30 mt-2 overflow-hidden rounded-xl border border-line bg-canvas py-1 text-[13px] shadow-lg"
        >
          <Link role="menuitem" href="/dashboard" className="flex items-center gap-2 px-3 py-2 text-fg-2 hover:bg-chip hover:text-fg">
            <Repeat2 className="h-3.5 w-3.5" />
            다른 Organization 선택
          </Link>
          <a
            role="menuitem"
            href={`https://github.com/${encodeURIComponent(org)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-fg-2 hover:bg-chip hover:text-fg"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            GitHub에서 보기
          </a>
        </div>
      )}
    </div>
  );
}

/** 최신 Repo 동기화: 학번 기준으로 org를 다시 스캔하고 화면을 새로고침 */
function SyncButton({ studentNo, org }: { studentNo: string; org: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/student-no", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNo, orgName: org }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "동기화에 실패했습니다.");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "동기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleSync}
        disabled={loading}
        title={`학번 ${studentNo} 기준으로 ${org} 저장소를 다시 불러오기`}
        className={BOTTOM_BTN}
      >
        <RefreshCw className={`h-[18px] w-[18px] shrink-0 ${loading ? "animate-spin text-brand" : ""}`} />
        <span className={`whitespace-nowrap ${HIDE_WHEN_CLOSED}`}>{loading ? "동기화 중..." : "최신 Repo 동기화"}</span>
      </button>
      {error && (
        <p role="status" className={`px-3 text-[11px] text-danger ${HIDE_WHEN_CLOSED}`}>
          {error}
        </p>
      )}
    </>
  );
}

function ThemeButton() {
  const { isDark, toggle } = useThemeToggle();
  return (
    <button type="button" onClick={toggle} aria-pressed={isDark ?? undefined} className={BOTTOM_BTN}>
      {isDark ? <Sun className="h-[18px] w-[18px] shrink-0" /> : <Moon className="h-[18px] w-[18px] shrink-0" />}
      <span className={`whitespace-nowrap ${HIDE_WHEN_CLOSED}`}>{isDark ? "라이트 모드" : "다크 모드"}</span>
    </button>
  );
}

/** 아바타 · GitHub 아이디 · 학번 · 로그아웃 */
function ProfileRow({
  githubLogin,
  avatarUrl,
  studentNo,
  isOwner,
  adminLabel = false,
}: Pick<StudentSidebarProps, "githubLogin" | "avatarUrl" | "studentNo" | "isOwner"> & {
  /** 관리자 화면: 아래 줄에 "OWNER · 교수 · TA", 로그아웃은 하단 텍스트 버튼으로 대신함 */
  adminLabel?: boolean;
}) {
  return (
    <div className="group flex items-center gap-3 px-2 lg:px-1">
      {avatarUrl ? (
        <img src={avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full bg-chip" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chip text-fg-3">
          <User className="h-4 w-4" />
        </span>
      )}
      <div className={`min-w-0 flex-1 ${HIDE_WHEN_CLOSED}`}>
        <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-fg" title={githubLogin ?? ""}>
          <span className="truncate">{githubLogin}</span>
          {isOwner && !adminLabel && <Shield className="h-3 w-3 shrink-0 text-amber-500" aria-label="Owner" />}
        </p>
        {adminLabel ? (
          <p className="whitespace-nowrap text-[11px] text-fg-3">
            <strong className="font-bold text-chart">OWNER</strong> · 교수 · TA
          </p>
        ) : (
          studentNo && <p className="font-mono text-[11px] text-fg-3">{studentNo}</p>
        )}
      </div>
      {!adminLabel && (
      <form action="/auth/signout" method="post" className={HIDE_WHEN_CLOSED}>
        <button
          type="submit"
          title="로그아웃"
          aria-label="로그아웃"
          className="rounded-lg p-1.5 text-fg-3 opacity-60 transition hover:bg-chip hover:text-fg group-hover:opacity-100"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </form>
      )}
    </div>
  );
}
