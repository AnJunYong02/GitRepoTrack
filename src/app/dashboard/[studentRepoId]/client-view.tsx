"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/navigation/back-link";
import { RefreshCw, Play, Clock, AlertCircle, GitBranch, ArrowLeft, ExternalLink, Trophy, Download } from "lucide-react";
import { ReadmeChecklist } from "@/components/student/readme-checklist";
import { CommitChart } from "@/components/student/commit-chart";
import { CommitTimeline } from "@/components/student/commit-timeline";
import { DeadlineCountdown } from "@/components/student/deadline-countdown";
import { ThemeToggle } from "@/components/theme-toggle";

interface ClientDashboardViewProps {
  studentRepoId: string;
  isOrgOwner?: boolean; // 이 repo가 속한 org의 Owner인지 (관리 화면으로 돌아가기 링크용)
  initialData: {
    repo: any;
    assignment: any;
    status: any;
    evaluation: any;
    commits: any[];
  };
}

export function ClientDashboardView({ studentRepoId, isOrgOwner = false, initialData }: ClientDashboardViewProps) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);

  const handleAnalyze = async (forceRefresh: boolean = false) => {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/repos/${studentRepoId}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "분석 요청에 실패했습니다.");
      }

      // Re-fetch latest status
      window.location.reload();
    } catch (err: any) {
      setMessage({ text: err.message, type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const evalData = data.evaluation;
  const isSubmitted = evalData?.submitted ?? false;
  const readmeResults = evalData?.readme_results || { satisfied: false, missingKeywords: [], details: [] };
  const repoOrg =
    data.assignment?.org_name ||
    (data.repo?.full_name ? data.repo.full_name.split("/")[0] : "");

  // 상단 통계용 표시 값 (기존 평가 결과에서 꺼내기만 함)
  const readmeDetails: { keyword: string; found: boolean }[] = Array.isArray(readmeResults.details)
    ? readmeResults.details
    : [];
  const readmeTotal = readmeDetails.length;
  const readmePassed = readmeDetails.filter((d) => d.found).length;
  const hasEvaluation = Boolean(evalData);
  // 키워드 기준이 없으면 README 존재 여부로 0/100% (학생 대시보드 통계와 같은 규칙)
  const readmePercent = !hasEvaluation
    ? null
    : readmeTotal > 0
    ? Math.round((readmePassed / readmeTotal) * 100)
    : readmeResults.satisfied
    ? 100
    : 0;
  const fetchedAt = data.status?.fetched_at ? new Date(data.status.fetched_at) : null;

  const ACTION_BTN =
    "inline-flex items-center gap-1.5 rounded-2xl bg-surface px-4 py-3 text-xs font-semibold text-ink shadow-neu-sm transition hover:shadow-neu-inset disabled:opacity-50";
  const CARD = "neu-hover rounded-[28px] bg-surface shadow-neu";

  return (
    <div className="space-y-8">
      {/* 헤더: 뒤로가기 · 제목 · repo 링크 + 동작 버튼 */}
      <header className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
        <div className="min-w-0 space-y-3">
          <BackLink
            fallbackHref={
              isOrgOwner && data.assignment?.id
                ? `/admin/assignments/${data.assignment.id}`
                : repoOrg
                ? `/dashboard?org=${encodeURIComponent(repoOrg)}`
                : "/dashboard"
            }
            className="inline-flex items-center gap-1.5 rounded-2xl bg-surface px-3.5 py-2 text-xs font-medium text-ink/80 shadow-neu-sm transition hover:text-ink hover:shadow-neu-inset"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isOrgOwner ? "뒤로가기 (과제 관리 화면)" : "뒤로가기 (내 과제 목록)"}</span>
          </BackLink>

          <h1 className="text-3xl font-normal tracking-tight text-ink sm:text-4xl">{data.assignment?.title}</h1>
          <a
            href={`https://github.com/${data.repo.full_name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-wrap items-center gap-1.5 break-all font-mono text-xs text-muted hover:text-ink hover:underline sm:text-sm"
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span>{data.repo.full_name}</span>
            <span>· {data.assignment?.branch || "main"}</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => handleAnalyze(false)} disabled={loading} className={ACTION_BTN}>
            <Play className="w-3.5 h-3.5 text-lilac-ink" />
            <span>분석하기</span>
          </button>
          <button onClick={() => handleAnalyze(true)} disabled={loading} className={ACTION_BTN}>
            <RefreshCw className={`w-3.5 h-3.5 text-lilac-ink ${loading ? "animate-spin" : ""}`} />
            <span>GitHub 새로고침</span>
          </button>
          {/* 본인 Repo ZIP 다운로드 */}
          <a href={`/api/repos/${studentRepoId}/archive`} className={ACTION_BTN} download>
            <Download className="w-3.5 h-3.5 text-lilac-ink" />
            <span>Repo 다운로드 (.zip)</span>
          </a>
          {data.assignment?.id && data.assignment?.ranking_mode !== "none" && (
            <Link href={`/assignments/${data.assignment.id}/leaderboard`} className={ACTION_BTN}>
              <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>실시간 순위표 보기</span>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      {message && (
        <div
          className={`flex items-center gap-2 rounded-2xl p-3 text-xs shadow-neu-inset ${
            message.type === "error"
              ? "text-red-700 dark:text-red-300"
              : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {/* 상단: 마감 카운트다운 · README 통과율 · 제출 판정 */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,2.2fr)]">
        <DeadlineCountdown
          deadlineAt={data.assignment?.deadline_at ?? null}
          commitDates={(data.commits || []).map((c: any) => c.committed_at)}
          isSubmitted={isSubmitted}
        />

        <section aria-label="README 통과율" className={`${CARD} flex items-center justify-center p-5`}>
          <ProgressRing percent={readmePercent} caption={readmePercent === null ? "분석 전" : "README 통과"} />
        </section>

        <section aria-label="제출 판정" className={`${CARD} p-6 md:col-span-2 xl:col-span-1`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm text-ink/80">
              <span className={`h-1.5 w-1.5 rounded-full ${isSubmitted ? "bg-accent" : "bg-amber-500"}`} />
              제출 판정:{" "}
              <strong className={isSubmitted ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}>
                {isSubmitted ? "충족 (제출 완료)" : "미충족"}
              </strong>
            </span>
            {data.status?.fetched_at && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <Clock className="w-3 h-3" />
                마지막 갱신: {new Date(data.status.fetched_at).toLocaleString("ko-KR")}
              </span>
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-6">
            <StatTile label="총 커밋" value={String((data.commits || []).length)} caption="기록된 커밋 수" />
            <StatTile
              label="README 키워드"
              value={!hasEvaluation ? "-" : readmeTotal > 0 ? String(readmePassed) : readmeResults.satisfied ? "✓" : "✕"}
              caption={
                !hasEvaluation
                  ? "분석 전"
                  : readmeTotal > 0
                  ? `${readmeTotal}개 중 통과`
                  : readmeResults.satisfied
                  ? "README 확인됨"
                  : "README.md 누락"
              }
            />
            <StatTile
              label="마지막 갱신"
              value={
                fetchedAt
                  ? new Intl.DateTimeFormat("ko-KR", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" })
                      .format(fetchedAt)
                      .replace(/\.$/, "")
                  : "-"
              }
              caption={
                fetchedAt
                  ? new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(fetchedAt)
                  : "아직 분석 전"
              }
            />
          </div>

          {data.status?.stale && (
            <p className="mt-5 rounded-2xl px-4 py-3 text-xs font-medium text-amber-700 shadow-neu-inset dark:text-amber-400">
              ⚠️ 최근 push 감지됨 (새로고침을 눌러 최신 반영)
            </p>
          )}
        </section>
      </div>

      {/* 아래: README 키워드 검사(넓게) + 커밋 추이·이력 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 2xl:col-span-8 min-w-0">
          <ReadmeChecklist
            satisfied={readmeResults.satisfied}
            missingKeywords={readmeResults.missingKeywords}
            details={readmeResults.details}
          />
        </div>

        <div className="lg:col-span-5 2xl:col-span-4 lg:sticky lg:top-6 min-w-0 space-y-6">
          <CommitChart commits={data.commits} />
          <CommitTimeline commits={data.commits} />
        </div>
      </div>
    </div>
  );
}

/** 숫자 타일 (학생 대시보드의 숫자 칸과 같은 모양) */
function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3 text-center">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted sm:text-[11px] sm:tracking-[0.14em]">{label}</span>
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl shadow-neu-inset sm:h-24 sm:w-24">
        <span className={`text-3xl font-light tracking-tight sm:text-4xl ${value === "-" ? "text-muted" : "text-ink"}`}>{value}</span>
      </div>
      <span className="text-xs text-ink/80">{caption}</span>
    </div>
  );
}

/** 원형 진행 링 (학생 대시보드 달성률 링과 같은 모양) */
function ProgressRing({ percent, caption }: { percent: number | null; caption: string }) {
  const radius = 64;
  const circumference = 2 * Math.PI * radius;
  const dash = ((percent ?? 0) / 100) * circumference;
  return (
    <div className="relative flex h-44 w-44 items-center justify-center rounded-full shadow-neu">
      <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
        <circle cx="80" cy="80" r={radius} fill="none" strokeWidth="6" className="stroke-muted/15" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="stroke-accent"
        />
      </svg>
      <div className="text-center">
        <div className="text-5xl font-light tracking-tight text-ink">{percent === null ? "-" : `${percent}%`}</div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{caption}</div>
      </div>
    </div>
  );
}
