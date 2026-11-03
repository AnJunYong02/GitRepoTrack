"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { ArrowLeft, Save, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function NewAssignmentPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [orgName, setOrgName] = useState("");
  const [branch, setBranch] = useState("main");
  const [deadline, setDeadline] = useState("");
  const [rankingMode, setRankingMode] = useState<"live" | "none">("live");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          orgName,
          branch,
          deadlineAt: new Date(deadline).toISOString(),
          rankingMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "과제 생성 실패");
      }

      router.push(`/admin/assignments/${data.assignment.id}`);
    } catch (err: any) {
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <main className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>관리자 과제 목록으로 돌아가기</span>
        </Link>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h1 className="text-xl font-bold">새 과제 등록</h1>
            <p className="text-xs text-slate-500 mt-1">
              GitHub Organization 과제를 등록하고 분석 대상 브랜치 및 마감 시각을 지정합니다.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">과제명 *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 4주차 웹서비스 개발 실습"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">GitHub Organization 이름 *</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="예: univ-web-2026"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">분석 대상 브랜치</label>
                <input
                  type="text"
                  required
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">과제 마감 시각 (KST) *</label>
                <input
                  type="datetime-local"
                  required
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">순위표 운영 모드</label>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rankingMode"
                    value="live"
                    checked={rankingMode === "live"}
                    onChange={() => setRankingMode("live")}
                  />
                  <span>실시간 최초 충족 순위표 제공</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="rankingMode"
                    value="none"
                    checked={rankingMode === "none"}
                    onChange={() => setRankingMode("none")}
                  />
                  <span>순위 없이 제출 현황만 표시</span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? "등록 중..." : "과제 등록 완료"}</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
