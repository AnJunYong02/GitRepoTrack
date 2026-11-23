"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/** layout.tsx 인라인 스크립트와 같은 키 */
export const THEME_STORAGE_KEY = "repotrack-theme";

/** 현재 다크 모드 여부 + 전환 함수 (선택은 앱 전체에 저장). 마운트 전에는 isDark가 null */
export function useThemeToggle() {
  // 서버 HTML에서는 테마를 모르므로 마운트 후에 실제 값을 읽는다
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // 저장이 막힌 환경(시크릿 모드 등)에서도 이번 화면에서는 전환되게 둔다
    }
    setIsDark(next);
  };

  return { isDark, toggle };
}

/** 오른쪽 위 라이트/다크 모드 전환 버튼 (순위표 화면에서 사용) */
export function ThemeToggle() {
  const { isDark, toggle } = useThemeToggle();
  const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark ?? undefined}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface text-ink shadow-neu-sm transition hover:shadow-neu-inset"
    >
      {isDark === null ? (
        <span className="h-4 w-4" aria-hidden />
      ) : isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </button>
  );
}
