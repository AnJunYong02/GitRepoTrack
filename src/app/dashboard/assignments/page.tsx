import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { normalizeOrgName } from "@/lib/github/app";
import { getAvailableOrganizations, isValidOrgSlug } from "@/lib/org/active-org";
import { loadStudentAssignments } from "@/lib/student/load-student-assignments";
import { leaderboardHrefFor } from "@/lib/student/student-assignments";
import { StudentShell } from "@/components/student/student-shell";
import { StudentNoBanner } from "@/components/student/student-no-banner";
import { MyAssignmentsView } from "@/components/student/my-assignments-view";

/** 내 과제: 주차별 과제 목록 (탭 · 검색 · 정렬) */
export default async function MyAssignmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const activeOrg = normalizeOrgName(sp?.org || "");
  // org가 없으면 Organization 선택 화면으로
  if (!isValidOrgSlug(activeOrg)) redirect("/dashboard");

  const { user, profile } = await requireUser();
  const [organizations, data] = await Promise.all([
    getAvailableOrganizations(activeOrg, { user, profile }),
    loadStudentAssignments(user, profile, activeOrg, { allowSync: true }),
  ]);
  const isOwner = organizations.some((o) => o.name.toLowerCase() === activeOrg.toLowerCase() && o.isOwner);

  return (
    <StudentShell
      sidebar={{
        activeOrg,
        isOwner,
        githubLogin: profile?.github_login,
        avatarUrl: profile?.avatar_url,
        studentNo: data.studentNo,
        status: data.counts,
        active: "assignments",
        leaderboardHref: leaderboardHrefFor(data.current),
      }}
    >
      <h1 className="sr-only">내 과제</h1>
      {!data.studentNo ? (
        <StudentNoBanner activeOrg={activeOrg} />
      ) : (
        <MyAssignmentsView items={data.items} counts={data.counts} currentId={data.current?.id ?? null} nowMs={Date.now()} />
      )}
    </StudentShell>
  );
}
