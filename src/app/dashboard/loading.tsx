"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, GitBranch } from "lucide-react";

export default function DashboardLoading() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const progress = Math.min(
    94,
    Math.max(15, Math.round((1 - Math.exp(-elapsedMs / 1200)) * 95))
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top Navbar Placeholder */}
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 font-bold text-base tracking-tight">
            <GitBranch className="w-5 h-5 text-blue-600" />
            <span>RepoTrack</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="mx-auto max-w-md text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-950/80 px-4 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>내 과제 목록 불러오는 중...</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-blue-600 dark:text-blue-400 shadow-2xs">
                <Clock className="w-3 h-3" />
                {(elapsedMs / 1000).toFixed(1)}초 경과
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {elapsedMs < 700
                  ? "1/2단계: 학생 계정 및 Organization 연동 정보 확인 중..."
                  : "2/2단계: 과제별 커밋·README 검사 상태 및 마감 기한 집계 중..."}
              </p>
              <p className="text-[11px] text-slate-400">
                최신 제출 현황 데이터를 준비하고 있습니다. 잠시만 기다려주세요!
              </p>
            </div>

            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Skeleton Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
            >
              <div className="flex justify-between">
                <div className="h-4 w-44 rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-5 w-20 rounded-full bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800/60" />
              <div className="flex justify-between pt-2">
                <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="h-7 w-24 rounded-lg bg-slate-200 dark:bg-slate-800" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
