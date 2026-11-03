import { Navbar } from "@/components/navbar";
import { requireUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Trophy, Clock, CheckCircle2, AlertCircle, ArrowLeft, GitCommit, FileText, Medal } from "lucide-react";
import Link from "next/link";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = await params;
  const current = await requireUser();
  const isStaff = current?.profile?.role === "staff";

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="p-8 text-center text-sm">과제를 찾을 수 없습니다.</div>
      </div>
    );
  }

  if (assignment.ranking_mode === "none" && !isStaff) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="p-8 text-center text-sm text-slate-500">
          해당 과제는 순위표가 비활성화되어 있습니다.
        </div>
      </div>
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div>
          <Link
            href={isStaff ? `/admin/assignments/${assignment.id}` : "/dashboard"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{isStaff ? "뒤로가기 (과제 관리 화면)" : "뒤로가기 (내 과제 목록)"}</span>
          </Link>
        </div>

        {/* Top Header Card */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
              <Trophy className="w-3.5 h-3.5" />
              <span>실시간 순위표</span>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              조건 완벽 충족: <strong className="text-emerald-600">{qualifiedList.length}명</strong> / 총 {items.length}명
            </span>
          </div>

          <h1 className="text-2xl font-bold">{assignment.title}</h1>
          <div className="text-xs text-slate-500 space-y-1 pt-1">
            <p>
              💡 <strong>순위표 등재 3대 조건</strong>:
              1) 코드 push 완료 + 2) 최소 커밋 기준({minCommits > 0 ? `${minCommits}개 이상` : "제한 없음"}) 충족 + 3) README 필수 대제목 통과
            </p>
            <p className="text-[11px] text-slate-400">
              * 위 3가지 조건을 모두 최초로 충족한 시각이 빠른 순서대로 1등, 2등, 3등... 순위가 부여됩니다.
            </p>
          </div>
        </div>

        {/* Top 3 Podium Cards */}
        {top3.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              <Medal className="w-4 h-4 text-amber-500" />
              <span>명예의 전당 (Top 3)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3.map((winner: any, idx: number) => {
                const podiumStyles = [
                  {
                    rankBadge: "🥇 1위 (Gold)",
                    bg: "from-amber-100 via-amber-50/60 to-white dark:from-amber-950/70 dark:via-amber-950/30 dark:to-slate-900",
                    border: "border-amber-300 dark:border-amber-700",
                    badgeColor: "bg-amber-200 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200",
                    textColor: "text-amber-900 dark:text-amber-200",
                  },
                  {
                    rankBadge: "🥈 2위 (Silver)",
                    bg: "from-slate-100 via-slate-50/60 to-white dark:from-slate-800/70 dark:via-slate-800/30 dark:to-slate-900",
                    border: "border-slate-300 dark:border-slate-700",
                    badgeColor: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
                    textColor: "text-slate-800 dark:text-slate-200",
                  },
                  {
                    rankBadge: "🥉 3위 (Bronze)",
                    bg: "from-amber-900/10 via-amber-950/5 to-white dark:from-amber-950/40 dark:via-amber-950/10 dark:to-slate-900",
                    border: "border-amber-600/30 dark:border-amber-800/50",
                    badgeColor: "bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300",
                    textColor: "text-amber-950 dark:text-amber-300",
                  },
                ];
                const style = podiumStyles[idx];

                return (
                  <div
                    key={winner.id}
                    className={`relative rounded-xl border ${style.border} bg-gradient-to-b ${style.bg} p-5 shadow-sm text-center space-y-2 transition hover:scale-[1.01]`}
                  >
                    <div className="flex justify-center">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${style.badgeColor}`}>
                        {style.rankBadge}
                      </span>
                    </div>

                    <div>
                      <h4 className={`font-extrabold text-base ${style.textColor}`}>{winner.displayName}</h4>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{winner.fullName}</p>
                    </div>

                    <div className="pt-2 text-xs grid grid-cols-2 gap-1 border-t border-slate-200/60 dark:border-slate-800/60 text-slate-600 dark:text-slate-300">
                      <div>
                        <span className="block text-[10px] text-slate-400">커밋수</span>
                        <strong className="text-emerald-600">{winner.commitCount}개</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400">최초 달성</span>
                        <strong className="font-mono text-[11px]">{winner.satisfiedFormatted}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
            순위표를 불러오는 중 오류가 발생했습니다: {error.message}
          </div>
        )}

        {/* Full Ranking Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <div className="border-b border-slate-100 dark:border-slate-800 px-5 py-3.5 bg-slate-50/50 dark:bg-slate-950/50">
            <h3 className="font-semibold text-xs text-slate-700 dark:text-slate-300">전체 제출 및 순위 현황</h3>
          </div>

          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 text-slate-500 font-medium">
              <tr>
                <th className="px-4 py-3 w-20 text-center">순위</th>
                <th className="px-4 py-3">학생 / 저장소</th>
                <th className="px-4 py-3">커밋 기준 충족</th>
                <th className="px-4 py-3">README 충족</th>
                <th className="px-4 py-3">최초 달성 시각</th>
                <th className="px-4 py-3 text-right">순위 등재 여부</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {fullLeaderboard && fullLeaderboard.length > 0 ? (
                fullLeaderboard.map((item: any) => {
                  const rank = item.rank;

                  return (
                    <tr
                      key={item.id}
                      className={
                        rank === 1
                          ? "bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-50/50"
                          : rank === 2
                          ? "bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-50/70"
                          : rank === 3
                          ? "bg-amber-900/5 dark:bg-amber-950/10 hover:bg-amber-900/10"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                      }
                    >
                      <td className="px-4 py-3 text-center font-bold">
                        {rank ? (
                          <span
                            className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-extrabold ${
                              rank === 1
                                ? "bg-amber-200 text-amber-900"
                                : rank === 2
                                ? "bg-slate-200 text-slate-800"
                                : rank === 3
                                ? "bg-amber-900/20 text-amber-900"
                                : "text-slate-500"
                            }`}
                          >
                            {rank === 1 ? "🥇 1" : rank === 2 ? "🥈 2" : rank === 3 ? "🥉 3" : `${rank}위`}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.displayName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                          {item.fullName}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {minCommits > 0 ? (
                          item.commitCount >= minCommits ? (
                            <span className="text-emerald-600 font-semibold">
                              {item.commitCount} / {minCommits}개
                            </span>
                          ) : (
                            <span className="text-amber-600">
                              {item.commitCount} / {minCommits}개
                            </span>
                          )
                        ) : (
                          <span className="text-slate-600 dark:text-slate-300">{item.commitCount}개</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.readmeMet ? (
                          <span className="text-emerald-600 font-semibold">통과</span>
                        ) : (
                          <span className="text-amber-600">미충족</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {item.satisfiedFormatted ? (
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{item.satisfiedFormatted}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.isQualified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>순위 등재</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
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
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    등록된 제출 기록이 아직 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
