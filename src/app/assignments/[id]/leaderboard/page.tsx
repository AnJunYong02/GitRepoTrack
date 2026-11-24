import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkIsUserOwnerOfOrg } from "@/lib/org/active-org";
import { loadStudentAssignments } from "@/lib/student/load-student-assignments";
import { extractWeekNo, weekTitle } from "@/lib/student/student-assignments";
import { formatKstDateTime } from "@/lib/student/time-utils";
import { BackLink } from "@/components/navigation/back-link";
import { StudentShell } from "@/components/student/student-shell";
import { ReferenceNotice } from "@/components/student/reference-notice";
import { LeaderboardWeekSelect } from "@/components/student/leaderboard-week-select";
import { buildWeekOptions } from "@/lib/assignments/leaderboard-weeks";

/** 금·은·동 (글자색 · 1~3위 행 배경) */
const MEDAL = [
  { emoji: "🥇", text: "text-amber-500", row: "bg-amber-400/[0.06]" },
  { emoji: "🥈", text: "text-slate-400", row: "bg-slate-400/[0.06]" },
  { emoji: "🥉", text: "text-orange-500", row: "bg-orange-400/[0.05]" },
];

/** 안내만 보여주는 영역 (과제 없음 / 순위표 비활성화) */
function Notice({ children }: { children: ReactNode }) {
  return <p className="border-y border-line py-12 text-center text-[14px] text-fg-3">{children}</p>;
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <h2 className="text-[20px] font-bold tracking-tight text-fg">{children}</h2>
      {aside && <span className="text-[12px] text-fg-3">{aside}</span>}
    </div>
  );
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = await params;
  const current = await requireUser();

  // 과제 + 기준(최소 커밋 수 등)
  const { data: assignment } = await supabaseAdmin
    .from("assignments")
    .select(`
      *,
      criteria_versions:criteria_versions!criteria_versions_assignment_id_fkey (*)
    `)
    .eq("id", assignmentId)
    .single();

  const org: string = assignment?.org_name || "";

  // 사이드바 "과제 현황" 숫자 (자동 스캔 없이 DB 기준)
  const sidebarData = org
    ? await loadStudentAssignments(current.user, current.profile, org, { allowSync: false })
    : null;

  // 이 과제가 속한 org의 Owner인지 (org마다 권한이 다름)
  const isOrgOwner = assignment
    ? await checkIsUserOwnerOfOrg(org, current.user, current.profile)
    : false;

  const shell = (children: ReactNode) => (
    <StudentShell
      sidebar={{
        activeOrg: org || undefined,
        isOwner: isOrgOwner,
        githubLogin: current.profile?.github_login,
        avatarUrl: current.profile?.avatar_url,
        studentNo: sidebarData?.studentNo,
        status: sidebarData?.counts,
        active: "leaderboard",
        leaderboardHref: assignment ? `/assignments/${assignment.id}/leaderboard` : null,
      }}
    >
      {children}
    </StudentShell>
  );

  if (!assignment) {
    return shell(<Notice>과제를 찾을 수 없습니다.</Notice>);
  }

  if (assignment.ranking_mode === "none" && !isOrgOwner) {
    return shell(<Notice>해당 과제는 순위표가 비활성화되어 있습니다.</Notice>);
  }

  // 현재 기준
  const activeVersion = assignment.criteria_versions?.find(
    (cv: any) => cv.id === assignment.current_criteria_version_id
  );
  const minCommits = activeVersion?.rules?.minCommits || 0;

  // 이 과제의 모든 학생 repo + 평가 결과
  const { data: studentRepos, error } = await supabaseAdmin
    .from("student_repos")
    .select(`
      id,
      student_no,
      student_name,
      full_name,
      profiles (
        github_login
      ),
      commits (
        committed_at
      ),
      repo_status (
        first_satisfied_at,
        snapshots:latest_snapshot_id (
          commit_count,
          observed_at,
          evaluations (
            submitted,
            readme_results
          )
        )
      )
    `)
    .eq("assignment_id", assignmentId);

  // 등재 3대 조건:
  // 1. 제출 여부: 코드 push 완료 (commitCount > 0)
  // 2. 커밋 수: 기준 이상 (minCommits <= 0 || commitCount >= minCommits)
  // 3. README: 필수 키워드 조건 만족
  const items = (studentRepos || []).map((sr: any) => {
    const status = sr.repo_status;
    const snapshot = status?.snapshots;
    const evals = snapshot?.evaluations;
    const latestEval = Array.isArray(evals) ? evals[0] : evals;
    const commitCount = snapshot?.commit_count ?? (sr.commits?.length ? sr.commits.length : 0);

    const hasPushed = commitCount > 0;
    const commitsMet = minCommits <= 0 || commitCount >= minCommits;
    const readmeMet = latestEval?.readme_results?.satisfied ?? false;
    const isQualified = hasPushed && commitsMet && readmeMet;

    // 최초 충족 시각 (없으면 첫 커밋 → 스냅샷 관측 시각)
    let firstSatisfiedAt = status?.first_satisfied_at || null;
    if (isQualified && !firstSatisfiedAt) {
      if (sr.commits && sr.commits.length > 0) {
        const sortedCommits = [...sr.commits].sort(
          (a: any, b: any) => new Date(a.committed_at).getTime() - new Date(b.committed_at).getTime()
        );
        firstSatisfiedAt = sortedCommits[0]?.committed_at || null;
      } else if (snapshot?.observed_at) {
        firstSatisfiedAt = snapshot.observed_at;
      }
    }

    const displayName = sr.profiles?.github_login
      ? `@${sr.profiles.github_login}`
      : sr.student_no
      ? `${sr.student_no}${sr.student_name ? ` (${sr.student_name})` : ""}`
      : sr.full_name;

    return {
      id: sr.id as string,
      displayName: displayName as string,
      fullName: sr.full_name as string,
      commitCount: commitCount as number,
      hasPushed,
      commitsMet,
      readmeMet,
      isQualified,
      firstSatisfiedAt: firstSatisfiedAt as string | null,
      // 서버 시간대와 상관없이 KST로 표시
      satisfiedFormatted: firstSatisfiedAt ? formatKstDateTime(firstSatisfiedAt) : null,
      rank: null as number | null,
    };
  });

  // 등재자: 최초 충족 시각이 빠른 순
  const qualifiedList = items.filter((item) => item.isQualified);
  qualifiedList.sort((a, b) => {
    if (a.firstSatisfiedAt && b.firstSatisfiedAt) {
      return new Date(a.firstSatisfiedAt).getTime() - new Date(b.firstSatisfiedAt).getTime();
    }
    return (b.commitCount || 0) - (a.commitCount || 0);
  });
  qualifiedList.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  // 미등재자: push한 학생 먼저, 그다음 커밋 많은 순
  const unqualifiedList = items.filter((item) => !item.isQualified);
  unqualifiedList.sort((a, b) => {
    if (a.hasPushed && !b.hasPushed) return -1;
    if (!a.hasPushed && b.hasPushed) return 1;
    return (b.commitCount || 0) - (a.commitCount || 0);
  });

  const top3 = qualifiedList.slice(0, 3);
  const fullLeaderboard = [...qualifiedList, ...unqualifiedList];

  const total = items.length;

  // 주차 드롭다운: 같은 org의 과제 목록
  const { data: orgAssignments } = await supabaseAdmin
    .from("assignments")
    .select("id, title, deadline_at, ranking_mode")
    .eq("org_name", org);
  const weekOptions = buildWeekOptions(orgAssignments || [], { isOwner: isOrgOwner });

  const backHref = isOrgOwner
    ? `/admin/assignments/${assignment.id}`
    : org
    ? `/dashboard/assignments?org=${encodeURIComponent(org)}`
    : "/dashboard";

  const CONDITIONS = [
    { title: "코드 Push 완료", desc: "저장소에 커밋을 push" },
    {
      title: minCommits > 0 ? `커밋 ${minCommits}개 이상` : "커밋 수 제한 없음",
      desc: "최소 커밋 기준 충족",
    },
    { title: "README 키워드 통과", desc: "필수 키워드 모두 포함" },
  ];

  return shell(
    <div className="space-y-14">
      {/* 1. 헤더 */}
      <header className="space-y-5">
        <BackLink
          fallbackHref={backHref}
          className="inline-flex items-center gap-1.5 rounded-xl bg-chip px-4 py-2.5 text-[15px] font-semibold text-fg-2 transition hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{isOrgOwner ? "과제 관리 화면" : "내 과제 목록"}</span>
        </BackLink>
        <div className="space-y-3">
          <h1 className="text-[34px] font-bold tracking-[-0.03em] text-fg sm:text-[42px]">
            {weekTitle(extractWeekNo(null, assignment.title), assignment.title)} 순위표
          </h1>
          <p className="font-mono text-[13px] text-fg-2">
            {org}
            {assignment.deadline_at && ` · 마감 ${formatKstDateTime(assignment.deadline_at)}`}
          </p>
          {weekOptions.length >= 2 && (
            <LeaderboardWeekSelect options={weekOptions} currentId={assignment.id} />
          )}
        </div>
        <ReferenceNotice subject="이 순위표" target="순위·분석 결과" variant="inline" />
      </header>

      {/* 2. 명예의 전당 */}
      {top3.length > 0 && (
        <section aria-label="명예의 전당" className="space-y-5">
          <SectionTitle>명예의 전당</SectionTitle>
          <ol className="grid grid-cols-1 divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {top3.map((winner, idx) => {
              const medal = MEDAL[idx];
              return (
                <li key={winner.id} className="min-w-0 space-y-4 py-8 md:px-9 md:first:pl-0">
                  <p className="flex items-center gap-2">
                    <span className="text-[26px] leading-none" aria-hidden>
                      {medal.emoji}
                    </span>
                    <span className={`text-[15px] font-bold ${medal.text}`}>{idx + 1}위</span>
                  </p>
                  <div className="min-w-0">
                    <p className="truncate text-[20px] font-bold text-fg">{winner.displayName}</p>
                    <p className="truncate font-mono text-[12px] text-fg-3" title={winner.fullName}>
                      {winner.fullName.split("/").pop()}
                    </p>
                  </div>
                  <dl className="flex gap-8 text-[13px]">
                    <div>
                      <dt className="text-[11px] text-fg-3">커밋</dt>
                      <dd className="font-bold text-brand">{winner.commitCount}개</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-fg-3">최초 달성</dt>
                      <dd className="font-semibold text-fg">{winner.satisfiedFormatted ?? "-"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          순위표를 불러오는 중 오류가 발생했습니다: {error.message}
        </p>
      )}

      {/* 3. 전체 순위 */}
      <section aria-label="전체 제출 및 순위 현황" className="space-y-5">
        <SectionTitle aside={`총 ${total}명`}>전체 제출 및 순위 현황</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-line text-[11px] text-fg-3">
              <tr>
                <th className="w-20 py-3 pr-4 font-medium">순위</th>
                <th className="py-3 pr-4 font-medium">학생 / 저장소</th>
                <th className="py-3 pr-4 font-medium">커밋</th>
                <th className="py-3 pr-4 font-medium">README</th>
                <th className="py-3 pr-4 font-medium">최초 달성</th>
                <th className="py-3 text-right font-medium">순위 등재</th>
              </tr>
            </thead>
            <tbody>
              {fullLeaderboard.length > 0 ? (
                fullLeaderboard.map((item) => {
                  const medal = item.rank && item.rank <= 3 ? MEDAL[item.rank - 1] : null;
                  return (
                    <tr key={item.id} className={`border-b border-line text-[13px] ${medal ? medal.row : ""}`}>
                      <td className="py-4 pr-4">
                        {item.rank ? (
                          <span className={`font-bold tabular-nums ${medal ? medal.text : "text-fg"}`}>
                            {medal ? `${medal.emoji} ${item.rank}` : `${item.rank}위`}
                          </span>
                        ) : (
                          <span className="text-fg-3">-</span>
                        )}
                      </td>
                      <td className="max-w-[320px] py-4 pr-4">
                        <p className="truncate text-[14px] font-bold text-fg">{item.displayName}</p>
                        <p className="truncate font-mono text-[11px] text-fg-3">{item.fullName}</p>
                      </td>
                      <td className="py-4 pr-4 font-bold tabular-nums">
                        {minCommits > 0 ? (
                          <span className={item.commitsMet ? "text-brand" : "text-danger"}>
                            {item.commitCount} / {minCommits}개
                          </span>
                        ) : (
                          <span className="text-fg">{item.commitCount}개</span>
                        )}
                      </td>
                      <td className="py-4 pr-4 font-bold">
                        <span className={item.readmeMet ? "text-brand" : "text-danger"}>
                          {item.readmeMet ? "통과" : "미충족"}
                        </span>
                      </td>
                      <td className="py-4 pr-4 tabular-nums text-fg-2">{item.satisfiedFormatted ?? "-"}</td>
                      <td className="py-4 text-right">
                        {item.isQualified ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-1 text-[12px] font-semibold text-brand">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            순위 등재
                          </span>
                        ) : (
                          <span className="text-[12px] text-fg-3">조건 미달</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[14px] text-fg-3">
                    등록된 제출 기록이 아직 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. 등재 조건 (맨 아래) */}
      <section aria-label="순위표 등재 3대 조건" className="space-y-5">
        <SectionTitle>순위표 등재 3대 조건</SectionTitle>
        <ol className="grid grid-cols-1 divide-y divide-line border-y border-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {CONDITIONS.map((c, i) => (
            <li key={c.title} className="space-y-1.5 py-6 md:px-9 md:first:pl-0">
              <p className="font-mono text-[12px] text-fg-3">{String(i + 1).padStart(2, "0")}</p>
              <p className="text-[16px] font-bold text-fg">{c.title}</p>
              <p className="text-[13px] text-fg-2">{c.desc}</p>
            </li>
          ))}
        </ol>
        <p className="text-[12px] text-fg-3">
          * 3가지 조건을 모두 최초로 충족한 시각이 빠른 순서대로 1위, 2위, 3위… 순위가 부여됩니다.
        </p>
      </section>
    </div>
  );
}
