"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 앱 안에서 직전에 본 URL을 기억한다 (모듈 변수: 클라이언트 이동 동안 유지, 새로고침하면 초기화).
 * "뒤로가기" 버튼이 router.back()으로 이전 화면을 복원해도 되는지 판단할 때 쓴다.
 */
let currentUrl: string | null = null;
let previousUrl: string | null = null;

export function getPreviousAppUrl(): string | null {
  return previousUrl;
}

export function RouteHistoryTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    if (url !== currentUrl) {
      previousUrl = currentUrl;
      currentUrl = url;
    }
  }, [pathname, searchParams]);

  return null;
}
