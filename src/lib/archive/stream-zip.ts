import archiver from "archiver";
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
        const safeName = item.studentName || item.githubLogin;
        const entryName = `${safeStudentNo}_${safeName}_${repo}.zip`;

        try {
          const octokit = await getInstallationOctokit(owner);
          // GitHub API returns 302 redirect with zipball binary stream
          const response = await octokit.rest.repos.downloadZipballArchive({
            owner,
            repo,
            ref: item.branch,
          });

          const zipBuffer = Buffer.from(response.data as ArrayBuffer);
          archive.append(zipBuffer, { name: entryName });

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
