import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { getCurrentUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeCategoryKey } from "@/lib/github/repo-parser";
import {
  getAvailableOrganizations,
  resolveActiveOrg,
} from "@/lib/org/active-org";
import { OrganizationSwitcher } from "@/components/org-switcher";
import { OrgRepoBrowser } from "@/components/admin/org-repo-browser";
import {
  AdminAssignmentList,
  AdminAssignmentItemData,
} from "@/components/admin/admin-assignment-list";
import { Plus, Shield, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const activeOrg = await resolveActiveOrg(sp?.org);
  const [current, organizations] = await Promise.all([
    getCurrentUser(),
    getAvailableOrganizations(activeOrg),
  ]);

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

  // Fetch assignments with student counts and snapshot status
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
          latest_snapshot_id,
          snapshots:latest_snapshot_id (
            commit_count
          )
        )
      )
    `)
    .order("created_at", { ascending: false });

  // Filter assignments by activeOrg (case-insensitive) and sort newest category first
  const orgFilteredAssignments = (assignments || []).filter(
    (a: any) => (a.org_name || "").toLowerCase() === activeOrg.toLowerCase()
  );

  const sortedAssignments = [...orgFilteredAssignments].sort((a: any, b: any) => {
    const keyA = normalizeCategoryKey(a.title || "");
    const keyB = normalizeCategoryKey(b.title || "");
    if (keyA !== keyB) {
      return keyB.localeCompare(keyA);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const assignmentItems: AdminAssignmentItemData[] = sortedAssignments.map((a: any) => {
    const repos = a.student_repos || [];
    const totalStudents = repos.length;
    const submittedStudents = repos.filter((sr: any) => {
      const commitCount = sr.repo_status?.snapshots?.commit_count ?? 0;
      return commitCount > 0;
    }).length;
    const unanalyzedStudents = repos.filter(
      (sr: any) => !sr.repo_status?.latest_snapshot_id
    ).length;

    return {
      id: a.id,
      title: a.title,
      orgName: a.org_name,
      branch: a.branch,
      rankingMode: a.ranking_mode === "none" ? "none" : "live",
      deadlineFormatted: new Date(a.deadline_at).toLocaleDateString("ko-KR"),
      totalStudents,
      submittedStudents,
      unanalyzedStudents,
    };
  });

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
            href={`/admin/assignments/new?org=${encodeURIComponent(activeOrg)}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            <span>새 과제 직접 등록</span>
          </Link>
        </div>

        {/* Multi-Organization Switcher */}
        <OrganizationSwitcher
          activeOrg={activeOrg}
          organizations={organizations}
          basePath="/admin"
          role="staff"
        />

        {/* 1. Organization Repos Browser & Categorizer */}
        <OrgRepoBrowser activeOrg={activeOrg} />

        {/* 2. Registered Assignments List with Google Drive Style Layout Toggle */}
        <AdminAssignmentList items={assignmentItems} />
      </main>
    </div>
  );
}
