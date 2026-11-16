import { Readable } from "stream";
import { guardErrorStatus, requireStudentRepo } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAssignmentZipStream, sanitizeSegment } from "@/lib/archive/stream-zip";

export const runtime = "nodejs";

/**
 * 학생 본인 repo 1개를 ZIP으로 내려준다.
 * 권한: 본인 repo 또는 해당 org Owner (requireStudentRepo).
 * 시크릿 명단(roster)은 읽지 않는다 — 폴더명은 DB의 학번만 사용.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studentRepoId: string }> }
) {
  try {
    const { studentRepoId } = await params;
    const { profile, repo } = await requireStudentRepo(studentRepoId);

    const { data: status } = await supabaseAdmin
      .from("repo_status")
      .select("latest_snapshot_id, snapshots:latest_snapshot_id(commit_sha)")
      .eq("student_repo_id", studentRepoId)
      .maybeSingle();

    const snapshot: any = Array.isArray(status?.snapshots) ? status?.snapshots[0] : status?.snapshots;
    const repoName = String(repo.full_name || "").split("/")[1] || "repo";

    const { stream, run } = createAssignmentZipStream(
      repo.assignments?.title || repoName,
      [
        {
          studentNo: repo.student_no || "",
          studentName: "",
          githubLogin: profile?.github_login || "",
          fullName: repo.full_name,
          branch: repo.assignments?.branch || "main",
          isSubmitted: Boolean(status?.latest_snapshot_id),
          commitSha: snapshot?.commit_sha,
        },
      ],
      { includeManifest: false }
    );
    run(); // 백그라운드에서 스트림에 기록

    const fileName = encodeURIComponent(`${sanitizeSegment(repoName)}.zip`);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return new Response(error.message || "Archive download error", {
      status: guardErrorStatus(error),
    });
  }
}
