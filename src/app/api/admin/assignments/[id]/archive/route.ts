import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createAssignmentZipStream, StudentRepoArchiveItem } from "@/lib/archive/stream-zip";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    await requireStaff();

    // 1. Fetch assignment
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("assignments")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (aErr || !assignment) {
      return new Response("Assignment not found", { status: 404 });
    }

    // 2. Fetch all student repos with their evaluation and commit status
    const { data: studentRepos, error: rErr } = await supabaseAdmin
      .from("student_repos")
      .select(`
        id,
        full_name,
        student_no,
        student_name,
        profiles(github_login),
        repo_status(
          latest_snapshot_id,
          snapshots(commit_sha)
        )
      `)
      .eq("assignment_id", assignmentId);

    if (rErr || !studentRepos) {
      return new Response("Failed to fetch student repositories", { status: 500 });
    }

    // 3. Build archive items
    const items: StudentRepoArchiveItem[] = studentRepos.map((r: any) => {
      const commitSha = r.repo_status?.snapshots?.commit_sha;
      return {
        studentNo: r.student_no,
        studentName: r.student_name,
        githubLogin: r.profiles?.github_login || "unknown",
        fullName: r.full_name,
        branch: assignment.branch || "main",
        isSubmitted: Boolean(r.repo_status?.latest_snapshot_id),
        commitSha,
      };
    });

    // 4. Create single streaming zip
    const { stream, run } = createAssignmentZipStream(assignment.title, items);
    run(); // Run background archive writing into the stream

    const webStream = Readable.toWeb(stream) as ReadableStream;
    const sanitizedTitle = encodeURIComponent(assignment.title.replace(/[\\/:*?"<>|]/g, "_"));

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${sanitizedTitle}_all_repos.zip"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    const status = error.message?.includes("Forbidden") ? 403 : 500;
    return new Response(error.message || "Archive download error", { status });
  }
}
