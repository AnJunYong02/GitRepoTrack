/**
 * "뒤로가기" 버튼의 목적지(fallbackHref)가 직전에 본 페이지와 같은 목록 페이지인지 판단한다.
 * 같으면 브라우저 history 뒤로가기(router.back())로 이전 화면을 그대로 복원할 수 있다.
 *
 * - 경로(pathname)가 같아야 한다.
 * - org 쿼리는 대소문자를 무시하고 비교한다. (DB의 org_name과 URL의 대소문자가 다를 수 있음)
 * - 한쪽에만 org가 없으면 같은 페이지로 본다. (예: 쿠키로 들어온 `/admin`과 `/admin?org=X`)
 * - org 외의 쿼리는 무시한다.
 */
export function isSameListPage(previousUrl: string | null | undefined, targetHref: string): boolean {
  if (!previousUrl || !targetHref) return false;

  const prev = parseAppUrl(previousUrl);
  const target = parseAppUrl(targetHref);
  if (!prev || !target) return false;

  if (normalizePath(prev.pathname) !== normalizePath(target.pathname)) return false;

  const prevOrg = (prev.searchParams.get("org") || "").trim().toLowerCase();
  const targetOrg = (target.searchParams.get("org") || "").trim().toLowerCase();
  if (!prevOrg || !targetOrg) return true;
  return prevOrg === targetOrg;
}

/** 앱 내부 상대 경로만 파싱한다. 외부 URL이나 잘못된 값은 null */
function parseAppUrl(value: string): URL | null {
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  try {
    return new URL(value, "http://app.local");
  } catch {
    return null;
  }
}

function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}
