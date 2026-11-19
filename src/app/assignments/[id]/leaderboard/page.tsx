import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkIsUserOwnerOfOrg } from "@/lib/org/active-org";
import { Trophy, Clock, CheckCircle2, AlertCircle, ArrowLeft, GitCommit, FileText, Medal, UploadCloud, Users } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/navigation/back-link";
import { StudentSidebar } from "@/components/student/student-sidebar";
import { SIDEBAR_COOKIE } from "@/components/student/sidebar-cookie";
import { ThemeToggle } from "@/components/theme-toggle";
import { CountUp } from "@/components/count-up";

/** 카드 라벨 (학생 대시보드와 같은 16px 스타일) */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-wide text-ink">
      <span className="h-2 w-2 rounded-full bg-accent" />
      {children}
    </h2>
  );
}

/** 사이드바 + 본문 공통 틀 (분석 대시보드와 같은 구조) */
async function LeaderboardShell({
  activeOrg,
  isOwner,
  profile,
  children,
}: {
  activeOrg?: string;
  isOwner: boolean;
  profile: any;
  children: ReactNode;
}) {
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <div className="min-h-screen bg-surface font-display text-ink">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6 p-4 sm:p-6 lg:flex-row lg:gap-10 lg:pr-10">
        <StudentSidebar
          activeOrg={activeOrg || undefined}
          isOwner={isOwner}
          githubLogin={profile?.github_login}
          avatarUrl={profile?.avatar_url}
          active="none"
          defaultCollapsed={collapsed}
        />
        <main className="min-w-0 flex-1 space-y-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

/** 안내 문구만 보여주는 카드 (과제 없음 / 순위표 비활성화) */
function NoticeCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[28px] bg-surface p-10 text-center text-sm text-muted shadow-neu">{children}</div>
  );
}

/** 금·은·동 원형 메달 색 */
const MEDAL = [
  { emoji: "🥇", label: "1위 (Gold)", circle: "bg-amber-200 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200", name: "text-amber-700 dark:text-amber-300", row: "bg-amber-400/[0.07]" },
  { emoji: "🥈", label: "2위 (Silver)", circle: "bg-slate-200 text-slate-800 dark:bg-slate-500/30 dark:text-slate-200", name: "text-slate-700 dark:text-slate-200", row: "bg-slate-400/[0.07]" },
  { emoji: "🥉", label: "3위 (Bronze)", circle: "bg-orange-200 text-orange-900 dark:bg-orange-700/30 dark:text-orange-200", name: "text-orange-800 dark:text-orange-300", row: "bg-orange-400/[0.06]" },
];

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = await params;
  const current = await requireUser();

  // Fetch assignment with its criteria rules (including minCommits and readmeKeywords)
  const { data: assignment } = await supabaseAdmin
    .from("assignments")
    .select(`
      *,
      criteria_versions:criteria_versions!criteria_versions_assignment_id_fkey (*)
    `)
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return (
      <LeaderboardShell isOwner={false} profile={current.profile}>
        <NoticeCard>과제를 찾을 수 없습니다.</NoticeCard>
      </LeaderboardShell>
    );
  }

  // 이 과제가 속한 org의 Owner인지 (org마다 권한이 다름)
  const isOrgOwner = await checkIsUserOwnerOfOrg(
    assignment.org_name || "",
    current.user,
    current.profile
  );

  if (assignment.ranking_mode === "none" && !isOrgOwner) {
    return (
      <LeaderboardShell activeOrg={assignment.org_name} isOwner={isOrgOwner} profile={current.profile}>
        <NoticeCard>해당 과제는 순위표가 비활성화되어 있습니다.</NoticeCard>
      </LeaderboardShell>
    );
  }

  // Active criteria
  const activeVersion = assignment.criteria_versions?.find(
    (cv: any) => cv.id === assignment.current_criteria_version_id
  );
  const minCommits = activeVersion?.rules?.minCommits || 0;

  // Fetch all student repos with evaluation data
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

  // Parse each student's 3 qualification conditions:
  // 1. 제출 여부: 코드 push 완료 (commitCount > 0)
  // 2. commit 갯수: 기준 커밋수 이상 충족 (minCommits <= 0 || commitCount >= minCommits)
  // 3. README 충족 여부: 필수 키워드 조건 만족
  const items = (studentRepos || []).map((sr: any) => {
    const status = sr.repo_status;
    const snapshot = status?.snapshots;
    const evals = snapshot?.evaluations;
    const latestEval = Array.isArray(evals) ? evals[0] : evals;
    const commitCount = snapshot?.commit_count ?? (sr.commits?.length ? sr.commits.length : 0);

    const hasPushed = commitCount > 0;
    const commitsMet = minCommits <= 0 || commitCount >= minCommits;
    const readmeMet = latestEval?.readme_results?.satisfied ?? false;

    // 3 conditions all satisfied
    const isQualified = hasPushed && commitsMet && readmeMet;

    // Latest or first satisfaction timestamp
    let firstSatisfiedAt = status?.first_satisfied_at || null;
    if (isQualified && !firstSatisfiedAt) {
      if (sr.commits && sr.commits.length > 0) {
        const sortedCommits = [...sr.commits].sort(
          (a: any, b: any) =>
            new Date(a.committed_at).getTime() - new Date(b.committed_at).getTime()
        );
        firstSatisfiedAt = sortedCommits[0]?.committed_at || null;
      } else if (snapshot?.observed_at) {
        firstSatisfiedAt = snapshot.observed_at;
      }
    }

    const displayName = sr.profiles?.github_login
      ? `@${sr.profiles.github_login}`
      : (sr.student_no ? `${sr.student_no}${sr.student_name ? ` (${sr.student_name})` : ""}` : sr.full_name);

    const satisfiedFormatted = firstSatisfiedAt
      ? new Date(firstSatisfiedAt).toLocaleString("ko-KR", {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })
      : null;

    return {
      id: sr.id,
      displayName,
      fullName: sr.full_name,
      commitCount,
      hasPushed,
      commitsMet,
      readmeMet,
      isQualified,
      firstSatisfiedAt,
      satisfiedFormatted,
    };
  });

  // Qualified students: sorted by firstSatisfiedAt ASC
  const qualifiedList = items.filter((item) => item.isQualified);
  qualifiedList.sort((a, b) => {
    if (a.firstSatisfiedAt && b.firstSatisfiedAt) {
      return new Date(a.firstSatisfiedAt).getTime() - new Date(b.firstSatisfiedAt).getTime();
    }
    return (b.commitCount || 0) - (a.commitCount || 0);
  });

  // Assign ranks
  qualifiedList.forEach((item, idx) => {
    (item as any).rank = idx + 1;
  });

  // Unqualified students
  const unqualifiedList = items.filter((item) => !item.isQualified);
  unqualifiedList.sort((a, b) => {
    if (a.hasPushed && !b.hasPushed) return -1;
    if (!a.hasPushed && b.hasPushed) return 1;
    return (b.commitCount || 0) - (a.commitCount || 0);
  });
  unqualifiedList.forEach((item) => {
    (item as any).rank = null;
  });

  // Top 3 Podium
  const top3 = qualifiedList.slice(0, 3);
  const fullLeaderboard = [...qualifiedList, ...unqualifiedList];

  const assignmentHref = isOrgOwner
    ? `/admin/assignments/${assignment.id}`
    : assignment.org_name
    ? `/dashboard?org=${encodeURIComponent(assignment.org_name)}`
    : "/dashboard";

  const CONDITIONS = [
    { icon: UploadCloud, title: "코드 Push 완료", desc: "저장소에 커밋을 push" },
    {
      icon: GitCommit,
      title: minCommits > 0 ? `커밋 ${minCommits}개 이상` : "커밋 수 제한 없음",
      desc: "최소 커밋 기준 충족",
    },
    { icon: FileText, title: "README 키워드 통과", desc: "필수 키워드 모두 포함" },
  ];

  return (
    <LeaderboardShell activeOrg={assignment.org_name} isOwner={isOrgOwner} profile={current.profile}>
      {/* 헤더: 뒤로가기 · 경로 · 제목 + 테마 토글 */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-3">
          <BackLink
            fallbackHref={assignmentHref}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-surface px-3.5 py-2 text-xs font-medium text-ink/80 shadow-neu-sm transition hover:text-ink hover:shadow-neu-inset"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isOrgOwner ? "뒤로가기 (과제 관리 화면)" : "뒤로가기 (내 과제 목록)"}</span>
          </BackLink>

          <nav aria-label="현재 위치" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {assignment.org_name && (
              <>
                <span className="font-mono">{assignment.org_name}</span>
                <span>/</span>
              </>
            )}
            <Link href={assignmentHref} className="hover:text-ink hover:underline">
              {assignment.title}
            </Link>
            <span>/</span>
            <span className="font-medium text-ink/80">실시간 순위표</span>
          </nav>

          <h1 className="text-3xl font-normal tracking-tight text-ink sm:text-4xl lg:text-3xl 2xl:text-4xl">
            {assignment.title}
          </h1>
        </div>

        <div className="flex items-center gap-2.5 sm:shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-2xl bg-surface px-3.5 py-3 text-xs font-semibold text-ink shadow-neu-sm">
            <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>실시간 순위표</span>
          </span>
          <ThemeToggle />
        </div>
      </header>

      {/* 등재 조건 + 충족 인원 */}
      <section aria-label="순위표 등재 조건" className="neu-hover rounded-[28px] bg-surface p-6 shadow-neu">
        <SectionLabel>순위표 등재 3대 조건</SectionLabel>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <ol className="grid gap-3 sm:grid-cols-3">
            {CONDITIONS.map((c, i) => (
              <li key={c.title} className="neu-tile flex items-center gap-3 rounded-2xl p-4 shadow-neu-inset">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lilac text-lilac-ink">
                  <c.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted">조건 {i + 1}</p>
                  <p className="text-sm font-semibold text-ink">{c.title}</p>
                  <p className="text-xs text-muted">{c.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="neu-tile flex flex-col justify-center rounded-2xl p-4 shadow-neu-inset">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <Users className="h-3.5 w-3.5" />
              조건 완벽 충족
            </p>
            <p className="mt-1 text-ink">
              <CountUp
                value={qualifiedList.length}
                className="text-3xl font-semibold tabular-nums"
                doneClassName="text-emerald-600 dark:text-emerald-400"
              />
              <span className="text-sm text-muted"> / 총 {items.length}명</span>
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          * 위 3가지 조건을 모두 최초로 충족한 시각이 빠른 순서대로 1등, 2등, 3등... 순위가 부여됩니다.
        </p>
      </section>

      {/* 명예의 전당 */}
      {top3.length > 0 && (
        <section aria-label="명예의 전당" className="space-y-4">
          <h2 className="inline-flex items-center gap-2 text-base font-semibold tracking-wide text-ink">
            <Medal className="h-4 w-4 text-amber-500" />
            명예의 전당 (Top 3)
          </h2>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {top3.map((winner: any, idx: number) => {
              const medal = MEDAL[idx];
              return (
                <div
                  key={winner.id}
                  className="neu-hover flex flex-col items-center gap-3 rounded-[28px] bg-surface p-6 text-center shadow-neu"
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl shadow-neu-sm ${medal.circle}`}
                    aria-hidden
                  >
                    {medal.emoji}
                  </span>
                  <span className="text-xs font-semibold text-muted">{medal.label}</span>
                  <div className="w-full min-w-0">
                    <h3 className={`truncate text-lg font-bold ${medal.name}`}>{winner.displayName}</h3>
                    <p className="truncate font-mono text-[11px] text-muted" title={winner.fullName}>
                      {winner.fullName}
                    </p>
                  </div>
                  <dl className="grid w-full grid-cols-2 gap-2 rounded-2xl p-3 text-xs shadow-neu-inset">
                    <div>
                      <dt className="text-[11px] text-muted">커밋수</dt>
                      <dd className="font-semibold text-emerald-600 dark:text-emerald-400">{winner.commitCount}개</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-muted">최초 달성</dt>
                      <dd className="font-mono font-semibold text-ink">{winner.satisfiedFormatted}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {error && (
        <div className="rounded-2xl bg-red-500/10 p-4 text-xs text-red-700 shadow-neu-inset dark:text-red-300">
          순위표를 불러오는 중 오류가 발생했습니다: {error.message}
        </div>
      )}

      {/* 전체 순위 표 */}
      <section aria-label="전체 제출 및 순위 현황" className="neu-hover rounded-[28px] bg-surface p-6 shadow-neu">
        <div className="flex items-center gap-2">
          <SectionLabel>전체 제출 및 순위 현황</SectionLabel>
          <span className="text-sm text-muted">({items.length}명)</span>
        </div>

        <div className="mt-5 overflow-x-auto rounded-2xl shadow-neu-inset">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-muted/15 text-muted">
              <tr>
                <th className="px-4 py-3 w-20 text-center font-medium">순위</th>
                <th className="px-4 py-3 font-medium">학생 / 저장소</th>
                <th className="px-4 py-3 font-medium">커밋 기준 충족</th>
                <th className="px-4 py-3 font-medium">README 충족</th>
                <th className="px-4 py-3 font-medium">최초 달성 시각</th>
                <th className="px-4 py-3 text-right font-medium">순위 등재 여부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/10">
              {fullLeaderboard && fullLeaderboard.length > 0 ? (
                fullLeaderboard.map((item: any) => {
                  const rank = item.rank;
                  const medal = rank && rank <= 3 ? MEDAL[rank - 1] : null;

                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-[rgb(var(--neu-light)/0.45)] ${medal ? medal.row : ""}`}
                    >
                      <td className="px-4 py-3 text-center">
                        {rank ? (
                          <span
                            className={`inline-flex h-8 min-w-8 items-center justify-center gap-0.5 rounded-full px-2 text-xs font-bold ${
                              medal ? medal.circle : "bg-surface text-ink shadow-neu-sm"
                            }`}
                          >
                            {medal ? `${medal.emoji} ${rank}` : `${rank}위`}
                          </span>
                        ) : (
                          <span className="text-muted/60">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-ink">{item.displayName}</div>
                        <div className="max-w-xs truncate font-mono text-[11px] text-muted">{item.fullName}</div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {minCommits > 0 ? (
                          item.commitCount >= minCommits ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {item.commitCount} / {minCommits}개
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              {item.commitCount} / {minCommits}개
                            </span>
                          )
                        ) : (
                          <span className="text-ink/80">{item.commitCount}개</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.readmeMet ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">통과</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">미충족</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {item.satisfiedFormatted ? (
                          <span className="inline-flex items-center gap-1 font-medium text-ink/80">
                            <Clock className="w-3.5 h-3.5 text-muted" />
                            <span>{item.satisfiedFormatted}</span>
                          </span>
                        ) : (
                          <span className="text-muted/60">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.isQualified ? (
                          <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>순위 등재</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] text-muted">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>조건 미달</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted">
                    등록된 제출 기록이 아직 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </LeaderboardShell>
  );
}
