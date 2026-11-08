/**
 * 학생 과제 repo 이름 규칙: `<과제접두사>-<분반>-<학번>` (예: assign10-c01-22100063)
 * repo-parser.ts의 parseRepoName(pattern1)과 같은 형식이어야 학생 대시보드 매칭이 동작한다.
 */

/** 분반 코드 (고정) */
export const DEFAULT_CLASS_CODE = "c01";

const ASSIGNMENT_PREFIX_PATTERN = /^[a-zA-Z0-9_]+$/;

/**
 * Owner가 입력한 과제 접두사를 정리한다.
 * - 앞뒤 공백 제거
 * - 실수로 분반까지 입력한 경우(`assign10-c01`) 분반을 떼어 내 중복을 막는다
 * 형식이 올바르지 않으면 null
 */
export function normalizeAssignmentPrefix(
  input: string,
  classCode: string = DEFAULT_CLASS_CODE
): string | null {
  let prefix = input.trim();
  const classSuffix = new RegExp(`[-_]${classCode}$`, "i");
  prefix = prefix.replace(classSuffix, "");

  if (!prefix || !ASSIGNMENT_PREFIX_PATTERN.test(prefix)) return null;
  return prefix;
}

/** 과제 접두사 + 분반: `assign10-c01` (assignments.repo_prefix에 저장되는 값) */
export function buildRepoPrefix(
  assignmentPrefix: string,
  classCode: string = DEFAULT_CLASS_CODE
): string {
  return `${assignmentPrefix}-${classCode}`;
}

/** 학생 repo 이름: `assign10-c01-22100063` */
export function buildStudentRepoName(
  assignmentPrefix: string,
  studentNo: string,
  classCode: string = DEFAULT_CLASS_CODE
): string {
  return `${buildRepoPrefix(assignmentPrefix, classCode)}-${studentNo}`;
}
