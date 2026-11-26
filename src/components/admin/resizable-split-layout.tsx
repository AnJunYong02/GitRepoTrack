"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { clampSplitPercent, parseSavedSplitPercent } from "@/lib/admin/split-ratio";

interface ResizableSplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  /** 왼쪽 기본 비율(%) — 40이면 4:6 */
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  storageKey?: string;
}

// 예전(32:68) 저장값이 새 기본 비율을 덮지 않도록 키를 바꿨다
const DEFAULT_STORAGE_KEY = "repotrack-admin-split-ratio-v2";
const KEY_STEP = 2;

/**
 * 과제 관리 화면 좌우 분할 레이아웃.
 * xl 이상에서는 가운데 막대를 좌우로 드래그해 폭을 조절하고(브라우저에 저장), 더블클릭·Home 키로 기본 비율로 돌아간다.
 * xl 미만에서는 위아래 1열로 쌓고 막대를 숨긴다.
 */
export function ResizableSplitLayout({
  left,
  right,
  defaultLeftPercent = 40,
  minLeftPercent = 25,
  maxLeftPercent = 65,
  storageKey = DEFAULT_STORAGE_KEY,
}: ResizableSplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = useCallback(
    (v: number) => clampSplitPercent(v, minLeftPercent, maxLeftPercent),
    [minLeftPercent, maxLeftPercent]
  );

  // 저장된 비율 불러오기 (서버 렌더링과 맞추려고 마운트 후에 읽는다)
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setLeftPercent(parseSavedSplitPercent(saved, defaultLeftPercent, minLeftPercent, maxLeftPercent));
    } catch {
      // 저장소 접근 불가(시크릿 모드 등) → 기본값 유지
    }
  }, [storageKey, defaultLeftPercent, minLeftPercent, maxLeftPercent]);

  const apply = useCallback(
    (next: number) => {
      const value = clamp(next);
      setLeftPercent(value);
      try {
        window.localStorage.setItem(storageKey, String(value));
      } catch {
        // 저장 실패는 무시 (이번 화면에서만 유지)
      }
    },
    [clamp, storageKey]
  );

  // 드래그 중에는 window에서 포인터를 추적 (막대 밖으로 나가도 계속 조절)
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0) return;
      e.preventDefault();
      apply(((e.clientX - rect.left) / rect.width) * 100);
    };
    const handleUp = () => setIsDragging(false);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [isDragging, apply]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => apply(leftPercent - KEY_STEP),
      ArrowRight: () => apply(leftPercent + KEY_STEP),
      Home: () => apply(defaultLeftPercent),
      End: () => apply(maxLeftPercent),
    };
    const action = actions[e.key];
    if (action) {
      e.preventDefault();
      action();
    }
  };

  const rightPercent = Math.round((100 - leftPercent) * 10) / 10;
  const ratioLabel = `${Math.round(leftPercent)} : ${Math.round(rightPercent)}`;

  return (
    <div
      ref={containerRef}
      style={{ "--left-pane-width": `${leftPercent}%` } as CSSProperties}
      className="flex flex-col gap-14 xl:flex-row xl:items-stretch xl:gap-0"
    >
      {/* 왼쪽 */}
      <div className="min-w-0 xl:w-[var(--left-pane-width)] xl:shrink-0 xl:pr-6">{left}</div>

      {/* 크기 조절 막대 (xl 이상에서만) */}
      <div
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="좌우 영역 크기 조절 (좌우로 드래그하거나 방향키, 더블클릭하면 기본 4:6)"
        aria-valuenow={Math.round(leftPercent)}
        aria-valuemin={minLeftPercent}
        aria-valuemax={maxLeftPercent}
        aria-valuetext={`제출 기준 ${Math.round(leftPercent)}%, 학생별 현황 ${Math.round(rightPercent)}%`}
        title="좌우로 드래그해 크기 조절 · 더블클릭하면 기본 비율(4:6)"
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDoubleClick={() => apply(defaultLeftPercent)}
        onKeyDown={handleKeyDown}
        className="group relative hidden w-8 shrink-0 cursor-col-resize touch-none select-none justify-center focus:outline-none xl:flex"
      >
        {/* 세로선 */}
        <span
          aria-hidden
          className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${
            isDragging ? "bg-brand" : "bg-line group-hover:bg-brand/60 group-focus-visible:bg-brand"
          }`}
        />
        {/* 손잡이: 스크롤해도 화면 가운데 근처에 보이도록 sticky */}
        <span
          aria-hidden
          className={`sticky top-[45vh] z-10 mt-20 flex h-10 w-5 items-center justify-center self-start rounded-md border bg-canvas transition-colors ${
            isDragging
              ? "border-brand text-brand"
              : "border-line text-fg-3 group-hover:border-brand/60 group-hover:text-brand"
          }`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        {/* 드래그 중 비율 표시 */}
        {isDragging && (
          <span className="pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-fg px-2 py-0.5 text-[11px] font-bold tabular-nums text-canvas">
            {ratioLabel}
          </span>
        )}
      </div>

      {/* 오른쪽 */}
      <div className="min-w-0 xl:flex-1 xl:pl-6">{right}</div>
    </div>
  );
}
