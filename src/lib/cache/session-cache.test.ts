import { describe, expect, it } from "vitest";
import {
  isFresh,
  orgReposSessionKey,
  readSessionCache,
  removeSessionCache,
  writeSessionCache,
} from "./session-cache";

/** 테스트용 메모리 저장소 */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("session cache", () => {
  it("쓴 값을 그대로 읽고, 지우면 null", () => {
    const storage = memoryStorage();
    writeSessionCache(storage, "k", { totalRepos: 3 }, 1000);
    expect(readSessionCache(storage, "k")).toEqual({ data: { totalRepos: 3 }, fetchedAt: 1000 });
    removeSessionCache(storage, "k");
    expect(readSessionCache(storage, "k")).toBeNull();
  });

  it("저장소가 없거나 값이 깨져 있으면 null (예외를 던지지 않음)", () => {
    expect(readSessionCache(null, "k")).toBeNull();
    const storage = memoryStorage();
    storage.setItem("broken", "{not json");
    storage.setItem("shape", JSON.stringify({ hello: 1 }));
    expect(readSessionCache(storage, "broken")).toBeNull();
    expect(readSessionCache(storage, "shape")).toBeNull();
  });

  it("쓰기 실패(저장 공간 초과)는 무시한다", () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(() => writeSessionCache(storage, "k", { big: true })).not.toThrow();
  });

  it("isFresh: ttl 안이면 true, 지났거나 없으면 false", () => {
    const entry = { data: 1, fetchedAt: 1000 };
    expect(isFresh(entry, 500, 1400)).toBe(true);
    expect(isFresh(entry, 500, 1500)).toBe(false);
    expect(isFresh(null, 500, 1000)).toBe(false);
  });

  it("org 키는 대소문자를 무시한다", () => {
    expect(orgReposSessionKey("My-Org")).toBe(orgReposSessionKey("my-org"));
  });
});
