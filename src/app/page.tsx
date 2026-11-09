import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { GitBranch, ShieldCheck, Trophy, Download } from "lucide-react";

export default async function Home() {
  const current = await getCurrentUser();
  // If already logged in, redirect straight to dashboard
  if (current) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/60 px-4 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 ring-1 ring-inset ring-blue-700/10">
          <GitBranch className="w-4 h-4" />
          <span>GitRepoTrack 학생 과제 분석 시스템</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          GitHub Organization 과제 추적 & 제출 분석
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          학생은 자신의 배정된 repo 현황과 README 충족 여부를 확인하고, TA 및 교수는 전체 제출 현황 파악과 ZIP 일괄 다운로드를 손쉽게 수행합니다.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition"
          >
            GitHub로 시작하기
          </Link>
          <Link
            href="/admin"
            className="rounded-lg bg-white dark:bg-slate-900 px-6 py-3 font-semibold text-slate-800 dark:text-slate-200 ring-1 ring-slate-300 dark:ring-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
          >
            관리자 대시보드
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 text-left">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white/50 dark:bg-slate-900/50">
            <ShieldCheck className="w-6 h-6 text-emerald-600 mb-2" />
            <h3 className="font-semibold text-sm">학생 간 격리 보장</h3>
            <p className="text-xs text-slate-500 mt-1">RLS 및 서버 권한 검증으로 다른 학생의 비공개 repo 정보 노출 원천 차단</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white/50 dark:bg-slate-900/50">
            <Trophy className="w-6 h-6 text-amber-500 mb-2" />
            <h3 className="font-semibold text-sm">실시간 Webhook 순위</h3>
            <p className="text-xs text-slate-500 mt-1">Push 웹훅 기반 최초 조건 충족 시각으로 공정한 순위표 산출</p>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-white/50 dark:bg-slate-900/50">
            <Download className="w-6 h-6 text-indigo-500 mb-2" />
            <h3 className="font-semibold text-sm">단일 ZIP 스트리밍</h3>
            <p className="text-xs text-slate-500 mt-1">학교 서버 환경에서 타임아웃 걱정 없이 수십 개 과제 일괄 다운로드</p>
          </div>
        </div>
      </div>
    </main>
  );
}
