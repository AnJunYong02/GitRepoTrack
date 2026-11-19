"use client";

import { useEffect, useState } from "react";

interface CountUpProps {
  /** 최종 숫자 (정수) */
  value: number;
  /** 애니메이션 시간(ms) */
  durationMs?: number;
  className?: string;
  /** 다 올라간 뒤에 더할 클래스 (예: 충족이면 초록색 + pop) */
  doneClassName?: string;
}

/**
 * 마운트될 때 0 → value까지 숫자가 올라가는 표시.
 * 페이지에 들어오거나 다른 화면에서 돌아올 때마다 다시 마운트되므로 매번 재생된다.
 * 첫 렌더는 0이라 서버 HTML과 같고(hydration 경고 없음), 움직임 줄이기 설정이면 바로 최종 값.
 */
export function CountUp({ value, durationMs = 1000, className = "", doneClassName = "" }: CountUpProps) {
  const target = Math.max(0, Math.round(value));
  const [display, setDisplay] = useState(0);
  const [done, setDone] = useState(target === 0);

  useEffect(() => {
    if (target === 0) {
      setDisplay(0);
      setDone(true);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target);
      setDone(true);
      return;
    }

    setDone(false);
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic: 끝으로 갈수록 느려짐
      setDisplay(Math.round(eased * target));
      if (t < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return (
    <span className={`${className} ${done ? doneClassName : ""}`} aria-label={String(target)}>
      {display}
    </span>
  );
}
