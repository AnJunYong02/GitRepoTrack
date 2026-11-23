"use client";

import { useEffect, useState } from "react";

interface TypingTextProps {
  text: string;
  /** 글자 사이 간격 (ms) */
  speedMs?: number;
  /** 첫 글자가 나오기 전 대기 (ms) */
  startDelayMs?: number;
  className?: string;
}

/** 다 친 뒤 커서가 깜빡이는 시간 (globals.css caret-blink 3회) */
const CARET_LINGER_MS = 2400;

/**
 * 한 글자씩 타자 치듯 나타나는 문구.
 * 전체 문장을 투명하게 깔아 두고 그 위에 친 글자만 겹쳐 그려서, 타이핑 중에도 줄바꿈·높이가 변하지 않는다.
 */
export function TypingText({ text, speedMs = 120, startDelayMs = 150, className = "" }: TypingTextProps) {
  const chars = Array.from(text); // 이모지·특수 문자도 한 글자로
  // 서버 HTML과 첫 렌더는 0글자 → 마운트 후 타이핑 시작 (hydration 불일치 없음)
  const [count, setCount] = useState(0);
  const [showCaret, setShowCaret] = useState(true);

  useEffect(() => {
    // 움직임 줄이기 설정이면 바로 전체 표시
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCount(chars.length);
      setShowCaret(false);
      return;
    }

    setCount(0);
    setShowCaret(true);
    let typed = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    let caretTimer: ReturnType<typeof setTimeout> | undefined;

    const start = setTimeout(() => {
      interval = setInterval(() => {
        typed += 1;
        setCount(typed);
        if (typed >= chars.length) {
          clearInterval(interval);
          caretTimer = setTimeout(() => setShowCaret(false), CARET_LINGER_MS);
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      clearTimeout(start);
      clearInterval(interval);
      clearTimeout(caretTimer);
    };
    // 문구가 바뀌면 처음부터 다시
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, speedMs, startDelayMs]);

  return (
    <span aria-label={text} className={`relative inline-block ${className}`}>
      {/* 자리 잡기용 (보이지 않음) */}
      <span aria-hidden className="invisible">
        {text}
      </span>
      {/* 실제로 보이는 친 글자 + 커서 */}
      <span aria-hidden className="absolute inset-0">
        {chars.slice(0, count).join("")}
        {showCaret && <span className="typing-caret" />}
      </span>
    </span>
  );
}
