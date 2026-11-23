"use client";

import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LabelList } from "recharts";

interface CommitChartProps {
  commits: { committed_at: string; sha: string }[];
}

const KST_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 일자별 커밋 추이 (KST 날짜 기준 막대 + 막대 위 개수) */
export function CommitChart({ commits }: CommitChartProps) {
  const chartData = useMemo(() => {
    if (!commits || commits.length === 0) return [];
    // 정렬용 키는 YYYY-MM-DD, 표시는 "10월 30일"
    const map = new Map<string, number>();
    for (const c of commits) {
      const key = KST_DAY.format(new Date(c.committed_at));
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const [, m, d] = key.split("-");
        return { date: `${Number(m)}월 ${Number(d)}일`, count };
      });
  }, [commits]);

  return (
    <section aria-label="일자별 커밋 추이" className="space-y-4">
      <div className="flex items-end justify-between">
        <h2 className="text-[20px] font-bold tracking-tight text-fg">일자별 커밋 추이</h2>
        <span className="text-[12px] text-fg-3">총 {commits?.length || 0}개</span>
      </div>

      {chartData.length === 0 ? (
        <p className="border-y border-line py-12 text-center text-[13px] text-fg-3">기록된 커밋이 없어요.</p>
      ) : (
        <div className="h-[210px] w-full text-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 22, right: 0, left: -28, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="rgb(var(--line))" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 13, fill: "rgb(var(--fg2))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "rgb(var(--fg3))" }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: "rgb(var(--chip))" }}
                contentStyle={{
                  backgroundColor: "rgb(var(--canvas))",
                  border: "1px solid rgb(var(--line))",
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: "rgb(var(--fg))",
                }}
                formatter={(value: any) => [`${value}개`, "커밋"]}
              />
              <Bar dataKey="count" fill="currentColor" radius={[6, 6, 6, 6]} maxBarSize={44} isAnimationActive={false}>
                <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "rgb(var(--fg))" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
