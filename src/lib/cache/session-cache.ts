/**
 * 브라우저 sessionStorage 캐시 (같은 탭에서 페이지를 오가는 동안만 유지, 탭을 닫으면 사라짐).
 * 저장소를 쓸 수 없는 환경(사생활 보호 모드, 저장 공간 초과 등)에서도 화면이 깨지지 않도록
 * 모든 읽기·쓰기를 try/catch로 감싸고, 실패하면 캐시가 없는 것처럼 동작한다.
 */

export interface SessionCacheEntry<T> {
  data: T;
  fetchedAt: number;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** 관리자 화면의 org repo 목록을 캐시하는 시간 (서버 공유 캐시와 같은 3분) */
export const ORG_REPOS_SESSION_TTL_MS = 3 * 60 * 1000;

/** 다른 컴포넌트가 org repo 목록을 바꿨을 때(예: 학생 repo 일괄 생성) 알리는 이벤트 이름 */
export const ORG_REPOS_INVALIDATED_EVENT = "repotrack:org-repos-invalidated";

/**
 * org repo 목록을 새로 받아 왔을 때 결과를 함께 알리는 이벤트 이름.
 * 사이드바 "Repo 새로고침"과 과제 목록이 같은 결과를 공유해 같은 조회를 두 번 하지 않는다.
 * detail: { orgName: string; data: unknown }
 */
export const ORG_REPOS_UPDATED_EVENT = "repotrack:org-repos-updated";

export function orgReposSessionKey(orgName: string): string {
  return `repotrack:org-repos:${orgName.trim().toLowerCase()}`;
}

/** 브라우저의 sessionStorage. 서버 렌더링 중이거나 접근이 막혀 있으면 null */
export function getSessionStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readSessionCache<T>(
  storage: StorageLike | null,
  key: string
): SessionCacheEntry<T> | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.fetchedAt !== "number" || !("data" in parsed)) return null;
    return parsed as SessionCacheEntry<T>;
  } catch {
    return null;
  }
}

export function writeSessionCache<T>(
  storage: StorageLike | null,
  key: string,
  data: T,
  now = Date.now()
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify({ data, fetchedAt: now }));
  } catch {
    // 저장 공간 초과 등은 무시 (다음 진입 때 다시 조회)
  }
}

export function removeSessionCache(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // 무시
  }
}

/** 캐시가 ttl 안에 저장된 것인지 */
export function isFresh(
  entry: SessionCacheEntry<unknown> | null,
  ttlMs: number,
  now = Date.now()
): boolean {
  return Boolean(entry) && now - (entry as SessionCacheEntry<unknown>).fetchedAt < ttlMs;
}

/**
 * org repo 목록 캐시를 지우고, 같은 화면의 목록 컴포넌트에 다시 조회하라고 알린다.
 * (학생 repo 일괄 생성처럼 GitHub repo가 바뀐 뒤 호출)
 */
export function invalidateOrgReposSessionCache(orgName: string): void {
  removeSessionCache(getSessionStorage(), orgReposSessionKey(orgName));
  try {
    window.dispatchEvent(
      new CustomEvent(ORG_REPOS_INVALIDATED_EVENT, { detail: { orgName } })
    );
  } catch {
    // 서버 환경 등에서는 무시
  }
}
