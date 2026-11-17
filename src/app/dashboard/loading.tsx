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
    <div className="min-h-screen bg-surface font-display text-ink">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:gap-10 lg:pr-10">
        {/* 사이드바 자리 */}
        <aside className="flex flex-col gap-6 rounded-[28px] bg-surface p-5 shadow-neu lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-64 lg:shrink-0">
          <div className="flex items-center gap-2 px-1">
            <GitBranch className="h-5 w-5 text-lilac-ink" />
            <span className="text-sm font-bold uppercase tracking-[0.18em]">GitRepoTrack</span>
          </div>
          <div className="space-y-3 animate-pulse">
            <div className="h-10 rounded-2xl shadow-neu-inset" />
            <div className="h-10 rounded-2xl shadow-neu-inset" />
          </div>
        </aside>

        <main className="min-w-0 flex-1 space-y-8 lg:py-6">
          <div className="rounded-[28px] bg-surface p-6 sm:p-8 shadow-neu">
            <div className="mx-auto max-w-md text-center space-y-4">
              <div className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-semibold shadow-neu-inset">
                <Loader2 className="w-4 h-4 animate-spin text-lilac-ink" />
                <span>내 과제 목록 불러오는 중...</span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted">
                  <Clock className="w-3 h-3" />
                  {(elapsedMs / 1000).toFixed(1)}초 경과
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold">
                  {elapsedMs < 700
                    ? "1/2단계: 학생 계정 및 Organization 연동 정보 확인 중..."
                    : "2/2단계: 과제별 커밋·README 검사 상태 및 마감 기한 집계 중..."}
                </p>
                <p className="text-[11px] text-muted">
                  최신 제출 현황 데이터를 준비하고 있습니다. 잠시만 기다려주세요!
                </p>
              </div>

              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="w-full h-2 rounded-full shadow-neu-inset overflow-hidden"
              >
                <div
                  className="h-full rounded-full bg-accent transition-all duration-150 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* 카드 스켈레톤: 날짜 · 달성률 · 이번주 과제 / 과제 목록 · Goals */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,2.4fr)] animate-pulse">
            <div className="h-56 rounded-[28px] bg-surface shadow-neu" />
            <div className="h-56 rounded-[28px] bg-surface shadow-neu" />
            <div className="h-56 rounded-[28px] bg-surface shadow-neu md:col-span-2 xl:col-span-1" />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 animate-pulse">
            <div className="h-80 rounded-[28px] bg-surface shadow-neu" />
            <div className="h-80 rounded-[28px] bg-surface shadow-neu" />
          </div>
        </main>
      </div>
    </div>
  );
}
