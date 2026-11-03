import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { requireUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveStudentNo, syncReposForStudent } from "@/lib/student/sync-student-repos";
import { parseRepoName } from "@/lib/github/repo-parser";
import { StudentNoBanner } from "@/components/student/student-no-banner";
import {
  FolderGit2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Trophy,
  Shield,
  ExternalLink,
  GitCommit,
  FileText,
} from "lucide-react";

const SELECT_STUDENT_REPOS = `
  id,
  full_name,
  repo_id,
  student_no,
  profile_id,
  assignments (
    id,
    title,
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

export default async function DashboardPage() {
  const { user, profile } = await requireUser();

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

  // If studentNo is known but no repos were found in DB yet, scan Organization once automatically
  if (studentNo && (!studentRepos || studentRepos.length === 0)) {
    await syncReposForStudent(user.id, profile?.github_id, studentNo, {
      scanOrgRepos: true,
    });
    const refetched = await supabaseAdmin
      .from("student_repos")
      .select(SELECT_STUDENT_REPOS)
      .or(orFilters.join(","))
      .order("created_at", { ascending: false });
    studentRepos = refetched.data;
  }

  // Auto-bind profile_id for any matched student_repos that haven't bound profile_id yet
  if (studentRepos && studentRepos.length > 0) {
    const unboundIds = studentRepos
      .filter((r: any) => r.profile_id !== user.id)
      .map((r: any) => r.id);
    if (unboundIds.length > 0) {
      await supabaseAdmin
        .from("student_repos")
        .update({ profile_id: user.id })
        .in("id", unboundIds);
    }
  }

  // Sort newest assignment first using normalized category key (e.g. assign09 -> assign08_midterm -> ... -> assign02 -> assign01)
  const sortedRepos = [...(studentRepos || [])].sort((a: any, b: any) => {
    const repoNameA = (a.full_name || "").split("/").pop() || a.full_name || "";
    const repoNameB = (b.full_name || "").split("/").pop() || b.full_name || "";
    const parsedA = parseRepoName({ id: a.repo_id || 0, name: repoNameA, full_name: a.full_name || "" });
    const parsedB = parseRepoName({ id: b.repo_id || 0, name: repoNameB, full_name: b.full_name || "" });
    return parsedB.category.localeCompare(parsedA.category);
  });

  const nowMs = Date.now();

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
              href="/admin"
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

        {/* Student Number Binding & Org Repo Sync Banner */}
        <StudentNoBanner initialStudentNo={studentNo} repoCount={sortedRepos.length} />

        {sortedRepos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sortedRepos.map((sr: any) => {
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

              const isStale = status?.stale;

              return (
                <div
                  key={sr.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 hover:border-blue-400 transition flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-base">{assignment?.title || "과제"}</h3>
                        <a
                          href={`https://github.com/${sr.full_name}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline mt-1 break-all"
                        >
                          <FolderGit2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{sr.full_name}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                        </a>
                      </div>

                      {/* Top Status Badge */}
                      {!hasSnapshot ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                          <Clock className="w-3.5 h-3.5" />
                          <span>분석 전</span>
                        </span>
                      ) : isSubmitted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 ring-1 ring-emerald-600/20 px-2.5 py-0.5 text-xs font-semibold shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isLateSubmission ? "제출 충족 (지각)" : "제출 충족"}</span>
                        </span>
                      ) : !hasPushed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 ring-1 ring-red-600/20 px-2.5 py-0.5 text-xs font-semibold shrink-0">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>미제출 (커밋 없음)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 ring-1 ring-amber-600/20 px-2.5 py-0.5 text-xs font-semibold shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{unmetReasons.join(" · ") || "조건 미충족"}</span>
                        </span>
                      )}
                    </div>

                    {/* Detailed Condition Breakdown Box */}
                    <div className="rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 p-3 space-y-2 text-xs">
                      {/* 1. Commit Condition */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <GitCommit className="w-3.5 h-3.5" />
                          <span>커밋(Commit) 조건</span>
                        </span>
                        {!hasSnapshot ? (
                          <span className="text-slate-400 font-medium">
                            분석 필요 {minCommits > 0 ? `(기준 ${minCommits}개)` : ""}
                          </span>
                        ) : isCommitsSatisfied ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ✓ 충족 ({minCommits > 0 ? `${commitCount}/${minCommits}개` : `${commitCount}개`})
                          </span>
                        ) : !hasPushed ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            ✕ 0개 ({minCommits > 0 ? `기준 ${minCommits}개 부족` : "Push된 커밋 없음"})
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            ⚠ 커밋 {commitShortfall}개 부족 ({commitCount}/{minCommits}개)
                          </span>
                        )}
                      </div>

                      {/* 2. README Keyword Condition */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-500">
                          <FileText className="w-3.5 h-3.5" />
                          <span>README 키워드 조건</span>
                        </span>
                        {!hasSnapshot ? (
                          <span className="text-slate-400 font-medium">
                            분석 필요 {totalKeywords > 0 ? `(기준 ${totalKeywords}개)` : ""}
                          </span>
                        ) : totalKeywords > 0 ? (
                          isReadmeSatisfied ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓ 통과 ({passedKeywordsCount}/{totalKeywords}개)
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              ⚠ 키워드 {missingKeywordsCount}개 부족 ({passedKeywordsCount}/{totalKeywords}개 통과)
                            </span>
                          )
                        ) : isReadmeSatisfied ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            ✓ README 확인됨
                          </span>
                        ) : (
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            ⚠ README.md 파일 누락
                          </span>
                        )}
                      </div>

                      {/* 3. Deadline / Late Status */}
                      {deadline && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800">
                          <span className="inline-flex items-center gap-1.5 text-slate-500">
                            <Clock className="w-3.5 h-3.5" />
                            <span>마감: {deadline.toLocaleString("ko-KR")}</span>
                          </span>
                          {hasPushed ? (
                            isLateSubmission ? (
                              <span className="inline-flex items-center rounded bg-red-100 dark:bg-red-950/80 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                                ⏰ 지각 제출
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded bg-emerald-100 dark:bg-emerald-950/80 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                ✓ 기한 내 제출
                              </span>
                            )
                          ) : isPastDeadlineUnpushed ? (
                            <span className="inline-flex items-center rounded bg-red-100 dark:bg-red-950/80 px-1.5 py-0.5 text-[11px] font-bold text-red-700 dark:text-red-300">
                              ⏰ 기한 경과 (미제출)
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              진행 중 (마감 전)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {isStale && (
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        ⚠️ 최신 push가 감지되었거나 아직 분석 전입니다. [분석 대시보드]에서 분석을 실행하세요.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                    {assignment?.ranking_mode === "live" ? (
                      <Link
                        href={`/assignments/${assignment.id}/leaderboard`}
                        className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>순위표 확인</span>
                      </Link>
                    ) : (
                      <div />
                    )}

                    <Link
                      href={`/dashboard/${sr.id}`}
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                    >
                      <span>분석 대시보드</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-500">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {studentNo
                ? `학번(${studentNo})과 일치하는 과제 저장소를 찾지 못했습니다.`
                : "위 입력창에 본인의 학번(예: 22300743)을 입력하여 과제 저장소를 불러오세요."}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              학번을 입력하면 Organization 내 <code className="font-mono">assignXX-c01-학번</code> 형식의 모든 저장소가 자동으로 연동됩니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
