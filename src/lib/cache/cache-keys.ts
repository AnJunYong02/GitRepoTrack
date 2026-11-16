/**
 * 서버 공유 캐시(Vercel Data Cache) 태그와 키 관련 순수 함수.
 * 같은 데이터를 캐시하는 곳과 무효화하는 곳이 반드시 같은 태그를 쓰도록 한 곳에 모은다.
 */

/** org의 GitHub repo 목록 캐시 태그 (org 이름 대소문자 무시) */
export function orgReposTag(orgName: string): string {
  return `org-repos:${orgName.trim().toLowerCase()}`;
}

/**
 * PostgREST ilike 패턴에서 와일드카드(%, _)와 역슬래시를 문자 그대로 비교하도록 이스케이프한다.
 * 예: org 이름 "my_org"가 "myXorg"와 일치하지 않게 한다.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
