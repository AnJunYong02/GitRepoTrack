import { describe, expect, it } from "vitest";
import { buildStudentFolderName, sanitizeSegment, toFolderEntryPath } from "./stream-zip";

describe("buildStudentFolderName", () => {
  const repo = "assign09-c01-22100063";

  it("이름이 있으면 학번_이름_repo", () => {
    expect(buildStudentFolderName({ studentNo: "22100063", studentName: "홍길동", repo })).toBe(
      "22100063_홍길동_assign09-c01-22100063"
    );
  });

  it("이름이 없으면 학번_repo (unknown을 넣지 않는다)", () => {
    expect(buildStudentFolderName({ studentNo: "22100063", studentName: null, repo })).toBe(
      "22100063_assign09-c01-22100063"
    );
    expect(buildStudentFolderName({ studentNo: "22100063", studentName: "  ", repo })).toBe(
      "22100063_assign09-c01-22100063"
    );
  });

  it("학번이 없으면 미등록, 금지문자는 밑줄로 치환", () => {
    expect(buildStudentFolderName({ studentNo: null, studentName: "a/b", repo })).toBe(
      "미등록_a_b_assign09-c01-22100063"
    );
  });
});

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
