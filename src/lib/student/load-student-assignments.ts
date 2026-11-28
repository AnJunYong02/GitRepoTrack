import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveStudentNo, syncReposForStudent } from "@/lib/student/sync-student-repos";
import {
  belongsToOrg,
  countStatuses,
  extractWeekNo,
  pickCurrentItem,
  sortReposNewestFirst,
  toStudentRepoItem,
  type StudentRepoItemData,
  type StudentStatusCounts,
  type UpcomingAssignment,
} from "@/lib/student/student-assignments";

const SELECT_STUDENT_REPOS = `
  id,
  full_name,
  repo_id,
  student_no,
  profile_id,
  assignments (
    id,
    title,
    description,
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

export interface StudentAssignmentsResult {
  studentNo: string | null;
  items: StudentRepoItemData[];
  counts: StudentStatusCounts;
  /** 이번 주 과제 (items 중 하나, 없으면 null) */
  current: StudentRepoItemData | null;
  /** 내 repo가 아직 없는 마감 전 과제 (타임라인 "공개 전") */
  upcoming: UpcomingAssignment[];
}

/**
 * 활성 org에서 로그인한 학생의 과제 repo 목록과 상태를 불러온다.
 * allowSync: DB에 repo가 하나도 없을 때 org를 한 번 스캔할지 (메인·내 과제 화면에서만 true)
 */
export async function loadStudentAssignments(
  user: any,
  profile: any,
  activeOrg: string,
  { allowSync = false }: { allowSync?: boolean } = {}
): Promise<StudentAssignmentsResult> {
  // 1. 학번 확인 (메타데이터 → 연결된 repo → 커밋 작성자 → GitHub 프로필)
  const studentNo = await resolveStudentNo(user, profile);

  const orFilters = [`profile_id.eq.${user.id}`, `github_id.eq.${profile?.github_id || 0}`];
  if (studentNo) {
    orFilters.push(
      `student_no.eq.${studentNo}`,
      `full_name.ilike.%-${studentNo}`,
      `full_name.ilike.%_${studentNo}`
    );
  }

  const fetchRepos = async () => {
    const { data } = await supabaseAdmin
      .from("student_repos")
      .select(SELECT_STUDENT_REPOS)
      .or(orFilters.join(","))
      .order("created_at", { ascending: false });
    return (data || []).filter((r: any) => belongsToOrg(r, activeOrg));
  };

  // 2. 본인 repo 조회 (학번은 아는데 이 org에 repo가 없으면 한 번 자동 스캔)
  let orgRepos: any[] = await fetchRepos();
  if (allowSync && studentNo && orgRepos.length === 0) {
    await syncReposForStudent(user.id, profile?.github_id, studentNo, {
      scanOrgRepos: true,
      orgName: activeOrg,
    });
    orgRepos = await fetchRepos();
  }

  // 3. profile_id가 비어 있는 repo만 본인에게 연결, 다른 사용자 repo는 제외
  if (orgRepos.length > 0) {
    const unboundIds = orgRepos.filter((r) => !r.profile_id).map((r) => r.id);
    if (unboundIds.length > 0) {
      await supabaseAdmin.from("student_repos").update({ profile_id: user.id }).in("id", unboundIds);
    }
    orgRepos = orgRepos.filter((r) => !r.profile_id || r.profile_id === user.id);
  }

  const items = sortReposNewestFirst(orgRepos).map(toStudentRepoItem);
  const nowMs = Date.now();

  // 4. 공개 전 과제: 같은 org에서 마감 전이고 내 repo가 없는 과제 (실패해도 화면은 그림)
  let upcoming: UpcomingAssignment[] = [];
  const myAssignmentIds = new Set(items.map((i) => i.assignmentId).filter(Boolean));
  const { data: futureAssignments } = await supabaseAdmin
    .from("assignments")
    .select("id, title, deadline_at")
    .ilike("org_name", activeOrg)
    .gt("deadline_at", new Date(nowMs).toISOString())
    .order("deadline_at", { ascending: true })
    .limit(10);
  if (Array.isArray(futureAssignments)) {
    upcoming = futureAssignments
      .filter((a: any) => !myAssignmentIds.has(a.id))
      .map((a: any) => ({
        id: a.id,
        title: a.title,
        weekNo: extractWeekNo(null, a.title),
        deadlineAt: a.deadline_at,
      }));
  }

  return {
    studentNo,
    items,
    counts: countStatuses(items),
    current: pickCurrentItem(items, nowMs),
    upcoming,
  };
}
