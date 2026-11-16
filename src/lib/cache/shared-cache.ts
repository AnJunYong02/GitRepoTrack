import { revalidateTag, unstable_cache } from "next/cache";

/**
 * Vercel Data Cache(서버리스 인스턴스끼리 공유되는 캐시)에 함수 결과를 저장한다.
 * 인스턴스별 메모리 Map과 달리 콜드 스타트나 다른 인스턴스에서도 캐시가 유지된다.
 *
 * - fn이 에러를 던지면 캐시에 저장되지 않는다(실패 결과를 캐시하지 않음).
 * - 테스트·스크립트처럼 Next 요청 밖이라 캐시 저장소가 없으면 fn을 그대로 실행한다.
 * - 캐시 값은 JSON으로 직렬화되므로 fn은 JSON으로 표현 가능한 값만 반환해야 한다.
 */
export async function cachedCall<T>(
  keyParts: string[],
  options: { revalidate: number; tags: string[] },
  fn: () => Promise<T>
): Promise<T> {
  try {
    return await unstable_cache(fn, keyParts, options)();
  } catch (err) {
    if (isMissingCacheContext(err)) return fn();
    throw err;
  }
}

/** Next 요청 밖이라 캐시 저장소를 쓸 수 없는 경우의 에러인지 */
export function isMissingCacheContext(err: unknown): boolean {
  const message = String((err as any)?.message || "");
  return message.includes("incrementalCache missing");
}

/**
 * 태그가 붙은 캐시를 무효화한다. 서버 컴포넌트 렌더링 중처럼 무효화가 허용되지 않는 곳에서는
 * 에러 대신 경고만 남긴다(이 경우 호출부에서 캐시를 우회해 최신 값을 직접 조회한다).
 */
export function safeRevalidateTag(tag: string): boolean {
  try {
    revalidateTag(tag);
    return true;
  } catch (err: any) {
    console.warn(`[safeRevalidateTag] Could not revalidate "${tag}":`, err?.message);
    return false;
  }
}
