"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface CommitChartProps {
  commits: { committed_at: string; sha: string }[];
}

export function CommitChart({ commits }: CommitChartProps) {
  // Aggregate commits by KST Date (YYYY-MM-DD)
  const chartData = useMemo(() => {
    if (!commits || commits.length === 0) return [];

    const map = new Map<string, number>();

    for (const c of commits) {
      const date = new Date(c.committed_at);
      // KST formatting: UTC + 9
      const kstDateStr = new Intl.DateTimeFormat("ko-KR", {
        timeZone: "Asia/Seoul",
        month: "2-digit",
        day: "2-digit",
      }).format(date);

      map.set(kstDateStr, (map.get(kstDateStr) || 0) + 1);
    }

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [commits]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
        기록된 커밋 히스토리가 없습니다.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">일자별 커밋 추이 (KST 기준)</h3>
        <span className="text-xs text-slate-500">총 {commits.length}개 커밋</span>
      </div>
      <div className="h-56 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                borderRadius: "8px",
                border: "none",
                fontSize: "12px",
                color: "#f8fafc",
              }}
              formatter={(value: any) => [`${value} 커밋`, "커밋 수"]}
            />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
