import { Navbar } from "@/components/navbar";
import { getCurrentUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { CriteriaForm } from "@/components/admin/criteria-form";
import { AddRepoForm } from "@/components/admin/add-repo-form";
import { BatchAnalyzeButton } from "@/components/admin/batch-analyze-button";
import {
  Download,
  Users,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ExternalLink,
  Trophy,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default async function AdminAssignmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: assignmentId } = await params;
  const current = await getCurrentUser();

  if (!current || current.profile?.role !== "staff") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <main className="mx-auto max-w-lg px-4 py-20 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold">관리자(Staff) 권한이 필요합니다</h1>
          <p className="text-xs text-slate-500">과제 상세 관리 및 ZIP 다운로드는 관리자만 접근할 수 있습니다.</p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>내 과제 대시보드로</span>
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <div className="p-8 text-center text-sm">과제를 찾을 수 없습니다.</div>
      </div>
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

  const total = studentRepos?.length || 0;
  const unanalyzedCount =
    studentRepos?.filter((sr: any) => !sr.repo_status?.latest_snapshot_id).length || 0;
  const submittedCount =
    studentRepos?.filter((sr: any) => {
      const snapshot = sr.repo_status?.snapshots;
      const count = snapshot?.commit_count ?? (sr.commits?.length ? sr.commits.length : 0);
      return count > 0;
    }).length || 0;
  const analyzedUnsubmittedCount = Math.max(0, total - submittedCount - unanalyzedCount);

  // Find active criteria version rules
  const activeVersion = assignment.criteria_versions?.find(
    (cv: any) => cv.id === assignment.current_criteria_version_id
  );
  const minCommits = activeVersion?.rules?.minCommits || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>뒤로가기 (과제 관리 목록)</span>
          </Link>
        </div>

        {/* Top Header & Actions */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="rounded bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                Org: {assignment.org_name} · 기준: {assignment.branch}
              </span>
              <h1 className="text-2xl font-bold mt-2">{assignment.title}</h1>
              <p className="text-xs text-slate-500 mt-1">
                마감일시: {new Date(assignment.deadline_at).toLocaleString("ko-KR")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/assignments/${assignment.id}/leaderboard`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 px-4 py-2.5 text-xs font-semibold text-amber-800 dark:text-amber-200 shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/60 transition"
              >
                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>실시간 순위표 보기</span>
              </Link>

              {/* ZIP 일괄 다운로드 버튼 (학교 서버 단일 스트리밍) */}
              <a
                href={`/api/admin/assignments/${assignment.id}/archive`}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-500 transition"
                download
              >
                <Download className="w-4 h-4" />
                <span>전체 Repo ZIP 일괄 다운로드 (.zip)</span>
              </a>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex flex-wrap items-center gap-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-xs">
            <div className="flex items-center gap-1.5 font-medium">
              <Users className="w-4 h-4 text-slate-400" />
              <span>배정 학생: <strong>{total}명</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>제출 완료: <strong>{submittedCount}명</strong></span>
            </div>
            <div className="flex items-center gap-1.5 font-medium text-red-500">
              <XCircle className="w-4 h-4" />
              <span>미제출: <strong>{analyzedUnsubmittedCount}명</strong></span>
            </div>
            {unanalyzedCount > 0 && (
              <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <Clock className="w-4 h-4" />
                <span>분석 대기(미분석): <strong>{unanalyzedCount}명</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* Criteria & Header Keywords Setting Form */}
        <CriteriaForm
          assignmentId={assignment.id}
          initialRules={activeVersion?.rules}
        />

        {/* Student Submission Status Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden space-y-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-base">학생별 제출 및 분석 현황</h2>
              <span className="text-xs text-slate-500">총 {total}명 등록됨</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BatchAnalyzeButton
                assignmentId={assignment.id}
                totalCount={total}
                unanalyzedCount={unanalyzedCount}
              />
              <AddRepoForm assignmentId={assignment.id} orgName={assignment.org_name} />
            </div>
          </div>

          {/* Unanalyzed Repos Callout Banner */}
          {unanalyzedCount > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-blue-200 dark:border-blue-900/70 bg-gradient-to-r from-blue-50/90 to-indigo-50/70 dark:from-blue-950/40 dark:to-indigo-950/30 p-4 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-blue-950 dark:text-blue-200">
                    아직 분석되지 않은 학생 저장소가 {unanalyzedCount}개 있습니다!
                  </p>
                  <p className="text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
                    처음 과제를 등록했거나 최신 제출 결과를 확인하려면 우측 상단의{" "}
                    <strong className="underline decoration-blue-500/60 underline-offset-2">
                      [▶ 분석하기]
                    </strong>{" "}
                    버튼을 먼저 눌러주세요. 분석이 완료되면 실제 제출 여부, 커밋 수, README 키워드 통과 현황이 즉시 반영됩니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-slate-500 font-medium">
                <tr>
                  <th className="px-3 py-2.5">학번</th>
                  <th className="px-3 py-2.5">이름</th>
                  <th className="px-3 py-2.5">REpository</th>
                  <th className="px-3 py-2.5">제출 여부</th>
                  <th className="px-3 py-2.5">commit갯수</th>
                  <th className="px-3 py-2.5">README 충족 여부</th>
                  <th className="px-3 py-2.5">마지막 PUSH 시간</th>
                  <th className="px-3 py-2.5 text-right">상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentRepos && studentRepos.length > 0 ? (
                  studentRepos.map((sr: any) => {
                    const status = sr.repo_status;
                    const snapshot = status?.snapshots;
                    const hasSnapshot = Boolean(status?.latest_snapshot_id && snapshot);
                    const evals = snapshot?.evaluations;
                    const latestEval = Array.isArray(evals) ? evals[0] : evals;
                    const readmeResults = latestEval?.readme_results;
                    const details = readmeResults?.details || [];
                    const activeKeywords =
                      activeVersion?.rules?.readme?.headerKeywords ||
                      activeVersion?.rules?.readmeKeywords ||
                      [];
                    const totalKeywords =
                      details.length > 0 ? details.length : activeKeywords.length;
                    const passedCount =
                      details.length > 0
                        ? details.filter((d: any) => d.found).length
                        : readmeResults?.satisfied
                        ? totalKeywords
                        : 0;
                    const commitCount =
                      snapshot?.commit_count ??
                      (sr.commits?.length ? sr.commits.length : 0);

                    // Find latest commit push time (only from actual commits, not initial status creation)
                    let lastPushTime = "-";
                    if (sr.commits && sr.commits.length > 0) {
                      const sorted = [...sr.commits].sort(
                        (a: any, b: any) =>
                          new Date(b.committed_at).getTime() -
                          new Date(a.committed_at).getTime()
                      );
                      const latestDate = new Date(sorted[0].committed_at);
                      lastPushTime = latestDate.toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });
                    } else if (hasSnapshot && commitCount > 0 && snapshot?.observed_at) {
                      lastPushTime = new Date(snapshot.observed_at).toLocaleString("ko-KR", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      });
                    }

                    return (
                      <tr key={sr.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2.5 font-medium">{sr.student_no || "-"}</td>
                        <td className="px-3 py-2.5">{sr.student_name || "-"}</td>
                        <td className="px-3 py-2.5">
                          <a
                            href={`https://github.com/${sr.full_name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-mono text-[11px] group transition-colors"
                          >
                            <span className="group-hover:underline">{sr.full_name}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 shrink-0" />
                          </a>
                        </td>
                        <td className="px-3 py-2.5">
                          {commitCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>제출</span>
                            </span>
                          ) : !hasSnapshot ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20">
                              <Clock className="w-3 h-3" />
                              <span>분석 대기</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>미제출</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-medium">
                          {!hasSnapshot && commitCount === 0 ? (
                            <span className="text-slate-400">-</span>
                          ) : minCommits > 0 ? (
                            commitCount >= minCommits ? (
                              <span className="text-emerald-600 font-semibold">
                                {commitCount} / {minCommits}개
                              </span>
                            ) : commitCount > 0 ? (
                              <span className="text-amber-600 font-medium">
                                {commitCount} / {minCommits}개
                              </span>
                            ) : (
                              <span className="text-slate-400">0 / {minCommits}개</span>
                            )
                          ) : commitCount > 0 ? (
                            <span className="text-slate-700 dark:text-slate-300">
                              {commitCount}개
                            </span>
                          ) : (
                            <span className="text-slate-400">0개</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {!hasSnapshot || commitCount === 0 || totalKeywords === 0 ? (
                            <span className="text-slate-400">-</span>
                          ) : passedCount === totalKeywords ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <span>{passedCount}/{totalKeywords}개 통과</span>
                            </span>
                          ) : passedCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                              <span>{passedCount}/{totalKeywords}개 통과</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 font-medium">
                              <span>0/{totalKeywords}개 통과</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-400 font-mono text-[11px]">{lastPushTime}</td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            href={`/dashboard/${sr.id}`}
                            className="text-blue-600 hover:underline font-semibold"
                          >
                            보기
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      매핑된 학생 repo가 아직 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
