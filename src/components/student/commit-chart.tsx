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
      <div className="neu-hover flex h-48 items-center justify-center rounded-[28px] bg-surface text-xs text-muted shadow-neu">
        기록된 커밋 히스토리가 없습니다.
      </div>
    );
  }

  return (
    <div className="neu-hover rounded-[28px] bg-surface p-6 shadow-neu space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink/80">일자별 커밋 추이 (KST 기준)</h3>
        <span className="text-xs text-muted">총 {commits.length}개 커밋</span>
      </div>
      <div className="h-56 w-full pt-2 text-lilac-ink">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--muted) / 0.25)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "rgb(var(--muted))" }} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: "rgb(var(--violet) / 0.35)" }}
              contentStyle={{
                backgroundColor: "rgb(var(--surface))",
                borderRadius: "14px",
                border: "none",
                fontSize: "12px",
                color: "rgb(var(--ink))",
                boxShadow: "4px 4px 10px rgb(var(--neu-dark) / 0.4), -4px -4px 10px rgb(var(--neu-light) / 0.85)",
              }}
              formatter={(value: any) => [`${value} 커밋`, "커밋 수"]}
            />
            <Bar dataKey="count" fill="currentColor" radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
