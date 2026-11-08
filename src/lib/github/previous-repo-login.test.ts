import { describe, expect, it } from "vitest";
import {
  findPreviousStudentRepos,
  isGitHubRateLimitError,
  mapWithConcurrency,
  matchLoginByVerifiedEmail,
  pickInvitedStudent,
  pickStudentCollaborator,
  pickUserFromEmailSearch,
} from "./previous-repo-login";

describe("findPreviousStudentRepos", () => {
  const repos = [
    { name: "assign08-c01-22100063", pushed_at: "2026-10-20T00:00:00Z" },
    { name: "assign09-c01-22100063", pushed_at: "2026-11-01T00:00:00Z" },
    { name: "assign10-c01-22100063", pushed_at: "2026-11-08T00:00:00Z" }, // 이번 과제
    { name: "assign09-c02-22100063", pushed_at: "2026-11-02T00:00:00Z" }, // 다른 분반
    { name: "assign09-c01-22100159", pushed_at: "2026-11-03T00:00:00Z" }, // 다른 학번
    { name: "repotrack-docs", pushed_at: "2026-11-05T00:00:00Z" },
  ];

  it("같은 학번·분반의 이전 과제 repo만 최근순으로 반환한다", () => {
    expect(findPreviousStudentRepos(repos, "22100063", "assign10-c01")).toEqual([
      "assign09-c01-22100063",
      "assign08-c01-22100063",
    ]);
  });

  it("이전 과제 repo가 없으면 빈 배열", () => {
    expect(findPreviousStudentRepos(repos, "22999999", "assign10-c01")).toEqual([]);
  });
});

describe("pickStudentCollaborator", () => {
  it("admin과 봇을 빼고 남은 1명을 고른다", () => {
    expect(
      pickStudentCollaborator([
        { login: "AnJunYong02", permissions: { admin: true } },
        { login: "dependabot[bot]", type: "Bot" },
        { login: "student-a", permissions: { admin: false } },
      ])
    ).toBe("student-a");
  });

  it("후보가 0명이거나 2명 이상이면 추측하지 않는다", () => {
    expect(pickStudentCollaborator([{ login: "owner", permissions: { admin: true } }])).toBeNull();
    expect(
      pickStudentCollaborator([
        { login: "student-a", permissions: { admin: false } },
        { login: "ta-b", permissions: { admin: false } },
      ])
    ).toBeNull();
  });
});

describe("pickInvitedStudent", () => {
  it("초대받은 계정이 정확히 1명일 때만 반환한다", () => {
    expect(pickInvitedStudent([{ invitee: { login: "student-a" } }])).toBe("student-a");
    expect(pickInvitedStudent([{ invitee: null }])).toBeNull();
    expect(
      pickInvitedStudent([{ invitee: { login: "a" } }, { invitee: { login: "b" } }])
    ).toBeNull();
  });
});

describe("mapWithConcurrency", () => {
  it("순서를 유지하며 동시 실행 수를 제한한다", async () => {
    let running = 0;
    let maxRunning = 0;
    const result = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 10;
    });
    expect(result).toEqual([10, 20, 30, 40, 50, 60]);
    expect(maxRunning).toBe(2);
  });
});

describe("pickUserFromEmailSearch", () => {
  it("검색 결과가 정확히 1명일 때만 그 계정을 고른다", () => {
    expect(pickUserFromEmailSearch([{ login: "student-a" }])).toBe("student-a");
    expect(pickUserFromEmailSearch([])).toBeNull();
    expect(pickUserFromEmailSearch([{ login: "a" }, { login: "b" }])).toBeNull();
  });

  it("봇 계정은 제외한다", () => {
    expect(
      pickUserFromEmailSearch([{ login: "student-a" }, { login: "helper[bot]", type: "Bot" }])
    ).toBe("student-a");
  });
});

describe("isGitHubRateLimitError", () => {
  it("429나 rate limit 메시지/남은 횟수 0인 403을 속도 제한으로 본다", () => {
    expect(isGitHubRateLimitError({ status: 429 })).toBe(true);
    expect(isGitHubRateLimitError({ status: 403, message: "API rate limit exceeded" })).toBe(true);
    expect(
      isGitHubRateLimitError({ status: 403, response: { headers: { "x-ratelimit-remaining": "0" } } })
    ).toBe(true);
  });

  it("권한 부족 403이나 다른 오류는 속도 제한이 아니다", () => {
    expect(isGitHubRateLimitError({ status: 403, message: "Resource not accessible by integration" })).toBe(false);
    expect(isGitHubRateLimitError({ status: 422 })).toBe(false);
  });
});

describe("matchLoginByVerifiedEmail", () => {
  const users = [
    { githubLogin: "AnJunYong02", verifiedEmails: ["owner@example.com", "22100434@school.example"] },
    { githubLogin: "student-b", verifiedEmails: ["b@example.com"] },
  ];

  it("명단 이메일이 로그인 인증 이메일과 일치하면 그 계정을 고른다 (대소문자 무시)", () => {
    expect(matchLoginByVerifiedEmail(users, ["OWNER@Example.com"])).toEqual({
      login: "AnJunYong02",
      email: "owner@example.com",
    });
    // 명단의 두 번째 이메일(학교 이메일)로도 찾는다
    expect(matchLoginByVerifiedEmail(users, ["none@example.com", "22100434@school.example"])?.login).toBe(
      "AnJunYong02"
    );
  });

  it("일치하는 사용자가 없거나 2명 이상이면 null", () => {
    expect(matchLoginByVerifiedEmail(users, ["nobody@example.com"])).toBeNull();
    expect(matchLoginByVerifiedEmail(users, [])).toBeNull();
    expect(
      matchLoginByVerifiedEmail(
        [...users, { githubLogin: "dup", verifiedEmails: ["b@example.com"] }],
        ["b@example.com"]
      )
    ).toBeNull();
  });
});
