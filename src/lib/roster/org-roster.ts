import "server-only"; // 클라이언트 컴포넌트에서 import하면 빌드가 실패하도록 강제 (명단 유출 방지)

import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeOrgName } from "@/lib/github/app";
import type { RosterStudent } from "./parse-roster";

/**
 * Organization별 학생 명단(개인정보). 관리자 "학생 관리" 페이지에서 CSV로 업로드한다.
 * 테이블 org_students는 RLS 정책이 없어 service role로만 접근한다 → 호출 전에 반드시 Owner 가드를 거칠 것.
 * 명단 내용을 console.log 하거나 학생에게 응답으로 보내지 않는다.
 */

export interface OrgRosterStudent extends RosterStudent {
  updatedAt: string | null;
}

export class RosterEmptyError extends Error {
  constructor(org: string) {
    super(`${org}의 학생 명단이 없습니다. 관리자 메뉴의 "학생 관리"에서 CSV를 업로드해주세요.`);
    this.name = "RosterEmptyError";
  }
}

/** GitHub org 이름은 대소문자를 구분하지 않으므로 소문자로 저장·조회한다 */
export function orgRosterKey(org: string): string {
  return normalizeOrgName(org).toLowerCase();
}

/** org 명단 전체 (학번순). 없으면 빈 배열 */
export async function loadOrgRoster(org: string): Promise<OrgRosterStudent[]> {
  const { data, error } = await supabaseAdmin
    .from("org_students")
    .select("student_no, name, github_login, emails, updated_at")
    .eq("org_name", orgRosterKey(org))
    .order("student_no", { ascending: true });

  if (error) throw new Error(`학생 명단을 불러오지 못했습니다: ${error.message}`);

  return (data || []).map((r: any) => ({
    studentNo: r.student_no,
    name: r.name || "",
    githubLogin: r.github_login || null,
    emails: Array.isArray(r.emails) ? r.emails : [],
    updatedAt: r.updated_at ?? null,
  }));
}

/** 명단이 비어 있으면 RosterEmptyError (Repo 생성처럼 명단이 꼭 필요한 곳에서 사용) */
export async function requireOrgRoster(org: string): Promise<OrgRosterStudent[]> {
  const students = await loadOrgRoster(org);
  if (students.length === 0) throw new RosterEmptyError(org);
  return students;
}

/** org 명단 전체 교체 (DB 함수 안에서 한 트랜잭션으로 delete + insert). 저장된 인원 수 반환 */
export async function replaceOrgRoster(
  org: string,
  students: RosterStudent[],
  userId: string | null
): Promise<number> {
  const rows = students.map((s) => ({
    student_no: s.studentNo,
    name: s.name,
    github_login: s.githubLogin,
    emails: s.emails,
  }));

  const { data, error } = await supabaseAdmin.rpc("replace_org_students", {
    p_org: orgRosterKey(org),
    p_rows: rows,
    p_user: userId,
  });

  if (error) throw new Error(`학생 명단을 저장하지 못했습니다: ${error.message}`);
  return typeof data === "number" ? data : rows.length;
}
