import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  formatAbsoluteKst,
  computeCountdown,
  getDeadlineBadgeKind,
  buildMarkdownHeadings,
  splitCommitMessage,
} from "./time-utils";

const NOW = new Date("2026-11-05T12:00:00Z").getTime();

describe("formatRelativeTime", () => {
  it("분/시간/일 단위로 표시한다", () => {
    expect(formatRelativeTime("2026-11-05T11:59:40Z", NOW)).toBe("방금 전");
    expect(formatRelativeTime("2026-11-05T11:30:00Z", NOW)).toBe("30분 전");
    expect(formatRelativeTime("2026-11-05T10:00:00Z", NOW)).toBe("2시간 전");
    expect(formatRelativeTime("2026-11-02T12:00:00Z", NOW)).toBe("3일 전");
  });
  it("7일 이상이면 null", () => {
    expect(formatRelativeTime("2026-10-01T12:00:00Z", NOW)).toBeNull();
  });
});

describe("formatAbsoluteKst", () => {
  it("KST 기준 MM.DD HH:mm", () => {
    expect(formatAbsoluteKst("2026-10-30T06:42:00Z")).toBe("10.30 15:42");
  });
});

describe("computeCountdown", () => {
  it("D-3일 14시간", () => {
    const deadline = new Date(NOW + (3 * 24 + 14) * 3600 * 1000 + 5 * 60000).toISOString();
    expect(computeCountdown(deadline, NOW).label).toBe("D-3일 14시간");
  });
  it("24시간 미만은 D-Day", () => {
    const deadline = new Date(NOW + (5 * 60 + 20) * 60000).toISOString();
    expect(computeCountdown(deadline, NOW).label).toBe("D-Day 5시간 20분");
  });
  it("마감 후", () => {
    const c = computeCountdown(new Date(NOW - 1000).toISOString(), NOW);
    expect(c.expired).toBe(true);
    expect(c.label).toBe("마감 종료");
  });
});

describe("getDeadlineBadgeKind", () => {
  const deadline = "2026-11-06T00:00:00Z";
  it("커밋 없음", () => {
    expect(getDeadlineBadgeKind({ deadlineIso: deadline, commitDates: [], isSubmitted: false })).toBe("none");
  });
  it("기한 내 + 제출 완료", () => {
    expect(
      getDeadlineBadgeKind({ deadlineIso: deadline, commitDates: ["2026-11-05T00:00:00Z"], isSubmitted: true })
    ).toBe("on_time_submitted");
  });
  it("기한 내 + 조건 보완 필요", () => {
    expect(
      getDeadlineBadgeKind({ deadlineIso: deadline, commitDates: ["2026-11-05T00:00:00Z"], isSubmitted: false })
    ).toBe("on_time_partial");
  });
  it("기한 후 커밋", () => {
    expect(
      getDeadlineBadgeKind({
        deadlineIso: deadline,
        commitDates: ["2026-11-05T00:00:00Z", "2026-11-07T00:00:00Z"],
        isSubmitted: true,
      })
    ).toBe("late");
  });
});

describe("buildMarkdownHeadings", () => {
  it("## 키워드\\n\\n 양식으로 변환", () => {
    expect(buildMarkdownHeadings(["프로젝트 소개", " save() "])).toBe(
      "## 프로젝트 소개\n\n## save()\n\n"
    );
  });
  it("빈 목록은 빈 문자열", () => {
    expect(buildMarkdownHeadings([])).toBe("");
  });
});

describe("splitCommitMessage", () => {
  it("제목/본문 분리", () => {
    expect(splitCommitMessage("feat: a\n\nbody line")).toEqual({ title: "feat: a", body: "body line" });
    expect(splitCommitMessage("only")).toEqual({ title: "only", body: "" });
    expect(splitCommitMessage("").title).toBe("(커밋 메시지 없음)");
  });
});
