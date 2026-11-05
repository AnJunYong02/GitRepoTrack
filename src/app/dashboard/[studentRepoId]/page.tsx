import { Navbar } from "@/components/navbar";
import { requireStudentRepo } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ClientDashboardView } from "./client-view";

export default async function StudentDashboardDetailPage({
  params,
}: {
  params: Promise<{ studentRepoId: string }>;
}) {
  const { studentRepoId } = await params;
  const { repo, isStaff } = await requireStudentRepo(studentRepoId);

  // Fetch status
  const { data: status } = await supabaseAdmin
    .from("repo_status")
    .select("*")
    .eq("student_repo_id", studentRepoId)
    .maybeSingle();

  // Fetch latest evaluation
  let evaluation = null;
  if (status?.latest_snapshot_id) {
    const { data: ev } = await supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("snapshot_id", status.latest_snapshot_id)
      .order("evaluated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    evaluation = ev;
  }

  // Fetch commits
  const { data: commits } = await supabaseAdmin
    .from("commits")
    .select("sha, committed_at, message")
    .eq("student_repo_id", studentRepoId)
    .order("committed_at", { ascending: true });

  const initialData = {
    repo,
    assignment: repo.assignments,
    status,
    evaluation,
    commits: commits || [],
  };

  const repoOrg =
    repo.assignments?.org_name ||
    (repo.full_name ? repo.full_name.split("/")[0] : "");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar
        orgName={repoOrg}
        assignmentTitle={repo.assignments?.title || repo.full_name}
      />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <ClientDashboardView studentRepoId={studentRepoId} isStaff={isStaff} initialData={initialData} />
      </main>
    </div>
  );
}
