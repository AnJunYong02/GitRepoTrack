/**
 * 과제 접두사(assign10)로 과제 제목을 만들고, 같은 과제를 찾는 순수 함수들.
 */
import { normalizeCategoryKey } from "@/lib/github/repo-parser";
import { buildRepoPrefix } from "@/lib/github/student-repo-name";

export interface AssignmentLike {
  id: string;
  title: string;
  org_name: string;
  repo_prefix?: string | null;
  created_at?: string | null;
}

/**
 * 기본 과제 제목. 기존 import 규칙(`웹서비스 개발 N차 과제 (assignNN)`)과 같은 형식.
 * - assign10 → 웹서비스 개발 10차 과제 (assign10)
 * - assign08_midterm → 웹서비스 개발 8차 중간고사 (assign08_midterm)
 */
export function defaultAssignmentTitle(prefix: string): string {
  const key = normalizeCategoryKey(prefix);
  const numMatch = key.match(/([0-9]+)/);
  if (!numMatch) return `과제 (${prefix})`;
  const num = parseInt(numMatch[1], 10);
  const kind = key.includes("midterm") ? "중간고사" : "과제";
  return `웹서비스 개발 ${num}차 ${kind} (${key})`;
}

/**
 * 같은 org에서 이 접두사에 해당하는 기존 과제를 고른다(중복 과제 생성 방지).
 * 1순위: repo_prefix가 `assign10-c01`과 같은 과제
 * 2순위: 제목의 카테고리 키(normalizeCategoryKey)가 같은 과제 (예: "웹서비스 개발 10차 과제 (assign10)")
 * 여러 개면 가장 최근에 만든 과제.
 */
export function pickAssignmentForPrefix<T extends AssignmentLike>(
  assignments: T[],
  org: string,
  prefix: string
): T | null {
  const inOrg = assignments
    .filter((a) => (a.org_name || "").toLowerCase() === org.toLowerCase())
    .sort(
      (a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

  const repoPrefix = buildRepoPrefix(prefix).toLowerCase();
  const byPrefix = inOrg.find((a) => (a.repo_prefix || "").toLowerCase() === repoPrefix);
  if (byPrefix) return byPrefix;

  const key = normalizeCategoryKey(prefix);
  return inOrg.find((a) => normalizeCategoryKey(a.title || "") === key) || null;
}
