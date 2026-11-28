import "server-only";

import type {
  AssignmentPreset,
  CreationSettings,
  PlannedStudent,
} from "./creation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { escapeLikePattern } from "@/lib/cache/cache-keys";

export interface CreationPlan {
  assignment_id: string;
  created_by: string;
  org_name: string;
  settings: CreationSettings;
  students: PlannedStudent[];
  files: { path: string; sha256: string }[];
  created_at: string;
}

export class CreationError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function loadCreationPlan(
  id: string,
): Promise<CreationPlan | null> {
  const { data, error } = await supabaseAdmin
    .from("assignment_creation_plans")
    .select("*")
    .eq("assignment_id", id)
    .maybeSingle();
  if (error) throw error;
  return data as CreationPlan | null;
}

export async function loadAssignmentPresets(
  org: string,
): Promise<AssignmentPreset[]> {
  const { data: assignments, error } = await supabaseAdmin
    .from("assignments")
    .select(
      "id, title, deadline_at, repo_prefix, current_criteria_version_id, student_repos(student_no)",
    )
    .ilike("org_name", escapeLikePattern(org))
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!assignments.length) return [];
  const versionIds = assignments
    .map((item) => item.current_criteria_version_id)
    .filter(Boolean);
  const [versions, plans] = await Promise.all([
    versionIds.length
      ? supabaseAdmin
          .from("criteria_versions")
          .select("id, rules")
          .in("id", versionIds)
      : Promise.resolve({ data: [], error: null }),
    supabaseAdmin
      .from("assignment_creation_plans")
      .select("assignment_id, settings, students")
      .in(
        "assignment_id",
        assignments.map((item) => item.id),
      ),
  ]);
  if (versions.error) throw versions.error;
  // Old databases can still list older settings before the new migration is installed.
  if (plans.error && !["PGRST205", "42P01"].includes(plans.error.code))
    throw plans.error;
  const rulesById = new Map(
    (versions.data ?? []).map((version) => [version.id, version.rules]),
  );
  const planById = new Map(
    (plans.data ?? []).map((plan) => [plan.assignment_id, plan]),
  );
  return assignments.map((assignment) => {
    const rules = rulesById.get(assignment.current_criteria_version_id) ?? {};
    const plan = planById.get(assignment.id);
    const saved = plan?.settings as CreationSettings | undefined;
    const prefix = assignment.repo_prefix ?? "";
    const classMatch = prefix.match(/-(c[0-9]{2})$/i);
    const coursePrefix = `${org}-`;
    const base = classMatch ? prefix.slice(0, -classMatch[0].length) : prefix;
    const keywords = rules.readme?.headerKeywords ?? rules.readmeKeywords ?? [];
    return {
      id: assignment.id,
      studentNos: plan
        ? (plan.students as PlannedStudent[]).map(
            (student) => student.studentNo,
          )
        : assignment.student_repos
            .map((student) => student.student_no)
            .filter((value): value is string => typeof value === "string"),
      repoConvention: saved?.repoConvention,
      repoBase:
        saved?.repoBase ??
        (base.toLowerCase().startsWith(coursePrefix.toLowerCase())
          ? base.slice(coursePrefix.length)
          : base),
      classCode: saved?.classCode ?? classMatch?.[1]?.toLowerCase() ?? "c01",
      title: assignment.title,
      deadlineAt: assignment.deadline_at,
      keywords: Array.isArray(keywords)
        ? keywords.filter((word): word is string => typeof word === "string")
        : [],
      minCommits: typeof rules.minCommits === "number" ? rules.minCommits : 0,
      readmeRequired: rules.readme?.required !== false,
    };
  });
}
