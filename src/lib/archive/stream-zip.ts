import archiver from "archiver";
import { unzipSync } from "fflate";
import { PassThrough, Readable } from "stream";
import { getInstallationOctokit } from "@/lib/github/app";

export interface StudentRepoArchiveItem {
  studentNo: string;
  studentName: string;
  githubLogin: string;
  fullName: string;
  branch: string;
  isSubmitted: boolean;
  commitSha?: string;
}

// 파일/폴더명에 쓸 수 없는 문자를 밑줄로 치환한다.
export function sanitizeSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim();
}

/**
 * 학생별 폴더명. 이름이 있으면 `학번_이름_repo`, 없으면 `학번_repo`.
 * 학번도 없으면 `미등록_...`으로 표시한다.
 */
export function buildStudentFolderName({
  studentNo,
  studentName,
  repo,
}: {
  studentNo?: string | null;
  studentName?: string | null;
  repo: string;
}): string {
  const parts = [studentNo?.trim() || "미등록"];
  const name = studentName?.trim();
  if (name) parts.push(name);
  parts.push(repo);
  return sanitizeSegment(parts.join("_"));
}

/**
 * GitHub zipball 내부 경로(`owner-repo-sha/src/a.txt`)를
 * 학생 폴더 기준 경로(`학번_이름_repo/src/a.txt`)로 변환한다.
 * 최상위 폴더(`owner-repo-sha/`) 접두사는 제거하며,
 * 경로 이탈(`..`, 절대경로)이 있으면 null을 반환해 건너뛴다(zip slip 방지).
 */
export function toFolderEntryPath(
  zipEntryName: string,
  folderName: string
): string | null {
  const normalized = zipEntryName.replace(/\\/g, "/");
  if (normalized.startsWith("/")) return null;

  const isDirectory = normalized.endsWith("/");
  const segments = normalized.split("/").filter((s) => s !== "");

  if (segments.includes("..") || segments.includes(".")) return null;

  // 첫 세그먼트는 zipball 최상위 폴더이므로 제거
  const rest = segments.slice(1);
  if (rest.length === 0) {
    // 최상위 폴더 엔트리 자체 -> 빈 repo도 학생 폴더가 생기도록 폴더 엔트리 반환
    return isDirectory ? `${folderName}/` : null;
  }

  return `${folderName}/${rest.join("/")}${isDirectory ? "/" : ""}`;
}

export function createAssignmentZipStream(
  assignmentTitle: string,
  items: StudentRepoArchiveItem[]
): { stream: Readable; run: () => Promise<void> } {
  const passthrough = new PassThrough();
  const archive = archiver("zip", {
    store: true, // No re-compression for speed and minimum CPU/memory
  });

  archive.pipe(passthrough);

  const run = async () => {
    try {
      // 1. Build manifest CSV
      const manifestRows = [
        "학번,이름,GitHub 아이디,Repository,브랜치,제출여부,커밋 SHA,상태",
      ];

      for (const item of items) {
        const [owner, repo] = item.fullName.split("/");
        const safeStudentNo = item.studentNo || "미등록";
        const safeName = item.studentName?.trim() || "";
        // 학생별 폴더명 (중첩 zip이 아니라 폴더로 풀어 넣는다)
        const folderName = buildStudentFolderName({
          studentNo: item.studentNo,
          studentName: safeName,
          repo,
        });

        try {
          const octokit = await getInstallationOctokit(owner);
          // GitHub API returns 302 redirect with zipball binary stream
          const response = await octokit.rest.repos.downloadZipballArchive({
            owner,
            repo,
            ref: item.branch,
          });

          // zipball을 메모리에서 풀어 학생 폴더 아래에 파일 단위로 추가
          const files = unzipSync(new Uint8Array(response.data as ArrayBuffer));
          for (const [zipEntryName, data] of Object.entries(files)) {
            const entryPath = toFolderEntryPath(zipEntryName, folderName);
            if (!entryPath) continue;
            archive.append(Buffer.from(data), { name: entryPath });
          }

          manifestRows.push(
            `"${safeStudentNo}","${safeName}","${item.githubLogin}","${item.fullName}","${item.branch}","${item.isSubmitted ? "제출 완료" : "미완료"}","${item.commitSha || ""}","성공"`
          );
        } catch (err: any) {
          console.warn(`Could not archive ${item.fullName}:`, err.message);
          manifestRows.push(
            `"${safeStudentNo}","${safeName}","${item.githubLogin}","${item.fullName}","${item.branch}","${item.isSubmitted ? "제출 완료" : "미완료"}","${item.commitSha || ""}","다운로드 실패: ${err.message}"`
          );
        }
      }

      // Append manifest.csv
      archive.append(manifestRows.join("\n"), { name: "manifest.csv" });

      await archive.finalize();
    } catch (error) {
      passthrough.destroy(error as Error);
    }
  };

  return { stream: passthrough, run };
}
