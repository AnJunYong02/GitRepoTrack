import { describe, expect, it } from "vitest";
import { sanitizeSegment, toFolderEntryPath } from "./stream-zip";

describe("toFolderEntryPath", () => {
  const folder = "22100063_홍길동_assign09-c01";

  it("zipball 최상위 폴더를 학생 폴더로 치환한다", () => {
    expect(toFolderEntryPath("owner-repo-abc123/README.md", folder)).toBe(
      `${folder}/README.md`
    );
    expect(toFolderEntryPath("owner-repo-abc123/src/a.txt", folder)).toBe(
      `${folder}/src/a.txt`
    );
  });

  it("디렉터리 엔트리는 끝의 슬래시를 유지한다", () => {
    expect(toFolderEntryPath("owner-repo-abc123/src/", folder)).toBe(
      `${folder}/src/`
    );
  });

  it("최상위 폴더 엔트리는 빈 학생 폴더로 변환한다", () => {
    expect(toFolderEntryPath("owner-repo-abc123/", folder)).toBe(`${folder}/`);
  });

  it("경로 이탈(..)과 절대경로는 건너뛴다", () => {
    expect(toFolderEntryPath("owner-repo-abc123/../evil.txt", folder)).toBeNull();
    expect(toFolderEntryPath("/etc/passwd", folder)).toBeNull();
  });

  it("최상위에 파일만 있는 엔트리는 건너뛴다", () => {
    expect(toFolderEntryPath("stray.txt", folder)).toBeNull();
  });
});

describe("sanitizeSegment", () => {
  it("파일명에 쓸 수 없는 문자를 밑줄로 바꾼다", () => {
    expect(sanitizeSegment('a/b:c*d?"e')).toBe("a_b_c_d__e");
  });
});
