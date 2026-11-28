import Link from "next/link";
import { redirect } from "next/navigation";
import { guardErrorStatus, requireOrgOwner } from "@/lib/auth/guards";
import { normalizeOrgName } from "@/lib/github/app";
import { isValidOrgSlug } from "@/lib/org/active-org";
import { loadOrgRoster } from "@/lib/roster/org-roster";
import { loadAssignmentPresets } from "@/lib/assignments/creation-plan";
import { AssignmentCreationForm } from "@/components/admin/assignment-creation-form";
import { StudentShell } from "@/components/student/student-shell";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const query = await searchParams;
  const org = normalizeOrgName(typeof query.org === "string" ? query.org : "");
  if (!isValidOrgSlug(org)) redirect("/dashboard");
  const current = await requireOrgOwner(org).catch((error) => {
    if (guardErrorStatus(error) === 401) redirect("/");
    if (guardErrorStatus(error) === 403)
      redirect(`/admin?org=${encodeURIComponent(org)}`);
    throw error;
  });
  const { profile } = current;
  const [roster, presets] = await Promise.all([
    loadOrgRoster(org),
    loadAssignmentPresets(org),
  ]);
  return (
    <StudentShell
      sidebar={{
        activeOrg: org,
        githubLogin: profile?.github_login,
        avatarUrl: profile?.avatar_url,
        isOwner: true,
        active: "none",
        mode: "admin",
      }}
    >
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-2">
          <Link
            href={`/admin?org=${encodeURIComponent(org)}`}
            className="text-[13px] text-fg-3 hover:text-fg"
          >
            ← 과제 목록
          </Link>
          <h1 className="text-[34px] font-bold tracking-[-0.03em] text-fg">
            과제 생성
          </h1>
          <p className="text-[14px] text-fg-3">{org}</p>
        </div>
        <AssignmentCreationForm
          key={org}
          org={org}
          initialStudents={roster.map(({ studentNo, name, githubLogin }) => ({
            studentNo,
            name,
            githubLogin,
          }))}
          presets={presets}
        />
      </div>
    </StudentShell>
  );
}
