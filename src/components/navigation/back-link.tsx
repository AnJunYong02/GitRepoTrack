"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { getPreviousAppUrl } from "./route-history";
import { isSameListPage } from "@/lib/navigation/same-list-page";

/**
 * "뒤로가기" 버튼.
 * 직전에 본 페이지가 목적지(fallbackHref)와 같은 목록이면 router.back()으로 이전 화면을 그대로 복원한다
 * (Router Cache 시간과 상관없이 서버 요청·로딩 화면 없이 즉시, 스크롤 위치도 유지).
 * 직전 페이지가 다르거나 없으면(직접 접속, 새로고침 후) 기존처럼 fallbackHref로 이동한다.
 */
export function BackLink({
  fallbackHref,
  className,
  children,
}: {
  fallbackHref: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // 새 탭 열기(Ctrl/Cmd/Shift 클릭, 가운데 버튼)는 기본 동작 유지
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    if (isSameListPage(getPreviousAppUrl(), fallbackHref)) {
      event.preventDefault();
      router.back();
    }
  };

  return (
    <Link href={fallbackHref} onClick={handleClick} className={className}>
      {children}
    </Link>
  );
}
