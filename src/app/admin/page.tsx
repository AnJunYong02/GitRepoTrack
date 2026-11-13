import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Navbar } from "@/components/navbar";
import { getCurrentUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeOrgName } from "@/lib/github/app";
import { normalizeCategoryKey } from "@/lib/github/repo-parser";
import {
  ACTIVE_ORG_COOKIE,
  checkIsUserOwnerOfOrg,
  getAvailableOrganizations,
  isValidOrgSlug,
} from "@/lib/org/active-org";
import { OrganizationSwitcher } from "@/components/org-switcher";
import {
  AdminAssignmentList,
  AdminAssignmentItemData,
} from "@/components/admin/admin-assignment-list";
import { Shield, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
import { CreateStudentReposPanel } from "@/components/admin/create-student-repos-panel";

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string }>;
}) {
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

  const sp = searchParams ? await searchParams : undefined;
  const queryOrg = normalizeOrgName(sp?.org || "");
  const cookieStore = await cookies();
  const cookieOrg = normalizeOrgName(
    cookieStore.get(ACTIVE_ORG_COOKIE)?.value || ""
  );
  const selectedOrg = isValidOrgSlug(queryOrg)
    ? queryOrg
    : isValidOrgSlug(cookieOrg)
    ? cookieOrg
    : "";

  // If no organization has been selected yet, redirect to /dashboard (Organization Selection Page)
  if (!selectedOrg) {
    redirect("/dashboard");
  }

  const activeOrg = selectedOrg;
  const [organizations, isOwnerOfActiveOrg] = await Promise.all([
    getAvailableOrganizations(activeOrg, {
      user: current.user,
      profile: current.profile,
    }),
    checkIsUserOwnerOfOrg(activeOrg, current.user, current.profile),
  ]);

  // If the user is NOT an Owner of the selected Organization, show guidance card
  if (!isOwnerOfActiveOrg) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navbar orgName={activeOrg} assignmentTitle="권한 확인" />
        <main className="mx-auto max-w-xl px-4 py-16 space-y-6">
          <OrganizationSwitcher
            activeOrg={activeOrg}
            organizations={organizations}
            basePath="/admin"
            role="student"
          />

          <div className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-8 shadow-sm space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl font-bold">
                {activeOrg} Organization의 Owner 권한이 필요합니다
              </h1>
              <p className="text-xs text-slate-500">
                이 페이지는 선택한 GitHub Organization({activeOrg})의 Owner(교수 및 TA) 전용 관리 공간입니다.
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-950/80 p-4 text-xs text-left space-y-2 border border-slate-100 dark:border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-500">현재 로그인 계정:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">@{current.profile?.github_login}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">선택된 Organization:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{activeOrg}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">해당 조직 내 역할:</span>
                <span className="font-semibold text-amber-600">학생 / 일반 멤버 (student)</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href={`/dashboard?org=${encodeURIComponent(activeOrg)}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{activeOrg} 학생 과제 목록으로 이동</span>
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
              >
                <span>다른 Organization 선택하기</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50"
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
      <Navbar orgName={activeOrg} assignmentTitle="과제 목록" />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <Shield className="w-3.5 h-3.5" />
              <span>교수 및 TA 전용 관리자</span>
            </div>
            <h1 className="text-2xl font-bold mt-2">과제 관리 및 제출 현황</h1>
            <p className="text-xs text-slate-500">
              담당 과제의 학생 제출 현황을 확인하고, README 키워드 기준을 설정하며, 단일 ZIP 일괄 다운로드를 수행합니다.
            </p>
          </div>

          <CreateStudentReposPanel orgName={activeOrg} />
        </div>

        {/* Multi-Organization Switcher */}
        <OrganizationSwitcher
          activeOrg={activeOrg}
          organizations={organizations}
          basePath="/admin"
          role="staff"
        />

        {/* Unified Repo Search Bar & Assignments List */}
        <AdminAssignmentList items={assignmentItems} activeOrg={activeOrg} />
      </main>
    </div>
  );
}
