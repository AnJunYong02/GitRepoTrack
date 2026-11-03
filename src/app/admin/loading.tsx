"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock, GitBranch } from "lucide-react";

export default function AdminLoading() {
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
      <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2 font-bold text-base tracking-tight">
            <GitBranch className="w-5 h-5 text-blue-600" />
            <span>RepoTrack</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-6">
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-sm">
          <div className="mx-auto max-w-md text-center space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 dark:bg-indigo-950/80 px-4 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-500/20">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              <span>관리자 과제 목록 불러오는 중...</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 px-2 py-0.5 font-mono text-[11px] text-indigo-600 dark:text-indigo-400 shadow-2xs">
                <Clock className="w-3 h-3" />
                {(elapsedMs / 1000).toFixed(1)}초 경과
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {elapsedMs < 700
                  ? "1/2단계: 관리자 권한 및 Organization 정보 확인 중..."
                  : "2/2단계: 등록된 과제 및 학생 제출 통계 집계 중..."}
              </p>
              <p className="text-[11px] text-slate-400">
                과제 현황 데이터를 불러오고 있습니다. 잠시만 기다려주세요!
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
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 transition-all duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
