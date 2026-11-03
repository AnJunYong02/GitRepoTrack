"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, CheckCircle2, Sparkles } from "lucide-react";

interface BatchAnalyzeButtonProps {
  assignmentId: string;
  totalCount: number;
  unanalyzedCount?: number;
}

export function BatchAnalyzeButton({
  assignmentId,
  totalCount,
  unanalyzedCount = 0,
}: BatchAnalyzeButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [resultMsg, setResultMsg] = useState("");

  const needsInitialAnalysis = !loading && !resultMsg && unanalyzedCount > 0;

  const handleBatchAnalyze = async () => {
    if (loading) return;
    if (
      !confirm(
        `등록된 학생 저장소 전체(${totalCount}개)에 대해 최신 소스코드 및 README 키워드를 즉시 분석하시겠습니까?`
      )
    ) {
      return;
    }

    setLoading(true);
    setProgressMsg("분석 준비 중...");
    setResultMsg("");

    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}/batch-analyze`, {
        method: "POST",
      });

      if (!res.ok) {
        const text = await res.text();
        let errMsg = "일괄 분석 중 오류가 발생했습니다.";
        try {
          const parsed = JSON.parse(text);
          if (parsed.error) errMsg = parsed.error;
        } catch (_) {
          if (text) errMsg = text;
        }
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("스트림 응답을 읽을 수 없습니다.");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "start") {
              setProgressMsg(`0개 분석 완료... (0/${data.total})`);
            } else if (data.type === "progress") {
              setProgressMsg(`${data.analyzedCount}개 분석 완료... (${data.analyzedCount}/${data.total})`);
            } else if (data.type === "done") {
              setResultMsg(`전체 ${data.total}개 중 ${data.successCount}개 분석 완료!`);
              setProgressMsg("");
            }
          } catch (_) {
            // ignore non-json line
          }
        }
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message || "오류가 발생했습니다.");
      setProgressMsg("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {needsInitialAnalysis && (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/70 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/30 animate-pulse">
          <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>미분석 {unanalyzedCount}명 · 먼저 클릭해주세요 👉</span>
        </span>
      )}
      {loading && progressMsg && (
        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1.5 animate-pulse">
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          <span>{progressMsg}</span>
        </span>
      )}
      {!loading && resultMsg && (
        <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{resultMsg}</span>
        </span>
      )}
      <button
        onClick={handleBatchAnalyze}
        disabled={loading || totalCount === 0}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-500 transition disabled:opacity-50 ${
          needsInitialAnalysis
            ? "ring-4 ring-blue-500/30 dark:ring-blue-400/30 shadow-blue-500/20 shadow-md"
            : ""
        }`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Play className="w-3.5 h-3.5 fill-current" />
        )}
        <span>{loading ? "분석 중..." : "분석하기"}</span>
      </button>
    </div>
  );
}
