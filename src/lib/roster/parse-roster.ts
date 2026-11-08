/**
 * 학생 명단 CSV 파서 (순수 함수).
 * 실제 파일/환경변수 읽기는 server-only 모듈인 secret-roster.ts에서 담당한다.
 */

export interface RosterStudent {
  studentNo: string;
  name: string;
  /** GitHub 아이디(login). 비어 있으면 다른 방법(이전 과제 repo, 이메일 검색)으로 찾는다 */
  githubLogin: string | null;
  /** 학교 이메일 등 (GitHub 계정 검색용, 형식이 맞는 값만·중복 제거) */
  emails: string[];
}

export interface RosterParseError {
  line: number;
  reason: string;
}

export interface RosterParseResult {
  students: RosterStudent[];
  errors: RosterParseError[];
}

// 헤더 이름 → 필드 매핑 (공백/밑줄/하이픈 제거 + 소문자 비교)
const STUDENT_NO_HEADERS = ["학번", "studentno", "studentid", "student"];
const NAME_HEADERS = ["이름", "성명", "name", "studentname"];
const GITHUB_KEYWORDS = ["github", "깃허브", "깃헙"];
const EMAIL_KEYWORDS = ["이메일", "email", "메일"];

const STUDENT_NO_PATTERN = /^[0-9]{6,10}$/;
// GitHub 아이디: 영문/숫자/하이픈, 최대 39자, 하이픈으로 시작 불가
const GITHUB_LOGIN_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})$/;
const EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export type RosterSource = "file" | "env";

/**
 * 명단을 어디서 읽을지 결정한다.
 * 로컬 파일(secrets/roster.csv)이 있으면 파일을 우선한다 — Vercel에는 파일이 배포되지 않으므로
 * 운영에서는 항상 환경변수를 쓰고, 로컬에서는 파일을 바꾸면 바로 반영된다.
 */
export function chooseRosterSource(fileExists: boolean, hasEnvValue: boolean): RosterSource | null {
  if (fileExists) return "file";
  if (hasEnvValue) return "env";
  return null;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[\s_\-()]/g, "");
}

/**
 * 따옴표("a, b"), 이스케이프된 따옴표(""), CRLF를 처리하는 최소 CSV 파서.
 */
export function splitCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * GitHub 아이디 입력값 정리: "@octocat", "https://github.com/octocat" → "octocat"
 */
export function normalizeGithubLogin(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .trim();
}

export function parseRosterCsv(rawText: string): RosterParseResult {
  // UTF-8 BOM 제거 (엑셀에서 저장한 CSV)
  const text = rawText.replace(/^﻿/, "");
  const rows = splitCsvRows(text).filter((r) => r.some((cell) => cell.trim() !== ""));

  if (rows.length === 0) {
    return { students: [], errors: [{ line: 1, reason: "CSV 내용이 비어 있습니다." }] };
  }

  const header = rows[0].map(normalizeHeader);
  const studentNoIdx = header.findIndex((h) => STUDENT_NO_HEADERS.includes(h));
  const nameIdx = header.findIndex((h) => NAME_HEADERS.includes(h));
  const githubIdx = header.findIndex((h) => GITHUB_KEYWORDS.some((k) => h.includes(k)));
  // 이메일 열은 여러 개일 수 있다 (예: 학교연락용 이메일, 학생교육용 이메일)
  const emailIdxs = header
    .map((h, i) => (i !== githubIdx && EMAIL_KEYWORDS.some((k) => h.includes(k)) ? i : -1))
    .filter((i) => i >= 0);

  if (studentNoIdx === -1) {
    return {
      students: [],
      errors: [{ line: 1, reason: "첫 줄(헤더)에서 '학번' 열을 찾지 못했습니다." }],
    };
  }

  const students: RosterStudent[] = [];
  const errors: RosterParseError[] = [];
  const seen = new Set<string>();

  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2; // 헤더가 1번째 줄
    const studentNo = (cells[studentNoIdx] || "").trim();
    const name = nameIdx >= 0 ? (cells[nameIdx] || "").trim() : "";
    const githubRaw = githubIdx >= 0 ? normalizeGithubLogin(cells[githubIdx] || "") : "";

    if (!STUDENT_NO_PATTERN.test(studentNo)) {
      errors.push({ line, reason: `학번 형식이 올바르지 않습니다 (숫자 6~10자리).` });
      return;
    }
    if (seen.has(studentNo)) {
      errors.push({ line, reason: `학번 ${studentNo}이(가) 중복되었습니다.` });
      return;
    }
    if (githubRaw && !GITHUB_LOGIN_PATTERN.test(githubRaw)) {
      errors.push({ line, reason: `학번 ${studentNo}의 GitHub 아이디 형식이 올바르지 않습니다.` });
      return;
    }

    // 형식이 맞는 이메일만, 대소문자 무시 중복 제거 (잘못된 이메일은 그 값만 무시)
    const emails: string[] = [];
    for (const idx of emailIdxs) {
      const email = (cells[idx] || "").trim().toLowerCase();
      if (EMAIL_PATTERN.test(email) && !emails.includes(email)) emails.push(email);
    }

    seen.add(studentNo);
    students.push({
      studentNo,
      name,
      githubLogin: githubRaw || null,
      emails,
    });
  });

  return { students, errors };
}
