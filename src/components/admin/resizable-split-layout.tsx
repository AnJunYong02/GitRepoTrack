"use client";

import { useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { GripVertical, RotateCcw } from "lucide-react";

interface ResizableSplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  defaultLeftPercent?: number;
  minLeftPercent?: number;
  maxLeftPercent?: number;
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = "repotrack-admin-split-ratio";

export function ResizableSplitLayout({
  left,
  right,
  defaultLeftPercent = 32,
  minLeftPercent = 22,
  maxLeftPercent = 60,
  storageKey = DEFAULT_STORAGE_KEY,
}: ResizableSplitLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftPercent, setLeftPercent] = useState<number>(defaultLeftPercent);
  const [isDragging, setIsDragging] = useState(false);

  const clamp = useCallback(
    (val: number) => Math.min(maxLeftPercent, Math.max(minLeftPercent, val)),
    [minLeftPercent, maxLeftPercent]
  );

  // Load saved split ratio from localStorage on mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = parseFloat(saved);
        if (!Number.isNaN(parsed)) {
          setLeftPercent(clamp(parsed));
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey, clamp]);

  const saveRatio = useCallback(
    (nextVal: number) => {
      try {
        window.localStorage.setItem(storageKey, String(nextVal));
      } catch {
        // ignore storage errors
      }
    },
    [storageKey]
  );

  const updateWidthFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      const relativeX = clientX - rect.left;
      const rawPercent = (relativeX / rect.width) * 100;
      const nextPercent = Math.round(clamp(rawPercent) * 10) / 10;
      setLeftPercent(nextPercent);
      saveRatio(nextPercent);
    },
    [clamp, saveRatio]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      e.preventDefault();
      updateWidthFromClientX(e.clientX);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, updateWidthFromClientX]);

  const handleReset = () => {
    setLeftPercent(defaultLeftPercent);
    saveRatio(defaultLeftPercent);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const next = clamp(leftPercent - 2);
      setLeftPercent(next);
      saveRatio(next);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = clamp(leftPercent + 2);
      setLeftPercent(next);
      saveRatio(next);
    } else if (e.key === "Home") {
      e.preventDefault();
      handleReset();
    } else if (e.key === "End") {
      e.preventDefault();
      setLeftPercent(maxLeftPercent);
      saveRatio(maxLeftPercent);
    }
  };

  const rightPercent = Math.round((100 - leftPercent) * 10) / 10;
  const isModified = Math.abs(leftPercent - defaultLeftPercent) >= 1;

  return (
    <div className="space-y-2">
      {/* Subtle Top Guide Bar (Desktop Only) */}
      <div className="hidden lg:flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 px-1">
        {isModified && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>기본 비율(32:68)로 초기화</span>
          </button>
        )}
      </div>

      {/* Main Split Container */}
      <div
        ref={containerRef}
        style={
          {
            "--left-pane-width": `${leftPercent}%`,
          } as React.CSSProperties
        }
        className="flex flex-col lg:flex-row lg:items-start gap-4 lg:gap-0"
      >
        {/* Left Pane */}
        <div className="w-full lg:w-[var(--left-pane-width)] lg:shrink-0 lg:sticky lg:top-20 min-w-0">
          {left}
        </div>

        {/* Interactive Drag Resizer Handle (Desktop Only) */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="좌우 영역 크기 조절 핸들 (좌우로 드래그하거나 방향키를 누르세요)"
          aria-valuenow={Math.round(leftPercent)}
          aria-valuetext={`과제 조건 ${Math.round(leftPercent)}%, 학생 목록 ${Math.round(rightPercent)}%`}
          aria-valuemin={minLeftPercent}
          aria-valuemax={maxLeftPercent}
          title="좌우로 당겨서 크기 조절 (더블클릭 시 기본 크기로 초기화)"
          onPointerDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDoubleClick={handleReset}
          onKeyDown={handleKeyDown}
          className="hidden lg:flex flex-col items-center justify-center w-6 shrink-0 self-stretch cursor-col-resize group select-none relative py-4 focus:outline-none"
        >
          {/* Vertical Track Line */}
          <div
            className={`w-1 flex-1 rounded-full transition-colors ${
              isDragging
                ? "bg-indigo-500 dark:bg-indigo-400"
                : "bg-slate-200/80 dark:bg-slate-800 group-hover:bg-indigo-400/80 group-focus-visible:bg-indigo-500"
            }`}
          />

          {/* Center Grip Pill */}
          <div
            className={`my-1.5 flex h-10 w-5 items-center justify-center rounded-full border shadow-xs transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-600 text-white scale-110 shadow-md"
                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 group-hover:border-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:scale-105"
            }`}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {/* Bottom Vertical Track Line */}
          <div
            className={`w-1 flex-1 rounded-full transition-colors ${
              isDragging
                ? "bg-indigo-500 dark:bg-indigo-400"
                : "bg-slate-200/80 dark:bg-slate-800 group-hover:bg-indigo-400/80 group-focus-visible:bg-indigo-500"
            }`}
          />

          {/* Floating Ratio Tooltip while dragging */}
          {isDragging && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md pointer-events-none z-20">
              {Math.round(leftPercent)}% : {Math.round(rightPercent)}%
            </div>
          )}
        </div>

        {/* Right Pane */}
        <div className="w-full lg:flex-1 min-w-0">{right}</div>
      </div>
    </div>
  );
}
