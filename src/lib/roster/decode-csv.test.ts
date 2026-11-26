import { describe, expect, it } from "vitest";
import { decodeCsvBytes } from "./decode-csv";

describe("decodeCsvBytes", () => {
  it("UTF-8 CSV를 읽는다", () => {
    const bytes = new TextEncoder().encode("학번,이름\n22100063,홍길동\n");
    expect(decodeCsvBytes(bytes)).toBe("학번,이름\n22100063,홍길동\n");
  });

  it("UTF-8 BOM을 제거한다", () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("학번")]);
    expect(decodeCsvBytes(bytes)).toBe("학번");
  });

  it("EUC-KR(엑셀 한글 CSV)을 읽는다", () => {
    // "학번,이름" 의 EUC-KR 바이트
    const bytes = new Uint8Array([0xc7, 0xd0, 0xb9, 0xf8, 0x2c, 0xc0, 0xcc, 0xb8, 0xa7]);
    expect(decodeCsvBytes(bytes)).toBe("학번,이름");
  });
});
