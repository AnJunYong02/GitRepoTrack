"use client";

import { useRouter } from "next/navigation";
import type { WeekOption } from "@/lib/assignments/leaderboard-weeks";

/** 주차를 골라 같은 org의 다른 과제 순위표로 이동하는 드롭다운 */
export function LeaderboardWeekSelect({
  options,
  currentId,
}: {
  options: WeekOption[];
  currentId: string;
}) {
  const router = useRouter();

  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-fg-2">
      <span>주차 선택</span>
      <select
        value={currentId}
        onChange={(e) => router.push(`/assignments/${e.target.value}/leaderboard`)}
        className="rounded-xl bg-chip px-3 py-2 text-[14px] font-semibold text-fg outline-none transition focus-visible:ring-2 focus-visible:ring-brand"
        aria-label="주차별 순위표 선택"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
