import { describe, it, expect } from "vitest";
import { parseRepoName, normalizeCategoryKey } from "./repo-parser";

describe("repo-parser", () => {
  it("normalizes category keys correctly", () => {
    expect(normalizeCategoryKey("assign1")).toBe("assign01");
    expect(normalizeCategoryKey("assign01")).toBe("assign01");
    expect(normalizeCategoryKey("assign2")).toBe("assign02");
    expect(normalizeCategoryKey("assignment03")).toBe("assign03");
    expect(normalizeCategoryKey("assign08_midterm")).toBe("assign08_midterm");
  });

  it("parses student repo with midterm (assign08_midterm-c01-22100063)", () => {
    const parsed = parseRepoName({
      id: 104,
      name: "assign08_midterm-c01-22100063",
      full_name: "2026-2-WebService/assign08_midterm-c01-22100063",
      html_url: "https://github.com/2026-2-WebService/assign08_midterm-c01-22100063",
    });

    expect(parsed.isStudentRepo).toBe(true);
    expect(parsed.category).toBe("assign08_midterm");
    expect(parsed.categoryLabel).toBe("과제 8차 중간고사 (assign08_midterm)");
    expect(parsed.studentNo).toBe("22100063");
    expect(parsed.classCode).toBe("c01");
  });

  it("parses student repo with class code (assign1-c01-22100063)", () => {
    const parsed = parseRepoName({
      id: 101,
      name: "assign1-c01-22100063",
      full_name: "2026-2-WebService/assign1-c01-22100063",
      html_url: "https://github.com/2026-2-WebService/assign1-c01-22100063",
    });

    expect(parsed.isStudentRepo).toBe(true);
    expect(parsed.category).toBe("assign01");
    expect(parsed.categoryLabel).toBe("과제 1차 (assign01)");
    expect(parsed.studentNo).toBe("22100063");
    expect(parsed.classCode).toBe("c01");
  });

  it("parses student repo without class code (assign02-22200037)", () => {
    const parsed = parseRepoName({
      id: 102,
      name: "assign02-22200037",
      full_name: "2026-2-WebService/assign02-22200037",
    });

    expect(parsed.isStudentRepo).toBe(true);
    expect(parsed.category).toBe("assign02");
    expect(parsed.studentNo).toBe("22200037");
    expect(parsed.classCode).toBeNull();
  });

  it("classifies starter/sample repo as other (sb_restapi_project)", () => {
    const parsed = parseRepoName({
      id: 103,
      name: "sb_restapi_project",
      full_name: "2026-2-WebService/sb_restapi_project",
    });

    expect(parsed.isStudentRepo).toBe(false);
    expect(parsed.category).toBe("other");
    expect(parsed.studentNo).toBeNull();
  });
});
