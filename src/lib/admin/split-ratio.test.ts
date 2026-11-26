import { describe, expect, it } from "vitest";
import { clampSplitPercent, parseSavedSplitPercent } from "./split-ratio";

describe("clampSplitPercent", () => {
  it("범위 안의 값은 소수 1자리로 반올림한다", () => {
    expect(clampSplitPercent(41.26, 25, 65)).toBe(41.3);
  });

  it("범위를 벗어나면 최소·최대로 제한한다", () => {
    expect(clampSplitPercent(10, 25, 65)).toBe(25);
    expect(clampSplitPercent(90, 25, 65)).toBe(65);
  });
});

describe("parseSavedSplitPercent", () => {
  it("저장값이 없으면 기본값", () => {
    expect(parseSavedSplitPercent(null, 40, 25, 65)).toBe(40);
    expect(parseSavedSplitPercent("", 40, 25, 65)).toBe(40);
  });

  it("숫자가 아니면 기본값", () => {
    expect(parseSavedSplitPercent("abc", 40, 25, 65)).toBe(40);
  });

  it("저장값을 범위 안으로 제한해 사용한다", () => {
    expect(parseSavedSplitPercent("55.5", 40, 25, 65)).toBe(55.5);
    expect(parseSavedSplitPercent("80", 40, 25, 65)).toBe(65);
  });
});
