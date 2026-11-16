import { describe, expect, it, vi } from "vitest";
import { cachedCall, isMissingCacheContext, safeRevalidateTag } from "./shared-cache";

describe("cachedCall", () => {
  it("Next 요청 밖(캐시 저장소 없음)에서는 함수를 그대로 실행한다", async () => {
    const fn = vi.fn(async () => ["org-a"]);
    await expect(cachedCall(["test-key"], { revalidate: 60, tags: ["t"] }, fn)).resolves.toEqual([
      "org-a",
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("함수 자체의 에러는 그대로 전달한다 (실패를 캐시하지 않음)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("GitHub down");
    });
    await expect(cachedCall(["test-err"], { revalidate: 60, tags: ["t"] }, fn)).rejects.toThrow(
      "GitHub down"
    );
  });
});

describe("isMissingCacheContext", () => {
  it("캐시 저장소 누락 에러만 구분한다", () => {
    expect(isMissingCacheContext(new Error("Invariant: incrementalCache missing in unstable_cache"))).toBe(true);
    expect(isMissingCacheContext(new Error("Not Found"))).toBe(false);
    expect(isMissingCacheContext(undefined)).toBe(false);
  });
});

describe("safeRevalidateTag", () => {
  it("요청 밖에서는 에러 없이 false를 반환한다", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(safeRevalidateTag("org-repos:test")).toBe(false);
    warn.mockRestore();
  });
});
