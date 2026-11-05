"use client";

import { useState } from "react";
import Link from "next/link";
import { RefreshCw, Play, Clock, AlertCircle, GitBranch, ArrowLeft, ExternalLink, Trophy } from "lucide-react";
import { ReadmeChecklist } from "@/components/student/readme-checklist";
import { CommitChart } from "@/components/student/commit-chart";
import { CommitTimeline } from "@/components/student/commit-timeline";
import { DeadlineCountdown } from "@/components/student/deadline-countdown";

interface ClientDashboardViewProps {
  studentRepoId: string;
  isStaff?: boolean;
  initialData: {
    repo: any;
    assignment: any;
    status: any;
    evaluation: any;
    commits: any[];
  };
}

export function ClientDashboardView({ studentRepoId, isStaff = false, initialData }: ClientDashboardViewProps) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href={
            isStaff && data.assignment?.id
              ? `/admin/assignments/${data.assignment.id}`
              : repoOrg
              ? `/dashboard?org=${encodeURIComponent(repoOrg)}`
              : "/dashboard"
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isStaff ? "뒤로가기 (과제 관리 화면)" : "뒤로가기 (내 과제 목록)"}</span>
        </Link>

        {data.assignment?.id && data.assignment?.ranking_mode !== "none" && (
          <Link
            href={`/assignments/${data.assignment.id}/leaderboard`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition"
          >
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>실시간 순위표 보기</span>
          </Link>
        )}
      </div>

      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <a
              href={`https://github.com/${data.repo.full_name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>{data.repo.full_name}</span>
              <span>· {data.assignment?.branch || "main"}</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </a>
            <h1 className="text-2xl font-bold mt-2">{data.assignment?.title}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleAnalyze(false)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 text-blue-600" />
              <span>분석하기</span>
            </button>
            <button
              onClick={() => handleAnalyze(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>GitHub 새로고침</span>
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg p-3 text-xs ${
              message.type === "error"
                ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{message.text}</span>
          </div>
        )}

        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              제출 판정:{" "}
              <strong className={isSubmitted ? "text-emerald-600" : "text-amber-600"}>
                {isSubmitted ? "충족 (제출 완료)" : "미충족"}
              </strong>
            </span>
            {data.status?.fetched_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                마지막 갱신: {new Date(data.status.fetched_at).toLocaleString("ko-KR")}
              </span>
            )}
          </div>
          {data.status?.stale && (
            <span className="text-amber-600 font-medium">
              ⚠️ 최근 push 감지됨 (새로고침을 눌러 최신 반영)
            </span>
          )}
        </div>

        <DeadlineCountdown
          deadlineAt={data.assignment?.deadline_at ?? null}
          commitDates={(data.commits || []).map((c: any) => c.committed_at)}
          isSubmitted={isSubmitted}
        />
      </div>

      {/* Main Content Grid: Left/Center = README Checklist (Passed vs Failed 2-column), Right = Daily Commit Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 min-w-0">
          <ReadmeChecklist
            satisfied={readmeResults.satisfied}
            missingKeywords={readmeResults.missingKeywords}
            details={readmeResults.details}
          />
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-20 min-w-0 space-y-6">
          <CommitChart commits={data.commits} />
          <CommitTimeline commits={data.commits} />
        </div>
      </div>
    </div>
  );
}
