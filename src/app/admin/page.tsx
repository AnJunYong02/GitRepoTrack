import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getCurrentUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { OrgRepoBrowser } from "@/components/admin/org-repo-browser";
import { Plus, Shield, ArrowRight, Users, ShieldAlert, ArrowLeft, RefreshCw, Trophy } from "lucide-react";

export default async function AdminAssignmentsPage() {
  const current = await getCurrentUser();

  if (!current) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <main className="mx-auto max-w-lg px-4 py-20 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-600">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold">로그인이 필요합니다</h1>
          <p className="text-xs text-slate-500">관리자 페이지에 접근하려면 먼저 GitHub로 로그인해주세요.</p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
          >
            로그인하기
          </Link>
        </main>
      </div>
    );
  }

  // If not staff, show clean guidance card instead of crashing
  if (current.profile?.role !== "staff") {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar />
        <main className="mx-auto max-w-xl px-4 py-16 space-y-6">
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-8 shadow-sm space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold">관리자(Staff) 권한이 필요합니다</h1>
              <p className="text-xs text-slate-500">
                이 페이지는 GitHub Organization의 Owner(교수 및 TA) 전용 공간입니다.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/80 p-4 text-xs text-left space-y-2 border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">현재 로그인 계정:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">@{current.profile?.github_login}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">현재 부여된 역할:</span>
                <span className="font-semibold text-amber-600">학생 (student)</span>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4 text-xs text-left space-y-2 border border-blue-100 dark:border-blue-900/40 text-blue-900 dark:text-blue-300">
              <p className="font-semibold">💡 Organization Owner인데도 이 화면이 보인다면?</p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-blue-800 dark:text-blue-400">
                <li>GitHub App 설정(Settings &gt; Developer settings &gt; GitHub Apps)으로 이동합니다.</li>
                <li>좌측 <strong>General</strong> 탭 맨 아래 <strong>&quot;Where can this GitHub App be installed?&quot;</strong>를 <strong>&quot;Any account&quot;</strong>로 변경하고 저장합니다.</li>
                <li>좌측 <strong>Install App</strong> 탭에서 <strong>조직 옆의 [Install]</strong> 버튼을 눌러 조직에 앱을 설치합니다.</li>
                <li>앱 설치 완료 후 아래 버튼을 눌러 다시 로그인하시면 즉시 관리자 권한이 부여됩니다.</li>
              </ol>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>내 과제 대시보드로 이동</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                <RefreshCw className="w-4 h-4" />
                <span>권한 재확인 (다시 로그인)</span>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Fetch assignments with student counts
  const { data: assignments } = await supabaseAdmin
    .from("assignments")
    .select(`
      id,
      title,
      org_name,
      branch,
      deadline_at,
      ranking_mode,
      created_at,
      student_repos (
        id,
        repo_status (
          snapshots:latest_snapshot_id (
            evaluations (
              submitted
            )
          )
        )
      )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Shield className="w-3.5 h-3.5" />
              <span>교수 및 TA 전용 관리자</span>
            </div>
            <h1 className="text-2xl font-bold mt-2">과제 관리 및 제출 현황</h1>
            <p className="text-xs text-slate-500">
              담당 과제의 학생 제출 현황을 확인하고, README 대제목 기준을 설정하며, 단일 ZIP 일괄 다운로드를 수행합니다.
            </p>
          </div>

          <Link
            href="/admin/assignments/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            <span>새 과제 직접 등록</span>
          </Link>
        </div>

        {/* 1. Organization 275 Repos Browser & Categorizer */}
        <OrgRepoBrowser />

        {/* 2. Registered Assignments List */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">등록된 과제 목록</h2>
            <span className="text-xs text-slate-500">총 {assignments?.length || 0}개 과제 운영 중</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assignments && assignments.length > 0 ? (
            assignments.map((a: any) => {
              const totalStudents = a.student_repos?.length || 0;
              const submittedStudents =
                a.student_repos?.filter((sr: any) => {
                  const evals = sr.repo_status?.snapshots?.evaluations;
                  const latestEval = Array.isArray(evals) ? evals[0] : evals;
                  return latestEval?.submitted === true;
                }).length || 0;

              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 hover:border-indigo-400 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base">{a.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Org: {a.org_name} · Branch: {a.branch}</p>
                    </div>
                    <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      {a.ranking_mode === "live" ? "순위표 활성" : "일반 과제"}
                    </span>
                  </div>

                  {/* Submission Progress */}
                  <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1 text-slate-500">
                        <Users className="w-3.5 h-3.5" />
                        제출율
                      </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        <strong>{submittedStudents}</strong> / {totalStudents}명 ({totalStudents ? Math.round((submittedStudents / totalStudents) * 100) : 0}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${totalStudents ? (submittedStudents / totalStudents) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-400">
                      마감: {new Date(a.deadline_at).toLocaleDateString("ko-KR")}
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/assignments/${a.id}/leaderboard`}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2.5 py-1.5 text-xs font-semibold hover:bg-amber-100 transition"
                      >
                        <Trophy className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>순위표</span>
                      </Link>

                      <Link
                        href={`/admin/assignments/${a.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 text-xs font-semibold hover:bg-indigo-100 transition"
                      >
                        <span>현황 관리</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center text-slate-400 text-sm">
              등록된 과제가 없습니다. 우측 상단의 &quot;새 과제 직접 등록&quot; 버튼을 누르거나 위에서 Organization 과제를 일괄 등록하세요.
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
