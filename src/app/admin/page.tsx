import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeOrgName } from "@/lib/github/app";
import { normalizeCategoryKey } from "@/lib/github/repo-parser";
import { ACTIVE_ORG_COOKIE, checkIsUserOwnerOfOrg, isValidOrgSlug } from "@/lib/org/active-org";
import { AdminAssignmentList, AdminAssignmentItemData } from "@/components/admin/admin-assignment-list";
import { CreateStudentReposPanel } from "@/components/admin/create-student-repos-panel";
import { StudentShell } from "@/components/student/student-shell";
import { TypingText } from "@/components/student/typing-text";
import { escapeLikePattern } from "@/lib/cache/cache-keys";

/** 로그인 필요 · 권한 없음 안내 (플랫 디자인) */
function AdminNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-y border-line py-12">
      <h1 className="text-[24px] font-bold tracking-tight text-fg">{title}</h1>
      <div className="space-y-4 text-[14px] text-fg-2">{children}</div>
    </section>
  );
}

const NOTICE_BTN_GREEN =
  "inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-110";
const NOTICE_BTN_GRAY =
  "inline-flex items-center gap-1.5 rounded-xl bg-chip px-4 py-2.5 text-[13px] font-semibold text-fg-2 hover:text-fg";

export default async function AdminAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string }>;
}) {
  const current = await getCurrentUser();

  if (!current) {
    // 로그인 전이면 첫 화면(GitHub로 시작하기)으로
    redirect("/");
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
  const isOwnerOfActiveOrg = await checkIsUserOwnerOfOrg(activeOrg, current.user, current.profile);
  const sidebarBase = {
    activeOrg,
    githubLogin: current.profile?.github_login,
    avatarUrl: current.profile?.avatar_url,
  };

  // If the user is NOT an Owner of the selected Organization, show guidance card
  if (!isOwnerOfActiveOrg) {
    return (
      <StudentShell sidebar={{ ...sidebarBase, isOwner: false, active: "none" }}>
        <AdminNotice title={`${activeOrg} Owner 권한이 필요해요`}>
          <p>
            이 화면은 선택한 GitHub Organization의 Owner(교수·TA) 전용 관리 공간입니다. 현재 계정{" "}
            <strong className="text-fg">@{current.profile?.github_login}</strong>은 {activeOrg}의 Owner가 아니에요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/dashboard?org=${encodeURIComponent(activeOrg)}`} className={NOTICE_BTN_GREEN}>
              {activeOrg} 학생 과제 목록으로
            </Link>
            <Link href="/dashboard" className={NOTICE_BTN_GRAY}>
              다른 Organization 선택
            </Link>
          </div>
        </AdminNotice>
      </StudentShell>
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
    // 현재 org 과제만 DB에서 조회 (다른 org 과제·학생 repo까지 읽지 않도록)
    .ilike("org_name", escapeLikePattern(activeOrg))
    .order("created_at", { ascending: false });

  // 최신 과제 카테고리 순으로 정렬
  const orgFilteredAssignments = assignments || [];

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
      deadlineAt: a.deadline_at,
      totalStudents,
      submittedStudents,
      unanalyzedStudents,
    };
  });

  const greeting = current.profile?.github_login ? `${current.profile.github_login}님, 안녕하세요.` : "안녕하세요.";
  // 사이드바 "순위표": 가장 최근 과제
  const latest = assignmentItems[0];

  return (
    <StudentShell
      sidebar={{
        ...sidebarBase,
        mode: "admin",
        isOwner: true,
        active: "admin",
        leaderboardHref: latest ? `/assignments/${latest.id}/leaderboard` : null,
      }}
    >
      <div className="space-y-14">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-chart">
              <span className="h-2 w-2 rounded-full bg-chart" aria-hidden />
              교수 · TA 전용 관리자
            </p>
            <h1 className="text-[34px] font-bold tracking-[-0.03em] text-fg sm:text-[44px]">
              <TypingText text={greeting} />
            </h1>
          </div>
          <CreateStudentReposPanel orgName={activeOrg} />
        </header>

        <AdminAssignmentList items={assignmentItems} activeOrg={activeOrg} />
      </div>
    </StudentShell>
  );
}
