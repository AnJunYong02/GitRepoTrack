import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { requireUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveStudentNo, syncReposForStudent } from "@/lib/student/sync-student-repos";
import { parseRepoName } from "@/lib/github/repo-parser";
import {
  getAvailableOrganizations,
  resolveActiveOrg,
} from "@/lib/org/active-org";
import { OrganizationSwitcher } from "@/components/org-switcher";
import { StudentNoBanner } from "@/components/student/student-no-banner";
import { StudentRepoList, StudentRepoItemData } from "@/components/student/student-repo-list";
import { ArrowRight, Shield } from "lucide-react";

const SELECT_STUDENT_REPOS = `
  id,
  full_name,
  repo_id,
  student_no,
  profile_id,
  assignments (
    id,
    title,
    org_name,
    deadline_at,
    branch,
    ranking_mode,
    criteria_versions!fk_assignments_criteria_version (
      rules
    )
  ),
  commits (
    committed_at
  ),
  repo_status (
    stale,
    fetched_at,
    first_satisfied_at,
    latest_snapshot_id,
    snapshots:latest_snapshot_id (
      commit_count,
      evaluations (
        submitted,
        readme_results,
        file_results
      )
    )
  )
`;

function belongsToOrg(sr: any, activeOrg: string): boolean {
  const target = activeOrg.toLowerCase();
  const assignmentOrg = (sr.assignments?.org_name || "").toLowerCase();
  if (assignmentOrg && assignmentOrg === target) return true;
  const fullName = (sr.full_name || "").toLowerCase();
  return fullName.startsWith(`${target}/`);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const activeOrg = await resolveActiveOrg(sp?.org);
  const [{ user, profile }, organizations] = await Promise.all([
    requireUser(),
    getAvailableOrganizations(activeOrg),
  ]);

  // 1. Resolve student number (from metadata, linked repos, commit author, or GitHub profile)
  const studentNo = await resolveStudentNo(user, profile);

  const orFilters = [
    `profile_id.eq.${user.id}`,
    `github_id.eq.${profile?.github_id || 0}`,
  ];
  if (studentNo) {
    orFilters.push(
      `student_no.eq.${studentNo}`,
      `full_name.ilike.%-${studentNo}`,
      `full_name.ilike.%_${studentNo}`
    );
  }

  // 2. Fetch repos mapped to this student or matching their student_no
  let { data: studentRepos } = await supabaseAdmin
    .from("student_repos")
    .select(SELECT_STUDENT_REPOS)
    .or(orFilters.join(","))
    .order("created_at", { ascending: false });

  let orgRepos = (studentRepos || []).filter((r: any) =>
    belongsToOrg(r, activeOrg)
  );

  // If studentNo is known but no repos were found for activeOrg in DB yet, scan activeOrg once automatically
  if (studentNo && orgRepos.length === 0) {
    await syncReposForStudent(user.id, profile?.github_id, studentNo, {
      scanOrgRepos: true,
      orgName: activeOrg,
    });
    const refetched = await supabaseAdmin
      .from("student_repos")
      .select(SELECT_STUDENT_REPOS)
      .or(orFilters.join(","))
      .order("created_at", { ascending: false });
    studentRepos = refetched.data;
    orgRepos = (studentRepos || []).filter((r: any) =>
      belongsToOrg(r, activeOrg)
    );
  }

  // Auto-bind profile_id ONLY for matched student_repos that haven't bound a profile_id yet
  if (orgRepos.length > 0) {
    const unboundIds = orgRepos
      .filter((r: any) => !r.profile_id)
      .map((r: any) => r.id);
    if (unboundIds.length > 0) {
      await supabaseAdmin
        .from("student_repos")
        .update({ profile_id: user.id })
        .in("id", unboundIds);
    }
    // Filter out any repo that belongs to another user's profile_id
    orgRepos = orgRepos.filter(
      (r: any) => !r.profile_id || r.profile_id === user.id
    );
  }

  // Sort newest assignment first using normalized category key (e.g. assign10 -> assign09 -> assign08_midterm -> ... -> assign01)
  const sortedRepos = [...orgRepos].sort((a: any, b: any) => {
    const repoNameA = (a.full_name || "").split("/").pop() || a.full_name || "";
    const repoNameB = (b.full_name || "").split("/").pop() || b.full_name || "";
    const parsedA = parseRepoName({ id: a.repo_id || 0, name: repoNameA, full_name: a.full_name || "" });
    const parsedB = parseRepoName({ id: b.repo_id || 0, name: repoNameB, full_name: b.full_name || "" });
    return parsedB.category.localeCompare(parsedA.category);
  });

  const nowMs = Date.now();

  const repoItems: StudentRepoItemData[] = sortedRepos.map((sr: any) => {
    const assignment = sr.assignments;
    const status = sr.repo_status;
    const snapshot = status?.snapshots;
    const hasSnapshot = Boolean(status?.latest_snapshot_id && snapshot);
    const evals = snapshot?.evaluations;
    const latestEval = Array.isArray(evals) ? evals[0] : evals;

    // Criteria rules
    const rules = assignment?.criteria_versions?.rules || {};
    const minCommits = typeof rules.minCommits === "number" ? rules.minCommits : 0;
    const configuredKeywords: string[] = Array.isArray(rules.readme?.headerKeywords)
      ? rules.readme.headerKeywords
      : Array.isArray(rules.readmeKeywords)
      ? rules.readmeKeywords
      : [];
    const totalKeywords = configuredKeywords.length;

    // Commit metrics
    const commitCount = snapshot?.commit_count ?? 0;
    const hasPushed = hasSnapshot && commitCount > 0;
    const targetCommits = minCommits > 0 ? minCommits : 1;
    const commitShortfall = Math.max(0, targetCommits - commitCount);
    const isCommitsSatisfied = hasPushed && commitCount >= targetCommits;

    // README keyword metrics
    const readmeResults = latestEval?.readme_results;
    const readmeDetails: { keyword: string; found: boolean }[] = Array.isArray(
      readmeResults?.details
    )
      ? readmeResults.details
      : [];
    const passedKeywordsCount = readmeDetails.filter((d) => d.found).length;
    const missingKeywordsCount =
      totalKeywords > 0
        ? Math.max(0, totalKeywords - passedKeywordsCount)
        : readmeResults?.satisfied
        ? 0
        : 1;
    const isReadmeSatisfied = hasSnapshot && Boolean(readmeResults?.satisfied);

    // File checks
    const fileResults: any[] = Array.isArray(latestEval?.file_results)
      ? latestEval.file_results
      : [];
    const missingFilesCount = fileResults.filter((f) => !f.satisfied).length;

    // Deadline & Late check
    const deadline = assignment?.deadline_at ? new Date(assignment.deadline_at) : null;
    const commitsList: { committed_at: string }[] = Array.isArray(sr.commits)
      ? sr.commits
      : [];
    const latestCommitMs =
      commitsList.length > 0
        ? Math.max(...commitsList.map((c) => new Date(c.committed_at).getTime()))
        : null;

    const isLateSubmission =
      Boolean(deadline) &&
      hasPushed &&
      latestCommitMs !== null &&
      latestCommitMs > deadline!.getTime();
    const isPastDeadlineUnpushed =
      Boolean(deadline) && !hasPushed && nowMs > deadline!.getTime();

    // Overall submission satisfaction
    const isSubmitted =
      hasPushed &&
      isCommitsSatisfied &&
      isReadmeSatisfied &&
      missingFilesCount === 0;

    // Build top-right badge summary
    const unmetReasons: string[] = [];
    if (hasSnapshot) {
      if (!hasPushed) {
        unmetReasons.push("커밋 없음");
      } else if (!isCommitsSatisfied) {
        unmetReasons.push(`커밋 ${commitShortfall}개 부족`);
      }
      if (!isReadmeSatisfied) {
        if (totalKeywords > 0) {
          unmetReasons.push(`키워드 ${missingKeywordsCount}개 부족`);
        } else {
          unmetReasons.push("README 누락");
        }
      }
      if (missingFilesCount > 0) {
        unmetReasons.push(`필수파일 ${missingFilesCount}개 누락`);
      }
    }

    return {
      id: sr.id,
      fullName: sr.full_name,
      assignmentId: assignment?.id || null,
      assignmentTitle: assignment?.title || "과제",
      rankingMode: assignment?.ranking_mode === "none" ? "none" : "live",
      deadlineFormatted: deadline ? deadline.toLocaleString("ko-KR") : null,
      hasSnapshot,
      hasPushed,
      isSubmitted,
      isLateSubmission,
      isPastDeadlineUnpushed,
      unmetSummary: unmetReasons.join(" · ") || "조건 미충족",
      minCommits,
      commitCount,
      commitShortfall,
      isCommitsSatisfied,
      totalKeywords,
      passedKeywordsCount,
      missingKeywordsCount,
      isReadmeSatisfied,
      isStale: Boolean(status?.stale),
    };
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* Staff Quick Banner */}
        {profile?.role === "staff" && (
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-bold text-blue-900 dark:text-blue-200">
                  관리자(Organization Owner) 권한으로 접속 중입니다
                </span>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                과제 전체 제출 현황 확인, 기준 수정 및 일괄 ZIP 다운로드는 관리자 대시보드에서 진행할 수 있습니다.
              </p>
            </div>
            <Link
              href={`/admin?org=${encodeURIComponent(activeOrg)}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 shadow-sm transition shrink-0"
            >
              <span>관리자 대시보드로 이동</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold tracking-tight">내 과제 목록</h1>
          <p className="text-sm text-slate-500">
            학번(예: 22300XXX)과 일치하는 GitHub Organization 과제 저장소와 현재 제출 및 검사 상태를 확인합니다.
          </p>
        </div>

        {/* Multi-Organization Switcher */}
        <OrganizationSwitcher
          activeOrg={activeOrg}
          organizations={organizations}
          basePath="/dashboard"
          role={profile?.role === "staff" ? "staff" : "student"}
        />

        {/* Student Number Binding & Org Repo Sync Banner */}
        <StudentNoBanner
          initialStudentNo={studentNo}
          repoCount={repoItems.length}
          activeOrg={activeOrg}
        />

        {repoItems.length > 0 ? (
          <StudentRepoList items={repoItems} />
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-500">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {studentNo
                ? `${activeOrg} Organization에서 학번(${studentNo})과 일치하는 과제 저장소를 찾지 못했습니다.`
                : "위 입력창에 본인의 학번(예: 22300743)을 입력하여 과제 저장소를 불러오세요."}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              상단의 <strong>Organization 전환</strong> 기능으로 다른 수업 Organization을 선택하거나, 우측 상단의 <strong>[최신 Repo 동기화]</strong>를 눌러 다시 스캔할 수 있습니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
