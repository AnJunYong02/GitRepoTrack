"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, FolderGit2, Loader2, Check } from "lucide-react";

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

  return (
    <div>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>학생 Repo 등록</span>
        </button>
      ) : (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold">새 학생 과제 저장소(Repo) 등록</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/60 p-2.5 text-xs text-red-600 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  저장소명 (Repo full_name 또는 repo 이름) *
                </label>
                <input
                  type="text"
                  placeholder={`예: ${orgName}/assignment-1-student`}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  학생 GitHub 아이디 (선택)
                </label>
                <input
                  type="text"
                  placeholder="예: AnJunYong02"
                  value={githubLogin}
                  onChange={(e) => setGithubLogin(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  학번 (선택)
                </label>
                <input
                  type="text"
                  placeholder="예: 20261234"
                  value={studentNo}
                  onChange={(e) => setStudentNo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  학생 이름 (선택)
                </label>
                <input
                  type="text"
                  placeholder="예: 안준용"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>저장소 등록</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
