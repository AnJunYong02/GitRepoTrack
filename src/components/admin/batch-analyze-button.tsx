"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Loader2, CheckCircle2 } from "lucide-react";

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
    // 진행·결과 문구는 버튼 바로 아래 한 줄 (헤더 버튼 줄의 정렬을 흔들지 않도록 absolute)
    <div className="relative">
      <button
        type="button"
        onClick={handleBatchAnalyze}
        disabled={loading || totalCount === 0}
        title={needsInitialAnalysis ? `미분석 ${unanalyzedCount}명 · 먼저 분석해 주세요` : undefined}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-50 ${
          needsInitialAnalysis ? "ring-4 ring-brand/25" : ""
        }`}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        {loading ? "분석 중..." : "분석하기"}
      </button>
      {loading && progressMsg && (
        <p role="status" className="absolute left-0 top-full mt-2 flex items-center gap-1 whitespace-nowrap text-[12px] text-fg-2">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          {progressMsg}
        </p>
      )}
      {!loading && resultMsg && (
        <p role="status" className="absolute left-0 top-full mt-2 flex items-center gap-1 whitespace-nowrap text-[12px] text-brand">
          <CheckCircle2 className="h-3 w-3 shrink-0" />
          {resultMsg}
        </p>
      )}
    </div>
  );
}
