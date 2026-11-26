"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, GraduationCap, RefreshCw } from "lucide-react";

interface StudentNoBannerProps {
  activeOrg: string;
}

/** 학번 미등록 학생용: 최초 1회 학번 등록 + org 과제 저장소 연동 */
export function StudentNoBanner({ activeOrg }: StudentNoBannerProps) {
  const router = useRouter();
  const [studentNoInput, setStudentNoInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!loading) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(timer);
  }, [loading]);

  const handleSubmit = async () => {
    const no = studentNoInput.trim();
    if (!/^[0-9]{6,10}$/.test(no)) {
      setFeedback({ type: "error", text: "학번은 6~10자리 숫자로 입력해주세요. (예: 22300743)" });
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/student/student-no", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentNo: no, orgName: activeOrg }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "학번 연동에 실패했습니다.");
      setFeedback({
        type: "success",
        text: `${activeOrg}에서 학번(${no}) 기준으로 ${data.linkedCount ?? 0}개의 과제 저장소를 연결했습니다.`,
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  const progress = Math.min(94, Math.max(15, Math.round((1 - Math.exp(-elapsedMs / 1200)) * 95)));

  return (
    <section aria-label="학번 등록" className="space-y-5 border-y border-line py-8">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div className="space-y-1.5">
          <h2 className="text-[20px] font-bold tracking-tight text-fg">학번을 등록하고 과제 저장소를 불러오세요</h2>
          <p className="text-[14px] text-fg-2">
            본인 학번(예: <code className="font-mono font-semibold text-fg">22300743</code>)을 입력하면 {activeOrg}에서
            학번이 들어간 과제 저장소를 자동으로 찾아 연결합니다.
          </p>
          <p className="text-[12px] font-medium text-danger">
            다른 학생의 저장소 보호를 위해 한 번 등록한 학번은 바꿀 수 없어요. 정확히 입력해 주세요.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="flex flex-wrap items-center gap-2 sm:pl-[60px]"
      >
        <input
          type="text"
          inputMode="numeric"
          value={studentNoInput}
          onChange={(e) => setStudentNoInput(e.target.value)}
          placeholder="학번 입력 (예: 22300743)"
          aria-label="학번"
          disabled={loading}
          className="w-full rounded-xl border border-line bg-chip px-4 py-3 font-mono text-[14px] text-fg placeholder:font-sans placeholder:text-fg-3 focus:border-brand focus:outline-none sm:w-72"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-3 text-[14px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? `불러오는 중... (${(elapsedMs / 1000).toFixed(1)}초)` : "학번 등록 및 Repo 불러오기"}
        </button>
      </form>

      {loading && (
        <div className="h-1 w-full max-w-md overflow-hidden rounded-full bg-line sm:ml-[60px]" role="status" aria-label="불러오는 중">
          <div className="h-full rounded-full bg-brand transition-all duration-150" style={{ width: `${progress}%` }} />
        </div>
      )}

      {feedback && (
        <p
          role="status"
          className={`flex items-center gap-1.5 text-[13px] sm:pl-[60px] ${feedback.type === "success" ? "text-brand" : "text-danger"}`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.text}
        </p>
      )}
    </section>
  );
}
