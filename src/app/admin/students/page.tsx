import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeOrgName } from "@/lib/github/app";
import { ACTIVE_ORG_COOKIE, checkIsUserOwnerOfOrg, isValidOrgSlug } from "@/lib/org/active-org";
import { escapeLikePattern } from "@/lib/cache/cache-keys";
import { loadOrgRoster } from "@/lib/roster/org-roster";
import { StudentShell } from "@/components/student/student-shell";
import { StudentRosterManager } from "@/components/admin/student-roster-manager";

/** 관리자 "학생 관리": org별 학생 명단(학번·이름·GitHub ID) CSV 업로드 + 목록 */
export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string }>;
}) {
  const current = await getCurrentUser();
  if (!current) redirect("/");

  // org 결정: ?org= → 쿠키 → 없으면 org 선택 화면 (과제 관리 화면과 같은 규칙)
  const sp = searchParams ? await searchParams : undefined;
  const queryOrg = normalizeOrgName(sp?.org || "");
  const cookieOrg = normalizeOrgName((await cookies()).get(ACTIVE_ORG_COOKIE)?.value || "");
  const activeOrg = isValidOrgSlug(queryOrg) ? queryOrg : isValidOrgSlug(cookieOrg) ? cookieOrg : "";
  if (!activeOrg) redirect("/dashboard");

  const sidebarBase = {
    activeOrg,
    githubLogin: current.profile?.github_login,
    avatarUrl: current.profile?.avatar_url,
  };

  const isOwner = await checkIsUserOwnerOfOrg(activeOrg, current.user, current.profile);
  if (!isOwner) {
    return (
      <StudentShell sidebar={{ ...sidebarBase, isOwner: false, active: "none" }}>
        <section className="space-y-4 border-y border-line py-12">
          <h1 className="text-[24px] font-bold tracking-tight text-fg">{activeOrg} Owner 권한이 필요해요</h1>
          <p className="text-[14px] text-fg-2">학생 명단은 이 GitHub Organization의 Owner(교수·TA)만 볼 수 있어요.</p>
          <Link
            href={`/dashboard?org=${encodeURIComponent(activeOrg)}`}
            className="inline-flex rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white hover:brightness-110"
          >
            내 과제 대시보드로
          </Link>
        </section>
      </StudentShell>
    );
  }

  // Owner 확인 후에만 명단을 읽는다
  const [students, latestAssignment] = await Promise.all([
    loadOrgRoster(activeOrg),
    supabaseAdmin
      .from("assignments")
      .select("id")
      .ilike("org_name", escapeLikePattern(activeOrg))
      .order("deadline_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((r) => r.data),
  ]);

  return (
    <StudentShell
      sidebar={{
        ...sidebarBase,
        mode: "admin",
        isOwner: true,
        active: "students",
        leaderboardHref: latestAssignment ? `/assignments/${latestAssignment.id}/leaderboard` : null,
      }}
    >
      {/* 화면에 필요한 값만 클라이언트로 보낸다 (이메일 등은 제외) */}
      <StudentRosterManager
        org={activeOrg}
        students={students.map((s) => ({
          studentNo: s.studentNo,
          name: s.name,
          githubLogin: s.githubLogin,
          updatedAt: s.updatedAt,
        }))}
      />
    </StudentShell>
  );
}
