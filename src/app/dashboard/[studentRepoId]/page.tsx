import { StudentSidebar } from "@/components/student/student-sidebar";
import { SIDEBAR_COOKIE } from "@/components/student/sidebar-cookie";
import { cookies } from "next/headers";
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

  // 요약 카드용: 분석된 커밋 수(최신 스냅샷)와 커밋 기준(현재 기준 버전).
  // 학생 대시보드 목록(dashboard/page.tsx)과 같은 출처를 써서 두 화면의 "커밋 N/M개"가 일치하게 한다.
  let snapshotCommitCount: number | null = null;
  if (status?.latest_snapshot_id) {
    const { data: snap } = await supabaseAdmin
      .from("snapshots")
      .select("commit_count")
      .eq("id", status.latest_snapshot_id)
      .maybeSingle();
    snapshotCommitCount = typeof snap?.commit_count === "number" ? snap.commit_count : null;
  }

  let minCommits = 0;
  const criteriaVersionId = repo.assignments?.current_criteria_version_id;
  if (criteriaVersionId) {
    const { data: criteria } = await supabaseAdmin
      .from("criteria_versions")
      .select("rules")
      .eq("id", criteriaVersionId)
      .maybeSingle();
    const rules: any = criteria?.rules || {};
    minCommits = typeof rules.minCommits === "number" ? rules.minCommits : 0;
  }

  const initialData = {
    repo,
    assignment: repo.assignments,
    status,
    evaluation,
    commits: commits || [],
    snapshotCommitCount,
    minCommits,
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
          defaultCollapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed"}
        />
        <main className="min-w-0 flex-1 lg:py-6">
          <ClientDashboardView studentRepoId={studentRepoId} isOrgOwner={isOrgOwner} initialData={initialData} />
        </main>
      </div>
    </div>
  );
}
