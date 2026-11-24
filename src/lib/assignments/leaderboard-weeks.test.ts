import { describe, expect, it } from "vitest";
import { buildWeekOptions } from "./leaderboard-weeks";

const rows = [
  { id: "a", title: "과제 1주차", deadline_at: "2026-09-01T00:00:00Z", ranking_mode: "live" },
  { id: "b", title: "과제 12주차", deadline_at: "2026-11-24T00:00:00Z", ranking_mode: "live" },
  { id: "c", title: "과제 5주차", deadline_at: "2026-10-01T00:00:00Z", ranking_mode: "none" },
  { id: "d", title: "특별 과제", deadline_at: "2026-12-01T00:00:00Z", ranking_mode: "live" },
];

describe("buildWeekOptions", () => {
  it("최신 주차가 먼저 오고 주차를 모르는 과제는 뒤로 간다", () => {
    const ids = buildWeekOptions(rows, { isOwner: true }).map((o) => o.id);
    expect(ids).toEqual(["b", "c", "a", "d"]);
  });

  it("Owner가 아니면 순위표 비활성 과제를 제외한다", () => {
    const ids = buildWeekOptions(rows, { isOwner: false }).map((o) => o.id);
    expect(ids).toEqual(["b", "a", "d"]);
  });

  it("라벨은 주차 형식이고 중간고사는 표시한다", () => {
    const opts = buildWeekOptions(
      [{ id: "m", title: "과제 8주차 midterm", ranking_mode: "live" }],
      { isOwner: true }
    );
    expect(opts[0].label).toBe("과제 8주차 (중간고사)");
  });
});
