import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { initialFilesManifest, validateInitialFiles } from "./initial-files";

describe("initial file validation", () => {
  it("keeps binary contents and sorts the manifest for retry verification", () => {
    const bytes = Buffer.from([0, 255, 4, 128]);
    const files = validateInitialFiles([
      { path: "src/main.bin", content: bytes.toString("base64") },
      { path: "README.md", content: "" },
    ]);
    expect(Buffer.from(files[1].content, "base64")).toEqual(bytes);
    expect(initialFilesManifest(files)).toEqual(
      initialFilesManifest(validateInitialFiles([...files].reverse())),
    );
    expect(initialFilesManifest(files)[1].sha256).toHaveLength(64);
  });
  it.each([
    "../secret",
    "/root/file",
    ".git/config",
    "root/.git/config",
    "C:/file",
  ])("rejects unsafe path %s", (path) => {
    expect(() => validateInitialFiles([{ path, content: "" }])).toThrow();
  });
  it("rejects duplicates, invalid base64 and file/directory collisions", () => {
    expect(() =>
      validateInitialFiles([
        { path: "a", content: "" },
        { path: "a/b", content: "" },
      ]),
    ).toThrow("충돌");
    expect(() =>
      validateInitialFiles([
        { path: "a", content: "" },
        { path: "a", content: "" },
      ]),
    ).toThrow("중복");
    expect(() =>
      validateInitialFiles([{ path: "a", content: "not base64" }]),
    ).toThrow("인코딩");
  });
  it("rejects a payload larger than the allowed total", () => {
    expect(() =>
      validateInitialFiles([
        {
          path: "large",
          content: Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64"),
        },
      ]),
    ).toThrow("2 MB");
  });
});
