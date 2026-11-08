import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { AssignmentLike, pickAssignmentForPrefix } from "./assignment-match";

/**
 * 같은 org에서 과제 접두사(assign10)에 해당하는 기존 과제를 찾는다.
 */
export async function findAssignmentForPrefix(
  org: string,
  prefix: string
): Promise<AssignmentLike | null> {
  const { data, error } = await supabaseAdmin
    .from("assignments")
    .select("id, title, org_name, repo_prefix, created_at")
    .ilike("org_name", org);
  if (error) throw error;
  return pickAssignmentForPrefix(data || [], org, prefix);
}

/**
 * 과제와 기본 criteria version(1)을 만든다.
 * (삭제된 "새 과제 직접 등록" API의 생성 로직을 옮겨 온 것)
 */
export async function createAssignmentWithDefaults(params: {
  org: string;
  title: string;
  deadlineAt: string;
  repoPrefix: string;
  userId: string;
  branch?: string;
  rankingMode?: "live" | "none";
}): Promise<{ id: string; title: string }> {
  const branch = params.branch || "main";
  const rankingMode = params.rankingMode || "live";

  const { data: assignment, error } = await supabaseAdmin
    .from("assignments")
    .insert({
      title: params.title,
      org_name: params.org,
      branch,
      deadline_at: params.deadlineAt,
      repo_prefix: params.repoPrefix,
      ranking_mode: rankingMode,
      ranking_started_at: rankingMode === "live" ? new Date().toISOString() : null,
      created_by: params.userId,
    })
    .select("id, title")
    .single();

  if (error || !assignment) {
    throw error || new Error("과제 생성에 실패했습니다.");
  }

  const { data: version } = await supabaseAdmin
    .from("criteria_versions")
    .insert({
      assignment_id: assignment.id,
      version: 1,
      rules: {
        branch,
        requiredFiles: [],
        readme: { required: true, headerKeywords: [] },
      },
      created_by: params.userId,
    })
    .select("id")
    .single();

  if (version) {
    await supabaseAdmin
      .from("assignments")
      .update({ current_criteria_version_id: version.id })
      .eq("id", assignment.id);
  }

  return assignment;
}
