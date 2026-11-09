import Link from "next/link";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/guards";
import { normalizeOrgName } from "@/lib/github/app";
import { ACTIVE_ORG_COOKIE, isValidOrgSlug } from "@/lib/org/active-org";
import { GitBranch, LogOut, User, Building2 } from "lucide-react";

export interface NavbarProps {
  orgName?: string;
  assignmentTitle?: string;
  assignmentHref?: string;
  subPageLabel?: string;
}

export async function Navbar({
  orgName,
  assignmentTitle,
  assignmentHref,
  subPageLabel,
}: NavbarProps = {}) {
  const current = await getCurrentUser();
  const isStaff = current?.profile?.role === "staff";
  const cookieStore = await cookies();
  const rawCookieOrg = normalizeOrgName(
    cookieStore.get(ACTIVE_ORG_COOKIE)?.value || ""
  );
  const resolvedOrg = normalizeOrgName(orgName || "") || (isValidOrgSlug(rawCookieOrg) ? rawCookieOrg : "");
  const showOrgPath = Boolean(orgName && isValidOrgSlug(normalizeOrgName(orgName)));

  const orgRootHref = resolvedOrg
    ? isStaff
      ? `/admin?org=${encodeURIComponent(resolvedOrg)}`
      : `/dashboard?org=${encodeURIComponent(resolvedOrg)}`
    : "/dashboard";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-base tracking-tight shrink-0"
          >
            <GitBranch className="w-5 h-5 text-blue-600" />
            <span>GitRepoTrack</span>
          </Link>

          {current && (
            <nav
              aria-label="현재 페이지 위치"
              className="flex items-center gap-2 text-xs min-w-0"
            >
              {/* URL-style Path Badge: [ 현재 있는 organization 이름 / 과제명 ] */}
              <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 px-2.5 py-1 font-mono text-xs text-slate-700 dark:text-slate-200 min-w-0 max-w-[62vw] sm:max-w-xl">
                <span className="text-slate-400 font-bold select-none">[</span>

                {showOrgPath ? (
                  <>
                    <Link
                      href={orgRootHref}
                      className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                      title={`${resolvedOrg} 과제 목록으로 이동`}
                    >
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{resolvedOrg}</span>
                    </Link>

                    {assignmentTitle && (
                      <>
                        <span className="text-slate-400 select-none">/</span>
                        {subPageLabel && assignmentHref ? (
                          <Link
                            href={assignmentHref}
                            className="font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate"
                          >
                            {assignmentTitle}
                          </Link>
                        ) : (
                          <span
                            aria-current="page"
                            className="font-bold text-slate-900 dark:text-slate-100 truncate font-sans"
                          >
                            {assignmentTitle}
                          </span>
                        )}
                      </>
                    )}

                    {subPageLabel && (
                      <>
                        <span className="text-slate-400 select-none">/</span>
                        <span
                          aria-current="page"
                          className="font-bold text-slate-900 dark:text-slate-100 truncate font-sans"
                        >
                          {subPageLabel}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 font-sans truncate"
                  >
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Organization 선택</span>
                  </Link>
                )}

                <span className="text-slate-400 font-bold select-none">]</span>
              </div>

              {showOrgPath && (
                <Link
                  href="/dashboard"
                  className="hidden md:inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition shrink-0"
                  title="다른 Organization 선택 또는 새로 등록하기"
                >
                  <span>Org 변경</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {current ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                {current.profile?.avatar_url ? (
                  <img
                    src={current.profile.avatar_url}
                    alt={current.profile.github_login}
                    className="w-6 h-6 rounded-full border border-slate-300"
                  />
                ) : (
                  <User className="w-4 h-4 text-slate-400" />
                )}
                <span className="font-medium hidden sm:inline">
                  {current.profile?.github_login}
                </span>
                {isStaff && (
                  <span className="rounded bg-indigo-100 dark:bg-indigo-950 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                    STAFF
                  </span>
                )}
              </div>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              GitHub 로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
