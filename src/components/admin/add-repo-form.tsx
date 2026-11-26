"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2, Check } from "lucide-react";

export function AddRepoForm({
  assignmentId,
  orgName,
}: {
  assignmentId: string;
  orgName: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [studentName, setStudentName] = useState("");
  const [githubLogin, setGithubLogin] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // 모달은 document.body에 그린다 (헤더 버튼 줄 안에서 열어도 레이아웃이 밀리지 않도록)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/admin/assignments/${assignmentId}/repos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          studentNo,
          studentName,
          githubLogin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Repo 등록에 실패했습니다.");
      }

      setIsOpen(false);
      setFullName("");
      setStudentNo("");
      setStudentName("");
      setGithubLogin("");
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const trigger = (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-chip px-4 py-2.5 text-[13px] font-semibold text-fg-2 transition hover:text-fg"
    >
      <Plus className="h-3.5 w-3.5" />
      학생 Repo 등록
    </button>
  );

  if (!isOpen || !mounted) return trigger;

  return (
    <>
      {trigger}
      {createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 font-display text-fg">
          <div className="w-full max-w-xl space-y-5 rounded-2xl border border-line bg-canvas p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-bold">학생 Repo 등록</h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="닫기"
                className="rounded-lg p-1 text-fg-3 hover:bg-chip hover:text-fg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorMsg && <p role="alert" className="rounded-lg bg-danger-soft p-3 text-[13px] text-danger">{errorMsg}</p>}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1.5">
                <span className="text-[12px] font-semibold text-fg-2">저장소명 (full_name 또는 repo 이름) *</span>
                <input
                  type="text"
                  placeholder={`예: ${orgName}/assign12-c01-22100063`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-lg bg-chip px-3 py-2.5 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30 font-mono"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-semibold text-fg-2">학생 GitHub 아이디 (선택)</span>
                <input
                  type="text"
                  placeholder="예: AnJunYong02"
                  value={githubLogin}
                  onChange={(e) => setGithubLogin(e.target.value)}
                  
                  className="w-full rounded-lg bg-chip px-3 py-2.5 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-semibold text-fg-2">학번 (선택)</span>
                <input
                  type="text"
                  placeholder="예: 22100063"
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  
                  className="w-full rounded-lg bg-chip px-3 py-2.5 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-[12px] font-semibold text-fg-2">학생 이름 (선택)</span>
                <input
                  type="text"
                  placeholder="예: 홍길동"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  
                  className="w-full rounded-lg bg-chip px-3 py-2.5 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-xl bg-chip px-4 py-2.5 text-[13px] font-semibold text-fg-2 hover:text-fg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  저장소 등록
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
