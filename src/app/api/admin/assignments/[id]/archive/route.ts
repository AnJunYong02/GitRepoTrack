import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkIsUserOwnerOfOrg } from "@/lib/org/active-org";
import { createAssignmentZipStream, StudentRepoArchiveItem } from "@/lib/archive/stream-zip";
import { loadSecretRoster } from "@/lib/roster/secret-roster";
import { parseRepoName } from "@/lib/github/repo-parser";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const { user, profile } = await requireStaff();

    // 1. Fetch assignment
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("assignments")
      .select("*")
      .eq("id", assignmentId)
      .single();

    if (aErr || !assignment) {
      return new Response("Assignment not found", { status: 404 });
    }

    const isOwner = await checkIsUserOwnerOfOrg(assignment.org_name, user, profile);
    if (!isOwner) {
      return new Response("Forbidden: Not an owner of this assignment organization", {
        status: 403,
      });
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

    // 3. 시크릿 명단에서 학번 → 성명 매핑 (Owner 확인 후에만 읽는다)
    const rosterNames = await loadRosterNameMap();

    // 4. Build archive items
    const items: StudentRepoArchiveItem[] = studentRepos.map((r: any) => {
      const commitSha = r.repo_status?.snapshots?.commit_sha;
      const githubLogin = r.profiles?.github_login || "";
      const studentNo = r.student_no || studentNoFromRepo(r.full_name);
      // 이름 우선순위: 명단 성명 → DB student_name → GitHub 로그인
      const studentName =
        (studentNo && rosterNames.get(studentNo)) || r.student_name || githubLogin;
      return {
        studentNo,
        studentName,
        githubLogin,
        fullName: r.full_name,
        branch: assignment.branch || "main",
        isSubmitted: Boolean(r.repo_status?.latest_snapshot_id),
        commitSha,
      };
    });

    // 5. Create single streaming zip
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

/** 명단의 학번 → 성명. 명단이 없거나 읽기에 실패하면 빈 Map (다운로드는 계속 진행) */
async function loadRosterNameMap(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const roster = await loadSecretRoster();
    for (const s of roster.students) {
      if (s.name) names.set(s.studentNo, s.name);
    }
  } catch (err: any) {
    // 명단 내용은 로그에 남기지 않는다
    console.warn("Roster unavailable for archive names:", err?.name || "error");
  }
  return names;
}

/** student_no가 비어 있으면 repo 이름(assign09-c01-22100063)에서 학번을 추출 */
function studentNoFromRepo(fullName: string): string {
  const name = fullName.split("/")[1] || fullName;
  const parsed = parseRepoName({ id: 0, name, full_name: fullName });
  return parsed.studentNo || "";
}
