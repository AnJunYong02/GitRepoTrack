import { requireUser } from "@/lib/auth/guards";
import { normalizeOrgName } from "@/lib/github/app";
import { getAvailableOrganizations, isValidOrgSlug } from "@/lib/org/active-org";
import { loadStudentAssignments } from "@/lib/student/load-student-assignments";
import { leaderboardHrefFor } from "@/lib/student/student-assignments";
import { OrgSelectorView } from "@/components/org-selector-view";
import { StudentShell } from "@/components/student/student-shell";
import { StudentNoBanner } from "@/components/student/student-no-banner";
import { HomeHero } from "@/components/student/home-hero";
import { AssignmentTimeline } from "@/components/student/assignment-timeline";
import { TypingText } from "@/components/student/typing-text";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ org?: string }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const rawOrgQuery = normalizeOrgName(sp?.org || "");
  const hasExplicitOrg = isValidOrgSlug(rawOrgQuery);

  const { user, profile } = await requireUser();
  const organizations = await getAvailableOrganizations(hasExplicitOrg ? rawOrgQuery : undefined, { user, profile });
  const greeting = profile?.github_login ? `${profile.github_login}님, 안녕하세요.` : "안녕하세요.";

  // ?org= 없이 들어오면 Organization 선택 화면 (사이드바는 메뉴 없이 "선택해 주세요")
  if (!hasExplicitOrg) {
    return (
      <StudentShell
        sidebar={{ isOwner: false, githubLogin: profile?.github_login, avatarUrl: profile?.avatar_url }}
      >
        <div className="space-y-10">
          <h1 className="text-[34px] font-bold tracking-[-0.03em] text-fg sm:text-[44px]">
            <TypingText text={greeting} />
          </h1>
          <OrgSelectorView organizations={organizations} />
        </div>
      </StudentShell>
    );
  }

  const activeOrg = rawOrgQuery;
  const isOwner = organizations.some((o) => o.name.toLowerCase() === activeOrg.toLowerCase() && o.isOwner);
  const { studentNo, items, counts, current, upcoming } = await loadStudentAssignments(user, profile, activeOrg, {
    allowSync: true,
  });
  const nowMs = Date.now();

  return (
    <StudentShell
      sidebar={{
        activeOrg,
        isOwner,
        githubLogin: profile?.github_login,
        avatarUrl: profile?.avatar_url,
        studentNo,
        status: counts,
        active: "dashboard",
        leaderboardHref: leaderboardHrefFor(current),
      }}
    >
      <div className="space-y-16 lg:space-y-24">
        <h1 className="text-[34px] font-bold tracking-[-0.03em] text-fg sm:text-[44px]">
          <TypingText text={greeting} />
        </h1>

        {!studentNo ? (
          <StudentNoBanner activeOrg={activeOrg} />
        ) : current ? (
          <>
            <HomeHero item={current} nowMs={nowMs} />
            <AssignmentTimeline items={items} upcoming={upcoming} currentId={current.id} counts={counts} />
          </>
        ) : (
          <div className="border-y border-line py-12 text-center">
            <p className="text-[15px] font-semibold text-fg">
              {activeOrg}에서 학번({studentNo})과 일치하는 과제 저장소를 찾지 못했어요.
            </p>
            <p className="mt-2 text-[13px] text-fg-3">
              왼쪽 아래 <strong className="text-fg-2">최신 Repo 동기화</strong>를 누르거나, Organization을 바꿔 다시 확인해 보세요.
            </p>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
