"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/navigation/back-link";
import { RefreshCw, Play, Clock, AlertCircle, GitBranch, ArrowLeft, ExternalLink, Trophy, Download, GitCommit, FileText } from "lucide-react";
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
    /** 최신 스냅샷의 분석된 커밋 수 (분석 전이면 null) */
    snapshotCommitCount: number | null;
    /** 현재 기준의 최소 커밋 수 (0이면 기준 없음 → 최소 1개) */
    minCommits: number;
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

  // 요약 카드 표시 값 — 학생 대시보드 목록(dashboard/page.tsx)과 같은 규칙
  const hasEvaluation = Boolean(evalData);
  const hasSnapshot = Boolean(data.status?.latest_snapshot_id) && data.snapshotCommitCount !== null;
  const commitCount = data.snapshotCommitCount ?? 0;
  const commitTarget = data.minCommits > 0 ? data.minCommits : 1;
  const commitSatisfied = hasSnapshot && commitCount > 0 && commitCount >= commitTarget;
  const commitShortfall = Math.max(0, commitTarget - commitCount);

  const readmeDetails: { keyword: string; found: boolean }[] = Array.isArray(readmeResults.details)
    ? readmeResults.details
    : [];
  const readmeTotal = readmeDetails.length;
  const readmePassed = readmeDetails.filter((d) => d.found).length;

  const commitView: SummaryView = !hasSnapshot
    ? { tone: "idle", value: "-", unit: "", note: "분석 필요", percent: 0 }
    : {
        tone: commitSatisfied ? "ok" : commitCount === 0 ? "bad" : "warn",
        value: String(commitCount),
        unit: `/ ${commitTarget}개`,
        note: commitSatisfied
          ? "✓ 커밋 조건 충족"
          : commitCount === 0
          ? "✕ 커밋 없음"
          : `⚠ ${commitShortfall}개 부족`,
        percent: Math.min(100, Math.round((commitCount / commitTarget) * 100)),
        caption: data.minCommits > 0 ? `기준 ${data.minCommits}개 중` : "기준 없음 · 최소 1개",
      };

  const keywordView: SummaryView = !hasEvaluation
    ? { tone: "idle", value: "-", unit: "", note: "분석 필요", percent: 0 }
    : readmeTotal > 0
    ? {
        tone: readmeResults.satisfied ? "ok" : "warn",
        value: String(readmePassed),
        unit: `/ ${readmeTotal}개`,
        note: readmeResults.satisfied ? "✓ 키워드 모두 사용" : `⚠ ${readmeTotal - readmePassed}개 미사용`,
        percent: Math.round((readmePassed / readmeTotal) * 100),
        caption: `필수 키워드 ${readmeTotal}개 중`,
      }
    : {
        tone: readmeResults.satisfied ? "ok" : "warn",
        value: readmeResults.satisfied ? "✓" : "✕",
        unit: "",
        note: readmeResults.satisfied ? "✓ README 확인됨" : "⚠ README.md 누락",
        percent: readmeResults.satisfied ? 100 : 0,
        caption: "키워드 기준 없음",
      };

  const ACTION_BTN =
    "inline-flex shrink-0 items-center gap-1.5 rounded-2xl bg-surface px-3.5 py-3 text-xs font-semibold text-ink shadow-neu-sm transition hover:shadow-neu-inset disabled:opacity-50";
  const CARD = "neu-hover rounded-[28px] bg-surface shadow-neu";

  return (
    <div className="space-y-8">
      {/* 헤더: 뒤로가기 · 제목 · repo 링크 + 동작 버튼 */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
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

          <h1 className="text-3xl font-normal tracking-tight text-ink sm:text-4xl lg:text-3xl 2xl:text-4xl">{data.assignment?.title}</h1>
          <a
            href={`https://github.com/${data.repo.full_name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex flex-wrap items-center gap-1.5 break-all font-mono text-xs text-muted hover:text-ink hover:underline sm:text-sm lg:text-xs 2xl:text-sm"
          >
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span>{data.repo.full_name}</span>
            <span>· {data.assignment?.branch || "main"}</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 lg:shrink-0 lg:flex-nowrap lg:justify-end">
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

      {/* 제출 요약: 커밋 · README 키워드 · 마감 준수 (한 카드) */}
      <section aria-label="제출 요약" className={`${CARD} p-6 sm:p-7`}>
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

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-0 md:divide-x md:divide-muted/20">
          <SummaryColumn label="커밋" icon={<GitCommit className="h-3.5 w-3.5" />} view={commitView} />
          <SummaryColumn label="README 키워드" icon={<FileText className="h-3.5 w-3.5" />} view={keywordView} />
          <div className="md:px-6">
            <DeadlineCountdown
              deadlineAt={data.assignment?.deadline_at ?? null}
              commitDates={(data.commits || []).map((c: any) => c.committed_at)}
              isSubmitted={isSubmitted}
            />
          </div>
        </div>

        {data.status?.stale && (
          <p className="mt-6 rounded-2xl px-4 py-3 text-xs font-medium text-amber-700 shadow-neu-inset dark:text-amber-400">
            ⚠️ 최근 push 감지됨 (새로고침을 눌러 최신 반영)
          </p>
        )}
      </section>

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

type SummaryTone = "ok" | "warn" | "bad" | "idle";

interface SummaryView {
  tone: SummaryTone;
  value: string;
  unit: string;
  note: string;
  percent: number;
  caption?: string;
}

const SUMMARY_TONE: Record<SummaryTone, { text: string; bar: string }> = {
  ok: { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" },
  warn: { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
  bad: { text: "text-red-600 dark:text-red-400", bar: "bg-red-500" },
  idle: { text: "text-muted", bar: "bg-muted/40" },
};

/** 요약 카드의 한 칸: 라벨 · 큰 숫자(현재 / 기준) · 진행 바 · 상태 */
function SummaryColumn({ label, icon, view }: { label: string; icon: React.ReactNode; view: SummaryView }) {
  const tone = SUMMARY_TONE[view.tone];
  return (
    <div className="space-y-3 md:px-6 md:first:pl-0">
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        {icon}
        {label}
      </span>
      {view.caption && <p className="text-xs text-muted">{view.caption}</p>}
      <p className="flex items-baseline gap-2">
        <span className={`text-5xl font-light tracking-tight ${view.tone === "idle" ? "text-muted" : "text-ink"}`}>
          {view.value}
        </span>
        {view.unit && <span className="text-lg font-light text-muted">{view.unit}</span>}
      </p>
      <div
        className="h-2 w-full overflow-hidden rounded-full shadow-neu-inset"
        role="progressbar"
        aria-label={`${label} 진행률`}
        aria-valuenow={view.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${view.percent}%` }} />
      </div>
      <p className={`text-xs font-semibold ${tone.text}`}>{view.note}</p>
    </div>
  );
}
