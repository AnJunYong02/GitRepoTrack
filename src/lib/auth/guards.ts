import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

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

export async function requireStaff() {
  const { user, profile } = await requireUser();
  if (profile?.role !== "staff") {
    throw new Error("Forbidden: Staff privileges required");
  }
  return { user, profile };
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
  const isStaff = profile?.role === "staff";

  if (!isOwner && !isStaff) {
    throw new Error("Forbidden: You cannot access another student's repository");
  }

  // Auto-link profile_id if matched by student_no
  if (isMatchedByStudentNo && repo.profile_id !== user.id) {
    await supabaseAdmin
      .from("student_repos")
      .update({ profile_id: user.id, student_no: userStudentNo })
      .eq("id", repo.id);
  }

  return { user, profile, repo, isStaff };
}
