import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/guards";
import { GitBranch, Shield, LogOut, User } from "lucide-react";

export async function Navbar() {
  const current = await getCurrentUser();
  const isStaff = current?.profile?.role === "staff";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-base tracking-tight">
            <GitBranch className="w-5 h-5 text-blue-600" />
            <span>RepoTrack</span>
          </Link>
          {current && (
            <nav className="flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300">
              <Link href="/dashboard" className="hover:text-blue-600">
                내 과제 목록
              </Link>
              {isStaff && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>관리자 현황</span>
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
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
                <span className="font-medium">{current.profile?.github_login}</span>
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
