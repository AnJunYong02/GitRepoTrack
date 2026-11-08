import { describe, expect, it } from "vitest";
import { defaultAssignmentTitle, pickAssignmentForPrefix } from "./assignment-match";

describe("defaultAssignmentTitle", () => {
  it("기존 import 규칙과 같은 제목을 만든다", () => {
    expect(defaultAssignmentTitle("assign10")).toBe("웹서비스 개발 10차 과제 (assign10)");
    expect(defaultAssignmentTitle("assign1")).toBe("웹서비스 개발 1차 과제 (assign01)");
  });

  it("중간고사 접두사를 구분한다", () => {
    expect(defaultAssignmentTitle("assign08_midterm")).toBe(
      "웹서비스 개발 8차 중간고사 (assign08_midterm)"
    );
  });
});

describe("pickAssignmentForPrefix", () => {
  const assignments = [
    { id: "a9", title: "과제 9차 (assign09)", org_name: "Org", created_at: "2026-11-01" },
    {
      id: "a10-old",
      title: "웹서비스 개발 10차 과제 (assign10)",
      org_name: "Org",
      created_at: "2026-11-02",
    },
    {
      id: "a10-prefix",
      title: "10주차 실습",
      org_name: "Org",
      repo_prefix: "assign10-c01",
      created_at: "2026-10-01",
    },
    {
      id: "other-org",
      title: "웹서비스 개발 11차 과제 (assign11)",
      org_name: "Other",
      created_at: "2026-11-05",
    },
  ];

  it("repo_prefix가 같은 과제를 가장 먼저 고른다", () => {
    expect(pickAssignmentForPrefix(assignments, "org", "assign10")?.id).toBe("a10-prefix");
  });

  it("repo_prefix가 없으면 제목의 과제 번호로 찾는다", () => {
    expect(pickAssignmentForPrefix(assignments, "Org", "assign09")?.id).toBe("a9");
  });

  it("다른 org의 과제나 없는 과제는 null", () => {
    expect(pickAssignmentForPrefix(assignments, "Org", "assign11")).toBeNull();
    expect(pickAssignmentForPrefix(assignments, "Org", "assign99")).toBeNull();
  });
});
