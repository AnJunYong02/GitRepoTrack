import { describe, expect, it } from "vitest";
import {
  buildRepoPrefix,
  buildStudentRepoName,
  normalizeAssignmentPrefix,
} from "./student-repo-name";
import { parseRepoName } from "./repo-parser";

describe("normalizeAssignmentPrefix", () => {
  it("과제 접두사를 그대로 받는다", () => {
    expect(normalizeAssignmentPrefix("assign10")).toBe("assign10");
    expect(normalizeAssignmentPrefix("  assign08_midterm ")).toBe("assign08_midterm");
  });

  it("분반까지 입력해도 -c01이 두 번 붙지 않게 정리한다", () => {
    expect(normalizeAssignmentPrefix("assign10-c01")).toBe("assign10");
    expect(normalizeAssignmentPrefix("assign10-C01")).toBe("assign10");
  });

  it("허용되지 않는 문자가 있으면 null", () => {
    expect(normalizeAssignmentPrefix("")).toBeNull();
    expect(normalizeAssignmentPrefix("assign 10")).toBeNull();
    expect(normalizeAssignmentPrefix("../assign10")).toBeNull();
    expect(normalizeAssignmentPrefix("assign10-extra")).toBeNull();
  });
});

describe("buildStudentRepoName", () => {
  it("<과제>-c01-<학번> 형식으로 만든다", () => {
    expect(buildRepoPrefix("assign10")).toBe("assign10-c01");
    expect(buildStudentRepoName("assign10", "22100063")).toBe("assign10-c01-22100063");
  });

  it("만든 이름을 기존 repo-parser가 같은 과제/학번으로 해석한다", () => {
    const name = buildStudentRepoName("assign10", "22100063");
    const parsed = parseRepoName({ id: 1, name, full_name: `org/${name}` });
    expect(parsed.studentNo).toBe("22100063");
    expect(parsed.classCode).toBe("c01");
    expect(parsed.category).toBe("assign10");
  });
});
