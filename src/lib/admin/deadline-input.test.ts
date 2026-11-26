import { describe, expect, it } from "vitest";
import { isoToKstLocalInput, kstLocalInputToIso } from "./deadline-input";

describe("isoToKstLocalInput", () => {
  it("UTC ISO를 KST 입력값으로 변환한다", () => {
    expect(isoToKstLocalInput("2026-11-30T14:59:00.000Z")).toBe("2026-11-30T23:59");
  });

  it("KST 자정을 넘기면 다음 날짜가 된다", () => {
    expect(isoToKstLocalInput("2026-11-30T15:00:00.000Z")).toBe("2026-12-01T00:00");
  });

  it("빈 값이나 잘못된 값은 빈 문자열", () => {
    expect(isoToKstLocalInput(null)).toBe("");
    expect(isoToKstLocalInput("not-a-date")).toBe("");
  });
});

describe("kstLocalInputToIso", () => {
  it("KST 입력값을 UTC ISO로 변환한다", () => {
    expect(kstLocalInputToIso("2026-11-30T23:59")).toBe("2026-11-30T14:59:00.000Z");
  });

  it("KST 자정은 전날 15시(UTC)", () => {
    expect(kstLocalInputToIso("2026-12-01T00:00")).toBe("2026-11-30T15:00:00.000Z");
  });

  it("왕복 변환하면 원래 값이 된다", () => {
    const iso = "2026-03-15T03:20:00.000Z";
    expect(kstLocalInputToIso(isoToKstLocalInput(iso))).toBe(iso);
  });

  it("형식 오류나 존재하지 않는 날짜는 null", () => {
    expect(kstLocalInputToIso("")).toBeNull();
    expect(kstLocalInputToIso("2026-11-30")).toBeNull();
    expect(kstLocalInputToIso("2026-02-30T10:00")).toBeNull();
    expect(kstLocalInputToIso("2026-11-30T24:00")).toBeNull();
  });
});
