import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { requireUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveStudentNo, syncReposForStudent } from "@/lib/student/sync-student-repos";
import { normalizeOrgName } from "@/lib/github/app";
import { parseRepoName } from "@/lib/github/repo-parser";
import {
  getAvailableOrganizations,
  isValidOrgSlug,
} from "@/lib/org/active-org";
import { OrganizationSwitcher } from "@/components/org-switcher";
import { OrgSelectorView } from "@/components/org-selector-view";
import { StudentNoBanner } from "@/components/student/student-no-banner";
import { StudentRepoList, StudentRepoItemData } from "@/components/student/student-repo-list";
import { PreviousAssignmentCard, StudentFocusDashboard } from "@/components/student/student-summary";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { SIDEBAR_COOKIE } from "@/components/student/sidebar-cookie";
import { cookies } from "next/headers";
import { GoalsPanel } from "@/components/student/goals-panel";
import { ThemeToggle } from "@/components/theme-toggle";
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
  const rawOrgQuery = normalizeOrgName(sp?.org || "");
  const hasExplicitOrg = isValidOrgSlug(rawOrgQuery);

  const { user, profile } = await requireUser();
  const organizations = await getAvailableOrganizations(
    hasExplicitOrg ? rawOrgQuery : undefined,
    { user, profile }
  );

  // Step 1: When entering /dashboard without ?org=..., show the Organization Selection Page first
  if (!hasExplicitOrg) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <OrgSelectorView
            organizations={organizations}
            githubLogin={profile?.github_login}
          />
        </main>
      </div>
    );
  }

  const activeOrg = rawOrgQuery;
  const isOwnerOfActiveOrg = organizations.some(
    (o) => o.name.toLowerCase() === activeOrg.toLowerCase() && o.isOwner
  );

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

    // Overall submission satisfaction (commits + README keywords)
    const isSubmitted =
      hasPushed &&
      isCommitsSatisfied &&
      isReadmeSatisfied;

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
    }

    return {
      id: sr.id,
      fullName: sr.full_name,
      assignmentId: assignment?.id || null,
      assignmentTitle: assignment?.title || "과제",
      rankingMode: assignment?.ranking_mode === "none" ? "none" : "live",
      deadlineFormatted: deadline ? deadline.toLocaleString("ko-KR") : null,
      deadlineAt: assignment?.deadline_at ?? null,
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
      missingKeywords: readmeDetails.filter((d) => !d.found).map((d) => d.keyword),
      isReadmeSatisfied,
      isStale: Boolean(status?.stale),
    };
  });

  // 사이드바 표시용 값 (기존 계산 결과에서 꺼내기만 함)
  const activeOrgOption = organizations.find(
    (o) => o.name.toLowerCase() === activeOrg.toLowerCase()
  );
  const statusCounts = {
    satisfied: repoItems.filter((r) => r.isSubmitted).length,
    unmet: repoItems.filter((r) => r.hasSnapshot && !r.isSubmitted).length,
    pending: repoItems.filter((r) => !r.hasSnapshot).length,
  };

  return (
    <div className="min-h-screen bg-surface font-display text-ink">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:gap-10 lg:pr-10">
        <StudentSidebar
          activeOrg={activeOrg}
          orgAvatarUrl={activeOrgOption?.avatarUrl}
          isOwner={isOwnerOfActiveOrg}
          githubLogin={profile?.github_login}
          avatarUrl={profile?.avatar_url}
          status={statusCounts}
          defaultCollapsed={(await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed"}
        />

        <main className="min-w-0 flex-1 space-y-8 lg:py-6">
          {/* 헤더: 인사 + Organization 전환 + (Owner) 관리자 대시보드 */}
          {/* 헤더: 인사말 | (학번 등록 후) 내 학번·동기화 | 버튼들 */}
          <header className="flex flex-col gap-5 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between lg:gap-x-6">
            <div className="shrink-0">
              <h1 className="text-3xl font-normal tracking-tight text-ink sm:text-4xl">
                {profile?.github_login ? `${profile.github_login}님, 안녕하세요.` : "안녕하세요."}
              </h1>
              <p className="mt-2 text-sm text-muted sm:text-base">
                {activeOrg}의 내 과제 현황입니다.
              </p>
            </div>

            {studentNo && (
              <div className="flex flex-1 justify-center lg:pt-1">
                <StudentNoBanner
                  initialStudentNo={studentNo}
                  repoCount={repoItems.length}
                  activeOrg={activeOrg}
                  variant="inline"
                />
              </div>
            )}

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-start lg:ml-auto">
              <OrganizationSwitcher
                activeOrg={activeOrg}
                organizations={organizations}
                basePath="/dashboard"
                isOwner={isOwnerOfActiveOrg}
                variant="compact"
              />
              {/* Owner일 때만: 관리자 대시보드로 이동 */}
              {isOwnerOfActiveOrg && (
                <Link
                  href={`/admin?org=${encodeURIComponent(activeOrg)}`}
                  title="과제 전체 제출 현황 확인, 기준 수정 및 일괄 ZIP 다운로드는 관리자 대시보드에서 진행할 수 있습니다."
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-surface px-5 py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink shadow-neu-sm transition hover:shadow-neu-inset shrink-0"
                >
                  <Shield className="h-3.5 w-3.5 text-lilac-ink" />
                  <span>관리자 대시보드</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
              {/* 라이트/다크 모드 전환 */}
              <ThemeToggle />
            </div>
          </header>

          {/* 학번 등록 전에만: 최초 학번 입력 카드 (등록 후에는 헤더 가운데로 이동) */}
          {!studentNo && (
            <StudentNoBanner
              initialStudentNo={studentNo}
              repoCount={repoItems.length}
              activeOrg={activeOrg}
            />
          )}

          {repoItems.length > 0 ? (
            <>
              {/* 날짜 · 달성률 · 이번주 과제(최신) 통계 */}
              <StudentFocusDashboard current={repoItems[0]} nowMs={nowMs} />

              {/* 내 과제 목록(직전 과제 포함) + Goals(비워 둠) */}
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <StudentRepoList
                  items={repoItems}
                  topSlot={
                    repoItems[1] ? (
                      <PreviousAssignmentCard item={repoItems[1]} nowMs={nowMs} />
                    ) : undefined
                  }
                />
                <GoalsPanel />
              </div>
            </>
          ) : (
            <div className="rounded-[28px] p-12 text-center shadow-neu-inset">
              <p className="text-sm font-medium text-ink">
                {studentNo
                  ? `${activeOrg} Organization에서 학번(${studentNo})과 일치하는 과제 저장소를 찾지 못했습니다.`
                  : "위 입력창에 본인의 학번(예: 22300743)을 입력하여 과제 저장소를 불러오세요."}
              </p>
              <p className="mt-1 text-xs text-muted">
                상단의 <strong>Organization 전환</strong> 기능으로 다른 수업 Organization을 선택하거나, 위쪽의 <strong>[최신 Repo 동기화]</strong>를 눌러 다시 스캔할 수 있습니다.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
