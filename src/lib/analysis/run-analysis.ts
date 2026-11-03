import { supabaseAdmin } from "@/lib/supabase/admin";
import { fetchRepoSnapshot } from "@/lib/github/fetch-snapshot";
import { evaluateSnapshot, CriteriaRules } from "./evaluate";

export interface AnalysisOptions {
  forceRefresh?: boolean;
  source?: "manual" | "webhook" | "cron" | "initial" | "admin";
  bypassCooldown?: boolean;
}

export async function runRepoAnalysis(
  studentRepoId: string,
  options: AnalysisOptions = {}
) {
  const { forceRefresh = false, source = "manual" } = options;

  // 1. Fetch student_repo and assignment
  const { data: studentRepo, error: repoErr } = await supabaseAdmin
    .from("student_repos")
    .select("*, assignments(*)")
    .eq("id", studentRepoId)
    .single();

  if (repoErr || !studentRepo) {
    throw new Error(`Student repo not found: ${studentRepoId}`);
  }

  const assignment = studentRepo.assignments;
  if (!assignment) {
    throw new Error("Associated assignment not found");
  }

  // 2. Fetch repo_status for 24h cache and cooldown
  const { data: status } = await supabaseAdmin
    .from("repo_status")
    .select("*")
    .eq("student_repo_id", studentRepoId)
    .single();

  const now = new Date();

  if (!forceRefresh && status && !status.stale) {
    const fetchedAt = new Date(status.fetched_at);
    const diffHours = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60);

    // If within 24 hours and not stale, return existing evaluation
    if (diffHours < 24 && status.latest_snapshot_id) {
      const { data: existingEval } = await supabaseAdmin
        .from("evaluations")
        .select("*, snapshots(*)")
        .eq("snapshot_id", status.latest_snapshot_id)
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingEval) {
        return {
          cached: true,
          status,
          evaluation: existingEval,
          snapshot: existingEval.snapshots,
        };
      }
    }
  }

  // Check 5-minute cooldown for manual refresh
  if (forceRefresh && source === "manual" && !options.bypassCooldown && status?.manual_refresh_at) {
    const lastManual = new Date(status.manual_refresh_at);
    const diffSec = (now.getTime() - lastManual.getTime()) / 1000;
    if (diffSec < 300) {
      const remaining = Math.ceil(300 - diffSec);
      throw new Error(`새로고침 쿨다운 중입니다. ${remaining}초 후에 다시 시도해주세요.`);
    }
  }

  // 3. Fetch active criteria version
  const { data: criteria } = await supabaseAdmin
    .from("criteria_versions")
    .select("*")
    .eq("assignment_id", assignment.id)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  const rules: CriteriaRules = (criteria?.rules as CriteriaRules) || {
    branch: assignment.branch || "main",
    readme: { required: true },
  };

  const branch = rules.branch || assignment.branch || "main";
  const [owner, repo] = studentRepo.full_name.split("/");

  // 4. Fetch live data from GitHub
  const fetched = await fetchRepoSnapshot(owner, repo, branch);

  // 5. Evaluate
  const evalResult = evaluateSnapshot(
    {
      treePaths: fetched.treePaths,
      readmeContent: fetched.readmeContent,
      commitCount: fetched.commitCount,
    },
    rules
  );

  // 6. Save snapshot
  const { data: snapshot, error: snapErr } = await supabaseAdmin
    .from("snapshots")
    .insert({
      student_repo_id: studentRepoId,
      commit_sha: fetched.headSha,
      source: source,
      tree_paths: fetched.treePaths.slice(0, 5000), // Cap at 5000 paths
      readme_text: fetched.readmeContent.slice(0, 65536), // Cap at 64KB
      commit_count: fetched.commitCount,
      observed_at: now.toISOString(),
    })
    .select()
    .single();

  if (snapErr || !snapshot) {
    throw new Error(`Failed to save snapshot: ${snapErr?.message}`);
  }

  // 7. Save evaluation
  const { data: savedEvaluation, error: evalErr } = await supabaseAdmin
    .from("evaluations")
    .insert({
      snapshot_id: snapshot.id,
      criteria_version_id: criteria?.id,
      submitted: evalResult.submitted,
      file_results: evalResult.fileResults,
      readme_results: evalResult.readmeResults,
      evaluated_at: now.toISOString(),
    })
    .select()
    .single();

  if (evalErr) {
    console.error("Failed to save evaluation:", evalErr);
  }

  // 8. Save commits history
  if (fetched.commits.length > 0) {
    const commitRows = fetched.commits.map((c) => ({
      student_repo_id: studentRepoId,
      sha: c.sha,
      committed_at: c.committedAt,
      author_login: c.authorLogin,
      message: c.message.slice(0, 500),
    }));

    await supabaseAdmin
      .from("commits")
      .upsert(commitRows, { onConflict: "student_repo_id,sha" });
  }

  // 9. Update first_satisfied_at for leaderboard if condition met
  let firstSatisfiedAt = status?.first_satisfied_at;
  if (evalResult.submitted && !firstSatisfiedAt) {
    const satisfiedTime = fetched.commits && fetched.commits.length > 0
      ? fetched.commits[0].committedAt
      : now.toISOString();
    firstSatisfiedAt = satisfiedTime;
  }

  // 10. Upsert repo_status
  await supabaseAdmin
    .from("repo_status")
    .upsert(
      {
        student_repo_id: studentRepoId,
        latest_snapshot_id: snapshot.id,
        fetched_at: now.toISOString(),
        stale: false,
        last_error: null,
        first_satisfied_at: firstSatisfiedAt,
        first_satisfied_criteria_version_id: evalResult.submitted ? criteria?.id : null,
        manual_refresh_at: source === "manual" ? now.toISOString() : status?.manual_refresh_at,
        updated_at: now.toISOString(),
      },
      { onConflict: "student_repo_id" }
    );

  return {
    cached: false,
    status: {
      student_repo_id: studentRepoId,
      first_satisfied_at: firstSatisfiedAt,
    },
    evaluation: savedEvaluation || evalResult,
    snapshot,
  };
}
