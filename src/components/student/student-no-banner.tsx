"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, RefreshCw, CheckCircle2, AlertCircle, Lock, Clock } from "lucide-react";

interface StudentNoBannerProps {
  initialStudentNo: string | null;
  repoCount: number;
  activeOrg?: string;
}

export function StudentNoBanner({
  initialStudentNo,
  repoCount,
  activeOrg = "2026-2-WebService",
}: StudentNoBannerProps) {
  const router = useRouter();
  const [linkedStudentNo, setLinkedStudentNo] = useState<string | null>(initialStudentNo);
  const [studentNoInput, setStudentNoInput] = useState(initialStudentNo || "");
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!loading) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedMs(0);
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(timer);
  }, [loading]);

  const handleSync = async (targetNo?: string) => {
    const noToSubmit = (targetNo ?? studentNoInput).trim();
    if (!/^[0-9]{6,10}$/.test(noToSubmit)) {
      setFeedback({
        type: "error",
        text: "학번은 6~10자리 숫자로 입력해주세요. (예: 22300743)",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/student/student-no", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNo: noToSubmit, orgName: activeOrg }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "학번 연동에 실패했습니다.");
      }

      setLinkedStudentNo(noToSubmit);
      setStudentNoInput(noToSubmit);
      setFeedback({
        type: "success",
        text: `${activeOrg} Organization에서 학번(${noToSubmit}) 기준으로 총 ${data.linkedCount}개의 과제 저장소를 동기화했습니다.`,
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "오류가 발생했습니다.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="neu-hover rounded-[28px] bg-surface p-5 sm:p-6 shadow-neu space-y-3">
      {linkedStudentNo ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lilac text-lilac-ink shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">내 학번</span>
                <span className="inline-flex items-center gap-1 rounded-xl px-3 py-1 text-sm font-semibold tracking-wide text-ink shadow-neu-inset">
                  <span>{linkedStudentNo}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleSync(linkedStudentNo)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-surface px-4 py-2.5 text-xs font-semibold text-ink shadow-neu-sm hover:shadow-neu-inset transition disabled:opacity-70"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-lilac-ink" : ""}`} />
              <span>
                {loading
                  ? `새로고침 중... (${(elapsedMs / 1000).toFixed(1)}초)`
                  : "최신 Repo 동기화"}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lilac text-lilac-ink shrink-0 mt-0.5">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-ink">
                최초 1회 내 학번 등록 및 Organization 과제 Repo 연동
              </h2>
              <p className="text-xs text-muted">
                본인의 학번(예: <code className="font-mono font-semibold text-ink">22300743</code>)을 입력하면 Organization 내 본인 학번의 과제 저장소들을 자동으로 가져옵니다.
              </p>
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                🔒 타 학생의 Repo 보호를 위해 한 번 등록된 학번은 이후 변경할 수 없으니 반드시 본인의 학번을 정확히 입력해주세요.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSync();
            }}
            className="flex flex-wrap items-center gap-2 sm:pl-13"
          >
            <input
              type="text"
              value={studentNoInput}
              onChange={(e) => setStudentNoInput(e.target.value)}
              placeholder="본인 학번 입력 (예: 22300743)"
              className="w-full sm:w-64 rounded-2xl border-0 bg-transparent px-4 py-2.5 text-xs font-mono text-ink placeholder:text-muted shadow-neu-inset focus:outline-none focus:ring-2 focus:ring-lilac-ink/30"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-2xl bg-surface px-4 py-2.5 text-xs font-semibold text-ink shadow-neu-sm hover:shadow-neu-inset transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>
                {loading
                  ? `Organization 스캔 중... (${(elapsedMs / 1000).toFixed(1)}초)`
                  : "내 학번 등록 및 Repo 불러오기"}
              </span>
            </button>
          </form>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl p-3 shadow-neu-inset space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-ink">
              {elapsedMs < 800
                ? `1/2단계: ${activeOrg} Organization 연결 확인 중...`
                : `2/2단계: 학번(${linkedStudentNo || studentNoInput})과 일치하는 최신 과제 저장소 동기화 중...`}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-muted">
              <Clock className="w-3 h-3" />
              {(elapsedMs / 1000).toFixed(1)}초 경과
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted/15 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-150 ease-out"
              style={{
                width: `${Math.min(
                  94,
                  Math.max(15, Math.round((1 - Math.exp(-elapsedMs / 1200)) * 95))
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}
    </div>
  );
}
