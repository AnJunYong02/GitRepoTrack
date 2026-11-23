"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Search, X } from "lucide-react";
import type { StudentStatusRow } from "@/lib/admin/student-status-rows";
import { formatKstDateTime } from "@/lib/student/time-utils";

/** 과제 관리 화면 오른쪽 "학생별 제출 현황" 표 (학번 검색) */
export function StudentStatusTable({ rows }: { rows: StudentStatusRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => (r.studentNo || "").toLowerCase().includes(q) || r.repoName.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <section aria-label="학생별 제출 현황" className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="flex items-baseline gap-2 text-[22px] font-bold tracking-tight text-fg">
          학생별 제출 현황
          <span className="text-[14px] font-medium text-fg-3">{rows.length}명</span>
        </h2>
        <label className="relative sm:w-[340px]">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-3" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="학번으로 검색"
            aria-label="학번으로 검색"
            className="w-full rounded-xl bg-chip py-3 pl-10 pr-4 text-[13px] text-fg placeholder:text-fg-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-line text-[12px] text-fg-3">
            <tr>
              <th className="py-3 pr-4 font-medium">학번</th>
              <th className="py-3 pr-4 font-medium">Repository</th>
              <th className="py-3 pr-4 font-medium">제출</th>
              <th className="py-3 pr-4 font-medium">커밋</th>
              <th className="py-3 pr-4 font-medium">README</th>
              <th className="py-3 font-medium">마지막 Push</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-[14px] text-fg-3">
                  {rows.length === 0 ? "매핑된 학생 repo가 아직 없어요." : `"${query}"와 일치하는 학생이 없어요.`}
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-line text-[15px]">
                  <td className="py-3.5 pr-4">
                    <Link
                      href={`/dashboard/${r.id}`}
                      title="이 학생의 분석 대시보드 보기"
                      className="font-bold tabular-nums text-fg hover:underline"
                    >
                      {r.studentNo || "-"}
                    </Link>
                  </td>
                  <td className="py-3.5 pr-4">
                    <a
                      href={`https://github.com/${r.fullName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[13px] text-fg-3 hover:text-fg"
                    >
                      {r.repoName}
                      <ArrowUpRight className="h-3 w-3 shrink-0" />
                    </a>
                  </td>
                  <td className="whitespace-nowrap py-3.5 pr-4 font-semibold">
                    {r.submitState === "submitted" ? (
                      <span className="inline-flex items-center gap-1 text-brand">
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        제출
                      </span>
                    ) : r.submitState === "unsubmitted" ? (
                      <span className="inline-flex items-center gap-1 text-danger">
                        <X className="h-3.5 w-3.5" strokeWidth={3} />
                        미제출
                      </span>
                    ) : (
                      <span className="text-fg-3">분석 대기</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3.5 pr-4 font-bold tabular-nums">
                    {r.submitState === "pending" && r.commitCount === 0 ? (
                      <span className="text-fg-3">-</span>
                    ) : r.minCommits > 0 ? (
                      <span className={r.commitsMet ? "text-brand" : "text-danger"}>
                        {r.commitCount} / {r.minCommits}
                      </span>
                    ) : (
                      <span className="text-fg">{r.commitCount}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3.5 pr-4 font-bold tabular-nums">
                    {r.readmeShown ? (
                      <span className={r.readmePassed === r.readmeTotal ? "text-brand" : "text-danger"}>
                        {r.readmePassed} / {r.readmeTotal}
                      </span>
                    ) : (
                      <span className="text-fg-3">–</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap py-3.5 tabular-nums text-fg-2">
                    {r.lastPushAt ? formatKstDateTime(r.lastPushAt) : <span className="text-fg-3">–</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
