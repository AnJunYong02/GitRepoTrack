import { describe, expect, it } from "vitest";
import {
  buildCreationRepoName,
  normalizeClassCode,
  parseKeywords,
  validateCreationSettings,
  validateCreationStudent,
} from "./creation";

const settings = {
  repoBase: "week-1",
  title: "1주차 실습",
  classCode: "2",
  deadlineAt: "2026-12-01T00:00:00Z",
  keywords: ["실행 방법"],
  minCommits: 0,
  readmeRequired: true,
};

describe("assignment creation form values", () => {
  it("normalizes a section and includes the course and full GitHub login", () => {
    expect(normalizeClassCode("2")).toBe("c02");
    expect(normalizeClassCode("C01")).toBe("c01");
    expect(normalizeClassCode("0")).toBeNull();
    expect(normalizeClassCode("100")).toBeNull();
    expect(
      buildCreationRepoName("course", "week-1", "c02", "student-name"),
    ).toBe("course-week-1-c02-student-name");
    expect(validateCreationSettings(settings)).toMatchObject({
      title: "1주차 실습",
      classCode: "c02",
    });
  });

  it("keeps leading zeros in student numbers and rejects emails", () => {
    expect(
      validateCreationStudent({
        name: "가상 학생",
        studentNo: "00123456",
        githubLogin: "@test-student",
      }).studentNo,
    ).toBe("00123456");
    expect(() =>
      validateCreationStudent({
        name: "가상 학생",
        studentNo: "00123456",
        githubLogin: "student@example.com",
      }),
    ).toThrow("이메일");
  });

  it("deduplicates copied keywords with both line breaks and commas", () => {
    expect(parseKeywords("실행 방법\n구현 내용,실행 방법\r\n")).toEqual([
      "실행 방법",
      "구현 내용",
    ]);
  });

  it.each([
    { ...settings, deadlineAt: "invalid" },
    { ...settings, repoBase: "../week1" },
    { ...settings, minCommits: -1 },
  ])("rejects invalid creation settings before GitHub requests", (input) => {
    expect(() => validateCreationSettings(input)).toThrow();
  });
});

it("applies one edited convention to every student login", async () => {
  const { buildStudentRepoFromConvention } = await import("./creation");
  expect(
    ["test-a", "test-b"].map((login) =>
      buildStudentRepoFromConvention("course-custom-c02", login),
    ),
  ).toEqual(["course-custom-c02-test-a", "course-custom-c02-test-b"]);
  expect(
    validateCreationSettings({
      ...settings,
      repoConvention: "course-custom-c02",
    }).repoConvention,
  ).toBe("course-custom-c02");
});
