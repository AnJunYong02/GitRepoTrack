import { describe, it, expect } from "vitest";
import { evaluateSnapshot, CriteriaRules } from "./evaluate";

describe("종합 스냅샷 판정기 (evaluateSnapshot)", () => {
  const rules: CriteriaRules = {
    branch: "main",
    requiredFiles: [
      { type: "path_exists", path: "package.json", label: "package.json 존재" },
      { type: "glob_exists", pattern: "src/**/*.{js,ts}", label: "src/ 아래 소스 파일 존재" },
    ],
    readme: {
      required: true,
      headerKeywords: ["Key Learning", "Problem & Solution", "Reflection"],
    },
  };

  it("파일과 README 대제목 조건을 모두 만족하면 submitted: true", () => {
    const snapshot = {
      treePaths: ["package.json", "src/index.ts", "README.md"],
      readmeContent: "# Report\n## Key Learning\n## Problem & Solution\n## Reflection",
    };

    const result = evaluateSnapshot(snapshot, rules);
    expect(result.submitted).toBe(true);
    expect(result.filesSatisfied).toBe(true);
    expect(result.readmeSatisfied).toBe(true);
  });

  it("소스 파일이 없으면 submitted: false", () => {
    const snapshot = {
      treePaths: ["package.json", "docs/index.md", "README.md"],
      readmeContent: "## Key Learning\n## Problem & Solution\n## Reflection",
    };

    const result = evaluateSnapshot(snapshot, rules);
    expect(result.submitted).toBe(false);
    expect(result.filesSatisfied).toBe(false);
    expect(result.readmeSatisfied).toBe(true);
  });

  it("README에 필수 키워드가 빠지면 submitted: false", () => {
    const snapshot = {
      treePaths: ["package.json", "src/main.js", "README.md"],
      readmeContent: "## Key Learning\n## Only Reflection",
    };

    const result = evaluateSnapshot(snapshot, rules);
    expect(result.submitted).toBe(false);
    expect(result.filesSatisfied).toBe(true);
    expect(result.readmeSatisfied).toBe(false);
    expect(result.readmeResults.missingKeywords).toContain("Problem & Solution");
  });

  it("rules.readmeKeywords와 rule.description 형식도 정확히 호환 평가", () => {
    const legacyRules: CriteriaRules = {
      branch: "main",
      requiredFiles: [
        { type: "glob_exists", pattern: "src/**/*", description: "src 디렉토리 내 소스 코드 존재" },
      ],
      readmeKeywords: ["Key Learning", "Problem & Solution", "Code Review", "AI Usage", "Reflection"],
    };

    const snapshot = {
      treePaths: ["src/main/App.java", "README.md"],
      readmeContent: "## Key Learning\n새로 배운 점\n## Problem & Solution\n해결 과정\n## Code Review\n리뷰\n## AI Usage\n활용\n## Reflection\n회고",
    };

    const result = evaluateSnapshot(snapshot, legacyRules);
    expect(result.submitted).toBe(true);
    expect(result.fileResults[0].label).toBe("src 디렉토리 내 소스 코드 존재");
    expect(result.fileResults[0].satisfied).toBe(true);
    expect(result.readmeSatisfied).toBe(true);
    expect(result.readmeResults.details.length).toBe(5);
    expect(result.readmeResults.details.every((d) => d.found)).toBe(true);
  });

  it("기준 커밋수(minCommits) 미달 시 submitted: false, 충족 시 submitted: true", () => {
    const commitRules: CriteriaRules = {
      branch: "main",
      minCommits: 5,
      requiredFiles: [
        { type: "path_exists", path: "package.json", label: "package.json" },
      ],
      readme: {
        required: false,
      },
    };

    // 3개 커밋 (미달)
    const resultFail = evaluateSnapshot(
      { treePaths: ["package.json"], readmeContent: "", commitCount: 3 },
      commitRules
    );
    expect(resultFail.commitsSatisfied).toBe(false);
    expect(resultFail.submitted).toBe(false);

    // 5개 커밋 (충족)
    const resultPass = evaluateSnapshot(
      { treePaths: ["package.json"], readmeContent: "", commitCount: 5 },
      commitRules
    );
    expect(resultPass.commitsSatisfied).toBe(true);
    expect(resultPass.submitted).toBe(true);
  });

  it("requiredFiles가 비어있을 경우 파일 검사는 항상 충족(filesSatisfied: true)", () => {
    const noFileRules: CriteriaRules = {
      branch: "main",
      requiredFiles: [],
      readme: {
        required: true,
        headerKeywords: ["Key Learning"],
      },
    };

    const result = evaluateSnapshot(
      {
        treePaths: [],
        readmeContent: "## Key Learning\nContent",
      },
      noFileRules
    );

    expect(result.filesSatisfied).toBe(true);
    expect(result.fileResults.length).toBe(0);
    expect(result.readmeSatisfied).toBe(true);
    expect(result.submitted).toBe(true);
  });
});

