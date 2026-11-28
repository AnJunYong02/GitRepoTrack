import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkIsUserOwnerOfOrg } from "@/lib/org/active-org";
import { summarizeStatusRows, toStudentStatusRow } from "@/lib/admin/student-status-rows";
import { formatAssignmentTitle } from "@/lib/admin/assignment-title";
import { formatKstDateTime } from "@/lib/student/time-utils";
import { ANALYSIS_BRANCH } from "@/lib/assignments/branch";
import { loadOrgRoster } from "@/lib/roster/org-roster";
import { CriteriaForm } from "@/components/admin/criteria-form";
import { AddRepoForm } from "@/components/admin/add-repo-form";
import { BatchAnalyzeButton } from "@/components/admin/batch-analyze-button";
import { StudentStatusTable } from "@/components/admin/student-status-table";
import { ResizableSplitLayout } from "@/components/admin/resizable-split-layout";
import { BackLink } from "@/components/navigation/back-link";
import { StudentShell } from "@/components/student/student-shell";

const BTN_GRAY =
  "inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-chip px-4 py-2.5 text-[13px] font-semibold text-fg-2 transition hover:text-fg";

export default async function AdminAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = await params;
  const current = await getCurrentUser();

  // 로그인 전이면 첫 화면으로. 권한은 아래에서 과제 org의 Owner인지로 판단한다
  if (!current) {
    redirect("/");
  }
  const sidebarBase = {
    githubLogin: current.profile?.github_login,
    avatarUrl: current.profile?.avatar_url,
  };

  // 1. Fetch assignment
  const { data: assignment, error: assignErr } = await supabaseAdmin
    .from("assignments")
    .select(`
      *,
      criteria_versions:criteria_versions!criteria_versions_assignment_id_fkey (*)
    `)
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    console.error("Assignment fetch error:", assignErr);
    return (
      <StudentShell sidebar={{ ...sidebarBase, isOwner: false }}>
        <p className="border-y border-line py-12 text-center text-[14px] text-fg-3">과제를 찾을 수 없습니다.</p>
      </StudentShell>
    );
  }

  // 이 과제 org의 Owner인지 (org마다 권한이 다름)
  const isOwnerOfAssignmentOrg = await checkIsUserOwnerOfOrg(assignment.org_name, current.user, current.profile);
  if (!isOwnerOfAssignmentOrg) {
    return (
      <StudentShell sidebar={{ ...sidebarBase, activeOrg: assignment.org_name, isOwner: false }}>
        <section className="space-y-4 border-y border-line py-12">
          <h1 className="text-[24px] font-bold tracking-tight text-fg">{assignment.org_name} 관리자 권한이 없어요</h1>
          <p className="text-[14px] text-fg-2">이 과제가 속한 GitHub Organization의 Owner만 볼 수 있어요.</p>
          <Link
            href={`/dashboard?org=${encodeURIComponent(assignment.org_name)}`}
            className="inline-flex rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-110"
          >
            내 과제 대시보드로
          </Link>
        </section>
      </StudentShell>
    );
  }

  // 2. Fetch all student repos
  const { data: studentRepos } = await supabaseAdmin
    .from("student_repos")
    .select(`
      id,
      full_name,
      student_no,
      student_name,
      github_id,
      profiles (
        github_login
      ),
      commits (
        committed_at
      ),
      repo_status (
        stale,
        fetched_at,
        last_error,
        latest_snapshot_id,
        first_satisfied_at,
        snapshots:latest_snapshot_id (
          commit_count,
          observed_at,
          evaluations (
            submitted,
            file_results,
            readme_results
          )
        )
      )
    `)
    .eq("assignment_id", assignmentId)
    .order("student_no", { ascending: true });

  // 현재 기준
  const activeVersion = assignment.criteria_versions?.find(
    (cv: any) => cv.id === assignment.current_criteria_version_id
  );
  const minCommits = activeVersion?.rules?.minCommits || 0;
  const activeKeywords: string[] =
    activeVersion?.rules?.readme?.headerKeywords || activeVersion?.rules?.readmeKeywords || [];

  // 표·요약 숫자 (규칙은 src/lib/admin/student-status-rows.ts)
  // 학생 관리 명단(학번 → 이름·GitHub ID). Owner 확인 후에만 읽는다
  const roster = await loadOrgRoster(assignment.org_name).catch(() => []);
  const rosterByNo = new Map(roster.map((s) => [s.studentNo, { name: s.name, githubLogin: s.githubLogin }]));
  const rows = (studentRepos || []).map((sr: any) =>
    toStudentStatusRow(sr, minCommits, activeKeywords, sr.student_no ? rosterByNo.get(sr.student_no) : null)
  );
  const summary = summarizeStatusRows(rows);
  const submittedPct = summary.total ? Math.round((summary.submitted / summary.total) * 100) : 0;
  const unsubmittedPct = summary.total ? Math.round((summary.unsubmitted / summary.total) * 100) : 0;

  const title = assignment.description === "RepoTrack assignment creation v1" ? { label: assignment.title, isMidterm: false } : formatAssignmentTitle(assignment.title);
  const orgQuery = `?org=${encodeURIComponent(assignment.org_name)}`;

  return (
    <StudentShell
      sidebar={{
        ...sidebarBase,
        mode: "admin",
        activeOrg: assignment.org_name,
        isOwner: true,
        active: "admin",
        leaderboardHref: `/assignments/${assignment.id}/leaderboard`,
      }}
    >
      <div className="space-y-12">
        {/* 헤더 */}
        <header className="space-y-5">
          <BackLink
            fallbackHref={`/admin${orgQuery}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-chip px-4 py-2.5 text-[15px] font-semibold text-fg-2 transition hover:text-fg"
          >
            <ArrowLeft className="h-4 w-4" />
            과제 목록
          </BackLink>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <h1 className="flex flex-wrap items-center gap-3 text-[34px] font-bold tracking-[-0.03em] text-fg sm:text-[44px]" title={assignment.title}>
                {title.label}
                {title.isMidterm && (
                  <span className="rounded-md bg-chart/10 px-2 py-1 text-[14px] font-semibold tracking-normal text-chart">중간고사</span>
                )}
              </h1>
              <p className="text-[15px] text-fg-3">
                {formatKstDateTime(assignment.deadline_at)} 마감 · {ANALYSIS_BRANCH} 브랜치
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 xl:pt-3">
              <BatchAnalyzeButton assignmentId={assignment.id} totalCount={summary.total} unanalyzedCount={summary.pending} />
              <Link href={`/assignments/${assignment.id}/leaderboard`} className={BTN_GRAY}>
                <Trophy className="h-4 w-4 text-chart" />
                실시간 순위표
              </Link>
              {/* ZIP 일괄 다운로드 (학교 서버 단일 스트리밍) */}
              <a href={`/api/admin/assignments/${assignment.id}/archive`} className={BTN_GRAY} download>
                <Download className="h-4 w-4" />
                Repo 다운로드 (.zip)
              </a>
              <AddRepoForm assignmentId={assignment.id} orgName={assignment.org_name} />
            </div>
          </div>
        </header>

        {/* 요약 숫자 + 제출률 */}
        <section aria-label="제출 요약" className="flex flex-col gap-8 border-b border-line pb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-wrap gap-x-14 gap-y-6">
            <BigStat value={summary.total} label="배정 학생" className="text-fg" />
            <BigStat value={summary.submitted} label="제출 완료" className="text-brand" />
            <BigStat value={summary.unsubmitted} label="미제출" className="text-danger" />
            {summary.pending > 0 && <BigStat value={summary.pending} label="분석 대기" className="text-fg-3" />}
          </div>
          <div className="w-full space-y-3 pt-4 lg:w-[520px]">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-fg-3">제출률</span>
              <span className="font-bold text-brand">
                {summary.total}명 중 {summary.submitted}명 · {submittedPct}%
              </span>
            </div>
            <div
              className="flex h-2 w-full overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-label="제출률"
              aria-valuenow={submittedPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-brand" style={{ width: `${submittedPct}%` }} />
              <div className="h-full bg-danger" style={{ width: `${unsubmittedPct}%` }} />
            </div>
          </div>
        </section>

        {summary.pending > 0 && (
          <p role="note" className="-mt-6 text-[13px] text-fg-2">
            아직 분석되지 않은 학생 저장소가 <strong className="text-fg">{summary.pending}개</strong> 있어요. 오른쪽 위{" "}
            <strong className="text-brand">▷ 분석하기</strong>를 먼저 눌러 주세요.
          </p>
        )}

        {/* 왼쪽: 기준 설정 / 오른쪽: 학생별 현황 (가운데 막대로 폭 조절, 기본 4:6) */}
        <ResizableSplitLayout
          left={
            <CriteriaForm
              assignmentId={assignment.id}
              initialDeadlineAt={assignment.deadline_at}
              initialRules={activeVersion?.rules}
            />
          }
          right={<StudentStatusTable rows={rows} />}
        />
      </div>
    </StudentShell>
  );
}

function BigStat({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div>
      <p className={`text-[48px] font-bold leading-none tracking-tight tabular-nums ${className}`}>{value}</p>
      <p className="mt-3 text-[14px] text-fg-3">{label}</p>
    </div>
  );
}
