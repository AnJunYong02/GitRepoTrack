import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkIsUserOwnerOfOrg } from "@/lib/org/active-org";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) {
    throw new Error("Unauthorized: Login required");
  }
  return current;
}

/**
 * 선택한 org의 Owner만 통과시킨다. 권한은 계정 전체가 아니라 org마다 따로 판단한다.
 */
export async function requireOrgOwner(orgName: string) {
  const { user, profile } = await requireUser();
  const isOwner = await checkIsUserOwnerOfOrg(orgName, user, profile);
  if (!isOwner) {
    throw new Error("Forbidden: Owner of this organization required");
  }
  return { user, profile };
}

/**
 * 과제가 속한 org의 Owner만 통과시킨다. 과제가 없으면 Not found 에러.
 */
export async function requireAssignmentOwner(assignmentId: string) {
  const { data: assignment, error } = await supabaseAdmin
    .from("assignments")
    .select("*")
    .eq("id", assignmentId)
    .maybeSingle();
  if (error || !assignment) {
    throw new Error("Not found: Assignment not found");
  }
  const { user, profile } = await requireOrgOwner(assignment.org_name || "");
  return { user, profile, assignment };
}

/** 학생 repo가 속한 org 이름 (과제의 org_name, 없으면 full_name의 owner) */
function getRepoOrgName(repo: any): string {
  return repo?.assignments?.org_name || String(repo?.full_name || "").split("/")[0] || "";
}

/**
 * Checks if the user is authorized to access a specific student repository.
 * Either the student owns this repository, or the user is staff.
 */
export async function requireStudentRepo(studentRepoId: string) {
  const { user, profile } = await requireUser();

  const { data: repo, error } = await supabaseAdmin
    .from("student_repos")
    .select("*, assignments(*)")
    .eq("id", studentRepoId)
    .single();

  if (error || !repo) {
    throw new Error("Repository mapping not found");
  }

  const userStudentNo = user.user_metadata?.student_no?.trim();
  const isMatchedByStudentNo =
    Boolean(userStudentNo) &&
    (repo.student_no === userStudentNo ||
      repo.full_name?.endsWith(`-${userStudentNo}`) ||
      repo.full_name?.endsWith(`_${userStudentNo}`));

  const isOwner =
    repo.profile_id === user.id ||
    repo.github_id === profile?.github_id ||
    isMatchedByStudentNo;
  // 본인 repo가 아니면 그 repo가 속한 org의 Owner일 때만 허용
  const isOrgOwner = await checkIsUserOwnerOfOrg(getRepoOrgName(repo), user, profile);

  if (!isOwner && !isOrgOwner) {
    throw new Error("Forbidden: You cannot access another student's repository");
  }

  // Auto-link profile_id if matched by student_no
  if (isMatchedByStudentNo && repo.profile_id !== user.id) {
    await supabaseAdmin
      .from("student_repos")
      .update({ profile_id: user.id, student_no: userStudentNo })
      .eq("id", repo.id);
  }

  return { user, profile, repo, isOrgOwner };
}

/** 가드가 던진 에러를 HTTP 상태 코드로 변환 */
export function guardErrorStatus(error: any): number {
  const message = String(error?.message || "");
  if (message.startsWith("Unauthorized")) return 401;
  if (message.startsWith("Forbidden")) return 403;
  if (message.startsWith("Not found")) return 404;
  return 500;
}
