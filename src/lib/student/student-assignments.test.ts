import { describe, expect, it } from "vitest";
import {
  clampTimelineStart,
  countStatuses,
  getDeadlineMark,
  timelineInitialStart,
  timelineRangeLabel,
  extractWeekNo,
  getItemStatus,
  pickCurrentItem,
  toStudentRepoItem,
  weekTitle,
} from "./student-assignments";
import { formatKstDateTime, formatKstMonthDay, kstDaysUntil } from "./time-utils";

const NOW = new Date("2026-11-20T03:00:00Z").getTime();

describe("extractWeekNo", () => {
  it("repo 이름의 assign 번호를 주차로 쓴다", () => {
    expect(extractWeekNo("2026-2-WebService/assign12-c01-22300743")).toBe(12);
    expect(extractWeekNo("org/assign08_midterm-c01-22300743")).toBe(8);
  });
  it("repo 이름에 번호가 없으면 제목의 N주차를 쓴다", () => {
    expect(extractWeekNo("org/final-project", "13주차 과제")).toBe(13);
    expect(extractWeekNo(null, "기말 프로젝트")).toBeNull();
    expect(extractWeekNo(null, "과제 12차 (assign12)")).toBe(12);
    expect(extractWeekNo(null, "assign09 과제")).toBe(9);
  });
  it("weekTitle은 주차가 없으면 원래 제목", () => {
    expect(weekTitle(12, "과제")).toBe("12주차 과제");
    expect(weekTitle(null, "기말 프로젝트")).toBe("기말 프로젝트");
  });
});

describe("pickCurrentItem", () => {
  const items = [
    { id: "a", deadlineAt: "2026-11-30T00:00:00Z" },
    { id: "b", deadlineAt: "2026-11-23T17:48:00Z" },
    { id: "c", deadlineAt: "2026-11-16T05:32:00Z" },
  ];
  it("마감 전 과제 중 마감이 가장 가까운 것", () => {
    expect(pickCurrentItem(items, NOW)?.id).toBe("b");
  });
  it("모두 지났으면 첫 번째(최신) 과제", () => {
    expect(pickCurrentItem(items, new Date("2027-01-01").getTime())?.id).toBe("a");
  });
  it("빈 목록이면 null", () => {
    expect(pickCurrentItem([], NOW)).toBeNull();
  });
});

describe("toStudentRepoItem / 상태 분류", () => {
  const row = (overrides: any = {}) => ({
    id: "r1",
    full_name: "org/assign09-c01-22300743",
    assignments: {
      id: "as1",
      title: "과제 9",
      deadline_at: "2026-11-02T14:59:00Z",
      branch: "main",
      ranking_mode: "live",
      criteria_versions: { rules: { minCommits: 3, readme: { headerKeywords: ["A", "B"] } } },
    },
    commits: [{ committed_at: "2026-11-01T00:00:00Z" }],
    repo_status: {
      stale: false,
      latest_snapshot_id: "s1",
      snapshots: {
        commit_count: 4,
        evaluations: [
          { readme_results: { satisfied: false, details: [{ keyword: "A", found: true }, { keyword: "B", found: false }] } },
        ],
      },
    },
    ...overrides,
  });

  it("커밋 충족·키워드 부족이면 보완 필요", () => {
    const item = toStudentRepoItem(row());
    expect(item.weekNo).toBe(9);
    expect(item.isCommitsSatisfied).toBe(true);
    expect(item.passedKeywordsCount).toBe(1);
    expect(item.missingKeywords).toEqual(["B"]);
    expect(item.latestCommitAt).toBe("2026-11-01T00:00:00.000Z");
    expect(getItemStatus(item)).toBe("unmet");
  });

  it("스냅샷이 없으면 분석 필요", () => {
    const item = toStudentRepoItem(row({ repo_status: null }));
    expect(getItemStatus(item)).toBe("pending");
    expect(countStatuses([item])).toEqual({ satisfied: 0, unmet: 0, pending: 1 });
  });
});

describe("KST 표시 형식", () => {
  it("월·일·오전/오후 시각", () => {
    expect(formatKstDateTime("2026-11-23T17:48:00Z")).toBe("11월 24일 오전 2:48");
    expect(formatKstDateTime("2026-11-13T04:05:00Z", true)).toBe("2026년 11월 13일 오후 1:05");
    expect(formatKstMonthDay("2026-11-23T17:48:00Z", true)).toBe("11월 24일 (화)");
  });
  it("KST 날짜 기준 남은 일수", () => {
    expect(kstDaysUntil("2026-11-23T17:48:00Z", NOW)).toBe(4);
    expect(kstDaysUntil("2026-11-20T10:00:00Z", NOW)).toBe(0);
  });
});

describe("getDeadlineMark", () => {
  const base = { deadlineAt: "2026-11-23T17:48:00Z", hasPushed: true, isLateSubmission: false };
  it("기한 내 커밋이면 onTime (조건 미충족이어도)", () => {
    expect(getDeadlineMark(base, NOW)).toBe("onTime");
  });
  it("마감 후 커밋이면 late", () => {
    expect(getDeadlineMark({ ...base, isLateSubmission: true }, NOW)).toBe("late");
  });
  it("커밋이 없으면 마감 전 open, 마감 후 missing", () => {
    expect(getDeadlineMark({ ...base, hasPushed: false }, NOW)).toBe("open");
    expect(getDeadlineMark({ ...base, hasPushed: false }, new Date("2026-12-01").getTime())).toBe("missing");
  });
  it("마감이 없으면 none", () => {
    expect(getDeadlineMark({ ...base, deadlineAt: null }, NOW)).toBe("none");
  });
});

describe("과제 타임라인 이동", () => {
  it("처음엔 이번 주 + 다음 1칸이 보이도록 오른쪽에 맞춤", () => {
    // 13칸 중 이번 주가 11번(0부터), 6칸 표시 → 7~12번 칸 (end=13)
    expect(timelineInitialStart(13, 11, 6)).toBe(7);
    // 이번 주가 맨 끝이면 끝까지
    expect(timelineInitialStart(13, 12, 6)).toBe(7);
    // 이번 주가 앞쪽이면 0부터
    expect(timelineInitialStart(13, 1, 6)).toBe(0);
    // 이번 주가 없으면 맨 끝
    expect(timelineInitialStart(13, -1, 6)).toBe(7);
  });
  it("전체가 보이는 칸 수 이하이면 항상 0", () => {
    expect(timelineInitialStart(4, 3, 6)).toBe(0);
    expect(clampTimelineStart(3, 4, 6)).toBe(0);
  });
  it("범위 밖 이동은 양 끝으로 보정", () => {
    expect(clampTimelineStart(-1, 13, 6)).toBe(0);
    expect(clampTimelineStart(8, 13, 6)).toBe(7);
    expect(clampTimelineStart(3, 13, 2)).toBe(3);
  });
  it("보이는 범위 라벨", () => {
    expect(timelineRangeLabel({ weekNo: 7, title: "" }, { weekNo: 12, title: "" })).toBe("7–12주차");
    expect(timelineRangeLabel({ weekNo: 12, title: "" }, { weekNo: 12, title: "" })).toBe("12주차");
    expect(timelineRangeLabel({ weekNo: 13, title: "" }, { weekNo: null, title: "기말 프로젝트" })).toBe(
      "13주차 – 기말 프로젝트"
    );
  });
});
