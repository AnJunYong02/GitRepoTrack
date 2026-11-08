import { describe, expect, it } from "vitest";
import {
  chooseRosterSource,
  normalizeGithubLogin,
  parseRosterCsv,
  splitCsvRows,
} from "./parse-roster";

describe("splitCsvRows", () => {
  it("따옴표 안의 쉼표와 이스케이프된 따옴표를 처리한다", () => {
    expect(splitCsvRows('a,"b, c","d ""e"""\r\n1,2,3')).toEqual([
      ["a", "b, c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });
});

describe("normalizeGithubLogin", () => {
  it("@ 접두사와 GitHub URL을 아이디로 정리한다", () => {
    expect(normalizeGithubLogin("@octocat")).toBe("octocat");
    expect(normalizeGithubLogin("https://github.com/octocat/")).toBe("octocat");
    expect(normalizeGithubLogin("  octo-cat ")).toBe("octo-cat");
  });
});

describe("parseRosterCsv", () => {
  it("헤더 이름으로 열을 찾으므로 열 순서가 달라도 읽는다", () => {
    const csv = "이름,GitHub ID,학번\n홍길동,hong-gd,22100063\n김철수,@kimcs,22200037\n";
    const result = parseRosterCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.students).toEqual([
      { studentNo: "22100063", name: "홍길동", githubLogin: "hong-gd", emails: [] },
      { studentNo: "22200037", name: "김철수", githubLogin: "kimcs", emails: [] },
    ]);
  });

  it("엑셀 CSV의 BOM과 영문 헤더를 처리한다", () => {
    const csv = "﻿student_no,name,github_login\r\n22100063,Hong,hong-gd\r\n";
    expect(parseRosterCsv(csv).students).toEqual([
      { studentNo: "22100063", name: "Hong", githubLogin: "hong-gd", emails: [] },
    ]);
  });

  it("GitHub 아이디가 비어 있으면 null로 둔다", () => {
    const csv = "학번,이름,GitHub\n22100063,홍길동,\n";
    expect(parseRosterCsv(csv).students[0].githubLogin).toBeNull();
  });

  it("잘못된 학번, 중복 학번, 잘못된 GitHub 아이디는 줄 번호와 함께 오류로 모은다", () => {
    const csv = [
      "학번,이름,GitHub",
      "22100063,홍길동,hong-gd",
      "abc,오류,someone",
      "22100063,중복,dup",
      "22200037,김철수,-bad-login",
      "",
    ].join("\n");
    const result = parseRosterCsv(csv);
    expect(result.students.map((s) => s.studentNo)).toEqual(["22100063"]);
    expect(result.errors.map((e) => e.line)).toEqual([3, 4, 5]);
  });

  it("실제 학사 명단 형태(순번·학부·줄바꿈 헤더·재이수 열)에서 학번·성명만 읽는다", () => {
    // 테스트용 가짜 데이터 (실제 학생 정보 아님)
    const csv = [
      '순번,학번,학부,전공,성명,"학교연락용 이메일\n(학생등록기준)","학생교육용 이메일\n(handong.ac.kr)",재이수,비고',
      "1,22900001,AI컴퓨터전자,AI·컴퓨터공학심화(60),홍길동,hong@example.com,22900001@example.com,,",
      "2,22900002,AI컴퓨터전자,\"컴퓨터공학(45),전자공학(33)\",김철수,kim@example.com,kim@example.com,재이수,",
      "",
    ].join("\n");
    const result = parseRosterCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.students).toEqual([
      {
        studentNo: "22900001",
        name: "홍길동",
        githubLogin: null,
        emails: ["hong@example.com", "22900001@example.com"],
      },
      {
        studentNo: "22900002",
        name: "김철수",
        githubLogin: null,
        // 두 이메일 열의 값이 같으면 하나만 남긴다
        emails: ["kim@example.com"],
      },
    ]);
  });

  it("형식이 잘못된 이메일은 그 값만 무시하고 학생은 유지한다", () => {
    const csv = "학번,성명,이메일\n22900001,홍길동,not-an-email\n22900002,김철수,KIM@Example.com\n";
    const result = parseRosterCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.students.map((s) => s.emails)).toEqual([[], ["kim@example.com"]]);
  });

  it("학번 열이 없으면 헤더 오류를 반환한다", () => {
    const result = parseRosterCsv("이름,GitHub\n홍길동,hong\n");
    expect(result.students).toEqual([]);
    expect(result.errors[0].reason).toContain("학번");
  });
});

describe("chooseRosterSource", () => {
  it("로컬 파일이 있으면 환경변수보다 파일을 먼저 쓴다", () => {
    expect(chooseRosterSource(true, true)).toBe("file");
    expect(chooseRosterSource(true, false)).toBe("file");
  });

  it("파일이 없으면 환경변수, 둘 다 없으면 null", () => {
    expect(chooseRosterSource(false, true)).toBe("env");
    expect(chooseRosterSource(false, false)).toBeNull();
  });
});
