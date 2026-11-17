import { StudentSidebar } from "@/components/student/student-sidebar";
import { requireStudentRepo } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ClientDashboardView } from "./client-view";

export default async function StudentDashboardDetailPage({
  params,
}: {
  params: Promise<{ studentRepoId: string }>;
}) {
  const { studentRepoId } = await params;
  const { profile, repo, isOrgOwner } = await requireStudentRepo(studentRepoId);

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
    <div className="min-h-screen bg-surface font-display text-ink">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:gap-10 lg:pr-10">
        <StudentSidebar
          activeOrg={repoOrg}
          isOwner={isOrgOwner}
          githubLogin={profile?.github_login}
          avatarUrl={profile?.avatar_url}
          active="none"
        />
        <main className="min-w-0 flex-1 lg:py-6">
          <ClientDashboardView studentRepoId={studentRepoId} isOrgOwner={isOrgOwner} initialData={initialData} />
        </main>
      </div>
    </div>
  );
}
