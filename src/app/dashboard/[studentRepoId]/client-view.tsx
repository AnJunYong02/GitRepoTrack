"use client";

import { useState } from "react";
import Link from "next/link";
import { BackLink } from "@/components/navigation/back-link";
import { AlertCircle, AlertTriangle, ArrowLeft, ArrowUpRight, Check, Download, Play, RefreshCw, Trophy, X } from "lucide-react";
import { ReadmeChecklist } from "@/components/student/readme-checklist";
import { ReferenceNotice } from "@/components/student/reference-notice";
import { CommitChart } from "@/components/student/commit-chart";
import { CommitTimeline } from "@/components/student/commit-timeline";
import { DeadlineCountdown } from "@/components/student/deadline-countdown";
import { weekTitle } from "@/lib/student/student-assignments";
import { formatKstDateTime } from "@/lib/student/time-utils";

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
    /** 주차 번호 (없으면 과제 제목 사용) */
    weekNo: number | null;
  };
}

const BTN =
  "inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-3 text-[13px] font-semibold transition disabled:opacity-50";
const BTN_GRAY = `${BTN} bg-chip text-fg-2 hover:text-fg`;

export function ClientDashboardView({ studentRepoId, isOrgOwner = false, initialData }: ClientDashboardViewProps) {
  const data = initialData;
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      if (!res.ok) throw new Error(json.error || "분석 요청에 실패했습니다.");
      // 최신 결과 다시 불러오기
      window.location.reload();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const evalData = data.evaluation;
  const readmeResults = evalData?.readme_results || { satisfied: false, missingKeywords: [], details: [] };
  const repoOrg = data.assignment?.org_name || (data.repo?.full_name ? data.repo.full_name.split("/")[0] : "");
  const branch = data.assignment?.branch || "main";

  // 요약 값 — 학생 대시보드 목록(student-assignments.ts)과 같은 규칙
  const hasEvaluation = Boolean(evalData);
  const hasSnapshot = Boolean(data.status?.latest_snapshot_id) && data.snapshotCommitCount !== null;
  const commitCount = data.snapshotCommitCount ?? 0;
  const commitTarget = data.minCommits > 0 ? data.minCommits : 1;
  const commitSatisfied = hasSnapshot && commitCount > 0 && commitCount >= commitTarget;

  const readmeDetails: { keyword: string; found: boolean }[] = Array.isArray(readmeResults.details)
    ? readmeResults.details
    : [];
  const readmeTotal = readmeDetails.length;
  const readmePassed = readmeDetails.filter((d) => d.found).length;

  const commitView: SummaryView = !hasSnapshot
    ? { tone: "idle", value: "-", unit: `/${commitTarget}개`, note: "분석 필요", percent: 0 }
    : {
        tone: commitSatisfied ? "ok" : "bad",
        value: String(commitCount),
        unit: `/${commitTarget}개`,
        note: commitSatisfied
          ? "커밋 조건 충족"
          : commitCount === 0
          ? "커밋 없음"
          : `${commitTarget - commitCount}개 부족`,
        percent: Math.min(100, Math.round((commitCount / commitTarget) * 100)),
      };

  const keywordView: SummaryView = !hasEvaluation
    ? { tone: "idle", value: "-", unit: "", note: "분석 필요", percent: 0 }
    : readmeTotal > 0
    ? {
        tone: readmeResults.satisfied ? "ok" : "bad",
        value: String(readmePassed),
        unit: `/${readmeTotal}개`,
        note: readmeResults.satisfied ? "키워드 모두 사용" : `${readmeTotal - readmePassed}개 미사용`,
        percent: Math.round((readmePassed / readmeTotal) * 100),
      }
    : {
        tone: readmeResults.satisfied ? "ok" : "bad",
        value: readmeResults.satisfied ? "✓" : "✕",
        unit: "",
        note: readmeResults.satisfied ? "README 확인됨" : "README.md 누락",
        percent: readmeResults.satisfied ? 100 : 0,
      };

  const backHref =
    isOrgOwner && data.assignment?.id
      ? `/admin/assignments/${data.assignment.id}`
      : repoOrg
      ? `/dashboard/assignments?org=${encodeURIComponent(repoOrg)}`
      : "/dashboard";

  return (
    <div className="space-y-10">
      {/* 헤더 */}
      <header className="space-y-5">
        <BackLink
          fallbackHref={backHref}
          className="inline-flex items-center gap-1.5 rounded-xl bg-chip px-4 py-2.5 text-[15px] font-semibold text-fg-2 transition hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isOrgOwner ? "과제 관리 화면" : "내 과제 목록"}</span>
        </BackLink>

        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            <h1 className="text-[34px] font-bold tracking-[-0.03em] text-fg sm:text-[42px]">
              {weekTitle(data.weekNo, data.assignment?.title || "과제")}
            </h1>
            <a
              href={`https://github.com/${data.repo.full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-wrap items-center gap-1.5 [overflow-wrap:anywhere] font-mono text-[13px] text-fg-2 hover:text-fg hover:underline"
            >
              {data.repo.full_name} · {branch}
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 xl:pt-2">
            <button onClick={() => handleAnalyze(false)} disabled={loading} className={`${BTN} bg-brand text-white hover:brightness-110`}>
              <Play className="h-3.5 w-3.5" />
              분석하기
            </button>
            <button onClick={() => handleAnalyze(true)} disabled={loading} className={BTN_GRAY}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              GitHub 새로고침
            </button>
            {/* 본인 Repo ZIP 다운로드 */}
            <a href={`/api/repos/${studentRepoId}/archive`} className={BTN_GRAY} download>
              <Download className="h-3.5 w-3.5" />
              Repo 다운로드 (.zip)
            </a>
            {data.assignment?.id && data.assignment?.ranking_mode !== "none" && (
              <Link href={`/assignments/${data.assignment.id}/leaderboard`} className={BTN_GRAY}>
                <Trophy className="h-4 w-4 text-amber-500" />
                실시간 순위표
              </Link>
            )}
          </div>
        </div>

        {/* 참고용 안내(왼쪽) + push 감지 · 마지막 갱신(오른쪽)을 한 줄에 */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <ReferenceNotice subject="이 분석 결과" variant="inline" />
          {(data.status?.stale || data.status?.fetched_at) && (
            <p className="shrink-0 text-[12px] text-fg-3 sm:pt-px">
              {data.status?.stale && <span className="text-fg-2">최근 push 감지됨 · GitHub 새로고침으로 최신 반영 · </span>}
              {data.status?.fetched_at && <>마지막 갱신 {formatKstDateTime(data.status.fetched_at, true)}</>}
            </p>
          )}
        </div>

        {message && (
          <p role="alert" className="flex items-center gap-2 text-[13px] text-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {message}
          </p>
        )}
      </header>

      {/* 제출 요약 3열 */}
      <section
        aria-label="제출 요약"
        className="grid grid-cols-1 divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0"
      >
        <SummaryColumn label="커밋" view={commitView} />
        <SummaryColumn label="README 키워드" view={keywordView} />
        <div className="py-8 md:px-9">
          <DeadlineCountdown
            deadlineAt={data.assignment?.deadline_at ?? null}
            commitDates={(data.commits || []).map((c: any) => c.committed_at)}
          />
        </div>
      </section>

      {/* README 키워드 검사 | 커밋 추이 · 이력 */}
      <div className="grid grid-cols-1 gap-14 pt-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
        {/* 두 열은 그리드 기본 stretch로 높이가 같음 → 각 열 아래 구분선이 같은 높이에 그려짐 */}
        <div className="min-w-0 border-b border-line pb-10">
          <ReadmeChecklist
            satisfied={readmeResults.satisfied}
            missingKeywords={readmeResults.missingKeywords}
            details={readmeResults.details}
          />
        </div>
        <div className="min-w-0 space-y-14 border-b border-line pb-10">
          <CommitChart commits={data.commits} />
          <CommitTimeline commits={data.commits} />
        </div>
      </div>
    </div>
  );
}

type SummaryTone = "ok" | "bad" | "idle";

interface SummaryView {
  tone: SummaryTone;
  value: string;
  unit: string;
  note: string;
  percent: number;
}

const SUMMARY_TONE: Record<SummaryTone, { text: string; bar: string }> = {
  ok: { text: "text-brand", bar: "bg-brand" },
  bad: { text: "text-danger", bar: "bg-danger" },
  idle: { text: "text-fg-3", bar: "bg-fg-3" },
};

/** 요약 한 칸: 제목 · 큰 숫자/기준 · 상태 · 진행 바 */
function SummaryColumn({ label, view }: { label: string; view: SummaryView }) {
  const tone = SUMMARY_TONE[view.tone];
  const Icon = view.tone === "ok" ? Check : view.tone === "bad" ? AlertTriangle : X;
  return (
    <div className="space-y-5 py-8 md:px-9 md:first:pl-0">
      <h2 className="text-[18px] font-bold text-fg">{label}</h2>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className={`text-[44px] font-bold leading-none tracking-tight ${view.tone === "idle" ? "text-fg-3" : "text-fg"}`}>
          {view.value}
          {view.unit && <span className="ml-0.5 text-[18px] font-normal text-fg-3">{view.unit}</span>}
        </span>
        <span className={`inline-flex items-center gap-1 text-[13px] font-semibold ${tone.text}`}>
          {view.tone !== "idle" && <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />}
          {view.note}
        </span>
      </p>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label={`${label} 진행률`}
        aria-valuenow={view.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${view.percent}%` }} />
      </div>
    </div>
  );
}
