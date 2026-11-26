"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CheckCircle, FileUp, Search } from "lucide-react";
import { formatKstDateTime } from "@/lib/student/time-utils";

export interface RosterStudentView {
  studentNo: string;
  name: string;
  githubLogin: string | null;
  updatedAt: string | null;
}

interface UploadError {
  line: number;
  reason: string;
}

/** 학생 관리 화면: CSV 업로드(명단 전체 교체) + 현재 명단 표 */
export function StudentRosterManager({ org, students }: { org: string; students: RosterStudentView[] }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [rowErrors, setRowErrors] = useState<UploadError[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [query, setQuery] = useState("");

  const lastUpdatedAt = useMemo(() => {
    const times = students.map((s) => (s.updatedAt ? new Date(s.updatedAt).getTime() : 0));
    const max = times.length ? Math.max(...times) : 0;
    return max > 0 ? new Date(max).toISOString() : null;
  }, [students]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.studentNo.includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.githubLogin || "").toLowerCase().includes(q)
    );
  }, [students, query]);

  const handleUpload = async () => {
    if (!file) return;
    if (
      students.length > 0 &&
      !window.confirm(`현재 명단 ${students.length}명을 "${file.name}" 내용으로 모두 교체할까요?`)
    ) {
      return;
    }

    setIsUploading(true);
    setErrorMsg("");
    setRowErrors([]);
    setSuccessMsg("");
    try {
      const form = new FormData();
      form.append("org", org);
      form.append("file", file);
      const res = await fetch("/api/admin/students", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data.error || "업로드에 실패했습니다.");
        setRowErrors(Array.isArray(data.errors) ? data.errors : []);
        return;
      }
      setSuccessMsg(`${data.count}명의 학생 명단을 저장했어요.`);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message || "업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-14">
      <header className="space-y-3">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-chart">
          <span className="h-2 w-2 rounded-full bg-chart" aria-hidden />
          {org}
        </p>
        <h1 className="text-[34px] font-bold tracking-[-0.03em] text-fg sm:text-[44px]">학생 관리</h1>
      </header>

      <div className="grid grid-cols-1 gap-14 xl:grid-cols-[440px_minmax(0,1fr)] xl:gap-16">
        {/* 왼쪽: CSV 업로드 */}
        <section aria-label="학생 명단 업로드" className="space-y-7">
          <h2 className="text-[22px] font-bold tracking-tight text-fg">CSV 업로드</h2>

          <div className="space-y-2">
            <p className="text-[15px] font-bold text-fg">파일 형식</p>
            <p className="text-[12px] leading-relaxed text-fg-3">
              📍 첫 줄에 헤더가 있어야 함.<br/>
                📍 학번은 필수, 이름 / 깃허브아이디는 선택
            </p>
            <pre className="overflow-x-auto rounded-xl bg-chip px-4 py-3 font-mono text-[12px] text-fg-2">
              {"학번,이름,깃허브아이디\n22100XXX,홍길동,octocat"}
            </pre>
          </div>

          <div className="space-y-3 border-t border-line pt-7">
            <label
              htmlFor="roster-file"
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-4 py-8 text-center transition hover:border-brand/50"
            >
              <FileUp className="h-6 w-6 text-fg-3" />
              <span className="text-[14px] font-semibold text-fg">{file ? file.name : "CSV 파일 선택"}</span>
              <span className="text-[12px] text-fg-3">1MB 이하 · .csv</span>
            </label>
            <input
              id="roster-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErrorMsg("");
                setRowErrors([]);
                setSuccessMsg("");
              }}
            />
            <p className="text-[12px] text-fg-3">업로드하면 기존 명단은 새 파일 내용으로 모두 교체돼요.</p>
          </div>

          {errorMsg && (
            <div role="alert" className="space-y-2 text-[13px] text-danger">
              <p className="font-semibold">{errorMsg}</p>
              {rowErrors.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto text-[12px]">
                  {rowErrors.map((e, i) => (
                    <li key={i}>
                      {e.line}번째 줄: {e.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {successMsg && (
            <p className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand">
              <CheckCircle className="h-4 w-4" />
              {successMsg}
            </p>
          )}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-4 text-[15px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {isUploading ? "업로드 중..." : "업로드"}
          </button>
        </section>

        {/* 오른쪽: 현재 명단 */}
        <section aria-label="학생 명단" className="min-w-0 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="flex items-baseline gap-2 text-[22px] font-bold tracking-tight text-fg">
              학생 명단
              <span className="text-[14px] font-medium text-fg-3">{students.length}명</span>
              {lastUpdatedAt && (
                <span className="text-[12px] font-normal text-fg-3">· {formatKstDateTime(lastUpdatedAt)} 업로드</span>
              )}
            </h2>
            <label className="relative sm:w-[340px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="학번 · 이름 · GitHub ID 검색"
                aria-label="학번, 이름, GitHub ID로 검색"
                className="w-full rounded-xl bg-chip py-3 pl-10 pr-4 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead className="border-b border-line text-[12px] text-fg-3">
                <tr>
                  <th className="py-3 pr-4 font-medium">학번</th>
                  <th className="py-3 pr-4 font-medium">이름</th>
                  <th className="py-3 font-medium">GitHub ID</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-[14px] text-fg-3">
                      {students.length === 0
                        ? "아직 업로드된 명단이 없어요. 왼쪽에서 CSV를 올려주세요."
                        : `"${query}"와 일치하는 학생이 없어요.`}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.studentNo} className="border-b border-line text-[15px]">
                      <td className="py-3.5 pr-4 font-bold tabular-nums text-fg">{s.studentNo}</td>
                      <td className="py-3.5 pr-4 text-fg">{s.name || <span className="text-fg-3">–</span>}</td>
                      <td className="py-3.5">
                        {s.githubLogin ? (
                          <a
                            href={`https://github.com/${encodeURIComponent(s.githubLogin)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[13px] text-fg-2 hover:text-fg"
                          >
                            {s.githubLogin}
                            <ArrowUpRight className="h-3 w-3 shrink-0" />
                          </a>
                        ) : (
                          <span className="text-fg-3">–</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
