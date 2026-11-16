import { describe, expect, it } from "vitest";
import { buildAssignmentStats, StatsSourceRepo } from "./assignment-stats";

const NOW = new Date("2026-11-16T12:00:00Z").getTime();

function repo(overrides: Partial<StatsSourceRepo> = {}): StatsSourceRepo {
  return {
    hasSnapshot: true,
    hasPushed: true,
    isSubmitted: false,
    isLateSubmission: false,
    isPastDeadlineUnpushed: false,
    minCommits: 5,
    commitCount: 3,
    isCommitsSatisfied: false,
    totalKeywords: 4,
    passedKeywordsCount: 1,
    isReadmeSatisfied: false,
    missingKeywords: ["설치", "실행", "결과"],
    deadlineAt: null,
    ...overrides,
  };
}

describe("buildAssignmentStats - 커밋", () => {
  it("부족한 커밋 수와 진행률을 계산한다", () => {
    expect(buildAssignmentStats(repo(), NOW).commit).toEqual({
      current: 3,
      target: 5,
      percent: 60,
      shortfall: 2,
      satisfied: false,
    });
  });

  it("기준을 넘으면 100%로 제한한다", () => {
    const c = buildAssignmentStats(repo({ commitCount: 12, isCommitsSatisfied: true }), NOW).commit;
    expect(c.percent).toBe(100);
    expect(c.shortfall).toBe(0);
  });

  it("기준이 0개면 최소 1개를 목표로 한다", () => {
    const c = buildAssignmentStats(repo({ minCommits: 0, commitCount: 0 }), NOW).commit;
    expect(c.target).toBe(1);
    expect(c.shortfall).toBe(1);
  });
});

describe("buildAssignmentStats - README", () => {
  it("키워드 진행률과 부족 키워드를 돌려준다", () => {
    const r = buildAssignmentStats(repo(), NOW).readme;
    expect(r.percent).toBe(25);
    expect(r.missing).toEqual(["설치", "실행", "결과"]);
  });

  it("키워드 기준이 없으면 README 존재 여부로 0/100%", () => {
    expect(buildAssignmentStats(repo({ totalKeywords: 0, isReadmeSatisfied: true }), NOW).readme.percent).toBe(100);
    expect(buildAssignmentStats(repo({ totalKeywords: 0 }), NOW).readme.percent).toBe(0);
  });
});

describe("buildAssignmentStats - 마감", () => {
  const future = "2026-11-18T12:00:00Z";
  const past = "2026-11-10T00:00:00Z";

  it("마감이 없으면 none", () => {
    expect(buildAssignmentStats(repo(), NOW).deadline).toEqual({ at: null, daysLeft: null, state: "none" });
  });

  it("마감 전 미충족이면 open + D-day", () => {
    expect(buildAssignmentStats(repo({ deadlineAt: future }), NOW).deadline).toEqual({
      at: future,
      daysLeft: 2,
      state: "open",
    });
  });

  it("마감이 지났고 미충족이면 overdue", () => {
    expect(buildAssignmentStats(repo({ deadlineAt: past }), NOW).deadline.state).toBe("overdue");
  });

  it("충족이면 onTime, 지각이면 late", () => {
    expect(buildAssignmentStats(repo({ deadlineAt: past, isSubmitted: true }), NOW).deadline.state).toBe("onTime");
    expect(
      buildAssignmentStats(repo({ deadlineAt: past, isSubmitted: true, isLateSubmission: true }), NOW).deadline.state
    ).toBe("late");
  });
});
