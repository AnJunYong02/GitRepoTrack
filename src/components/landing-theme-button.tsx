"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeToggle } from "@/components/theme-toggle";

/** 첫 화면 헤더의 다크/라이트 모드 아이콘 버튼 (테마 저장 방식은 ThemeToggle과 동일) */
export function LandingThemeButton() {
  const { isDark, toggle } = useThemeToggle();
  const label = isDark ? "라이트 모드로 전환" : "다크 모드로 전환";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark ?? undefined}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-fg-2 transition hover:bg-chip hover:text-fg"
    >
      {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
