// 과제 관리 화면 좌우 분할 비율 계산 (DOM·저장소 접근 없는 순수 함수)

/** 왼쪽 비율(%)을 [min, max]로 제한하고 소수 1자리로 반올림 */
export function clampSplitPercent(value: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return Math.round(clamped * 10) / 10;
}

/** localStorage에 저장된 값 → 왼쪽 비율. 없거나 숫자가 아니면 기본값 */
export function parseSavedSplitPercent(
  raw: string | null | undefined,
  defaultPercent: number,
  min: number,
  max: number
): number {
  if (raw == null || raw.trim() === "") return defaultPercent;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return defaultPercent;
  return clampSplitPercent(parsed, min, max);
}
