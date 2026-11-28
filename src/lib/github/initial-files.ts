import "server-only";

import { createHash } from "node:crypto";
import {
  InitialFile,
  MAX_INITIAL_FILES,
  MAX_INITIAL_FILE_BYTES,
  validateInitialFilePath,
} from "@/lib/assignments/creation";

export function validateInitialFiles(input: unknown): InitialFile[] {
  if (!Array.isArray(input) || input.length > MAX_INITIAL_FILES)
    throw new Error(`초기 파일은 최대 ${MAX_INITIAL_FILES}개까지 선택하세요.`);
  let size = 0;
  const paths = new Set<string>();
  const files = input.map((value) => {
    if (typeof value?.path !== "string" || typeof value?.content !== "string")
      throw new Error("초기 파일 형식이 올바르지 않습니다.");
    const { path, content } = value;
    validateInitialFilePath(path);
    if (paths.has(path)) throw new Error("같은 경로의 파일이 중복되었습니다.");
    paths.add(path);
    if (content.length > Math.ceil(MAX_INITIAL_FILE_BYTES / 3) * 4)
      throw new Error("초기 파일의 합계는 2 MB 이하여야 합니다.");
    const bytes = Buffer.from(content, "base64");
    if (bytes.toString("base64") !== content)
      throw new Error("파일 인코딩이 올바르지 않습니다.");
    size += bytes.length;
    if (size > MAX_INITIAL_FILE_BYTES)
      throw new Error("초기 파일의 합계는 2 MB 이하여야 합니다.");
    return { path, content };
  });
  for (const path of paths) {
    const parts = path.split("/");
    for (let index = 1; index < parts.length; index++) {
      if (paths.has(parts.slice(0, index).join("/")))
        throw new Error("파일과 폴더의 경로가 충돌합니다.");
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function initialFilesManifest(files: InitialFile[]) {
  return files.map((file) => ({
    path: file.path,
    sha256: createHash("sha256")
      .update(Buffer.from(file.content, "base64"))
      .digest("hex"),
  }));
}
