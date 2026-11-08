import "server-only"; // 클라이언트 컴포넌트에서 import하면 빌드가 실패하도록 강제 (명단 유출 방지)

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  chooseRosterSource,
  parseRosterCsv,
  RosterParseResult,
  RosterSource,
} from "./parse-roster";

/**
 * 학생 명단(개인정보)을 "시크릿"에서만 읽는다. git 저장소에는 절대 두지 않는다.
 *
 * 읽는 순서 (chooseRosterSource)
 * 1. 로컬 개발용 파일: <프로젝트>/secrets/roster.csv (gitignore 대상, Vercel에는 배포되지 않음)
 * 2. ROSTER_CSV_BASE64 환경변수 (Vercel: Project Settings → Environment Variables, Sensitive 체크)
 *    값 만들기(macOS): base64 -i roster.csv | pbcopy
 *
 * 주의: 명단 내용을 console.log 하거나 학생에게 응답으로 보내지 않는다.
 */
const LOCAL_ROSTER_PATH = path.join(process.cwd(), "secrets", "roster.csv");

export class RosterNotConfiguredError extends Error {
  constructor() {
    super(
      "학생 명단이 설정되지 않았습니다. Vercel 환경변수 ROSTER_CSV_BASE64(Sensitive)를 등록하거나, " +
        "로컬 개발 시 secrets/roster.csv 파일을 만들어주세요."
    );
    this.name = "RosterNotConfiguredError";
  }
}

/** 로컬 명단 파일 내용. 파일이 없으면 null */
async function readLocalRosterFile(): Promise<string | null> {
  try {
    return await readFile(LOCAL_ROSTER_PATH, "utf-8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return null;
    throw err;
  }
}

export async function loadSecretRoster(): Promise<RosterParseResult & { source: RosterSource }> {
  const fileText = await readLocalRosterFile();
  const base64 = process.env.ROSTER_CSV_BASE64?.trim();

  const source = chooseRosterSource(fileText !== null, Boolean(base64));
  if (!source) throw new RosterNotConfiguredError();

  const text =
    source === "file" ? (fileText as string) : Buffer.from(base64 as string, "base64").toString("utf-8");
  return { ...parseRosterCsv(text), source };
}
