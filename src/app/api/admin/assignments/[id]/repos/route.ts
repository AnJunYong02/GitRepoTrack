import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeOrgName, getInstallationOctokit } from "@/lib/github/app";

/**
 * GET: Lists repositories in the assignment's organization to easily pick/import.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id: assignmentId } = await params;

    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("assignments")
      .select("id, org_name")
      .eq("id", assignmentId)
      .single();

    if (aErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const orgName = normalizeOrgName(assignment.org_name);

    try {
      const octokit = await getInstallationOctokit(orgName);
      const { data: repos } = await octokit.rest.repos.listForOrg({
        org: orgName,
        sort: "updated",
        direction: "desc",
        per_page: 100,
      });

      return NextResponse.json({
        repos: repos.map((r) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          owner: r.owner.login,
          owner_id: r.owner.id,
          private: r.private,
          updated_at: r.updated_at,
        })),
      });
    } catch (ghErr: any) {
      return NextResponse.json(
        {
          repos: [],
          warning: `GitHub App으로 조직 저장소를 자동 조회할 수 없습니다 (${ghErr.message}). 수동 등록을 이용해주세요.`,
        },
        { status: 200 }
      );
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST: Registers a student repo for this assignment.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id: assignmentId } = await params;

    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("assignments")
      .select("id, org_name")
      .eq("id", assignmentId)
      .single();

    if (aErr || !assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    const body = await req.json();
    let { fullName, studentNo, studentName, githubLogin, repoId, githubId } = body;

    if (!fullName) {
      return NextResponse.json({ error: "저장소 이름(fullName)은 필수입니다." }, { status: 400 });
    }

    // Ensure full_name includes org prefix
    const orgName = normalizeOrgName(assignment.org_name);
    if (!fullName.includes("/")) {
      fullName = `${orgName}/${fullName.trim()}`;
    }

    // Try finding matching profile if githubLogin is provided
    let profileId: string | null = null;
    if (githubLogin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, github_id")
        .ilike("github_login", githubLogin.trim())
        .maybeSingle();

      if (profile) {
        profileId = profile.id;
        githubId = githubId || profile.github_id;
      }
    }

    // Generate fallback numeric IDs if not provided
    const finalGithubId = githubId ? Number(githubId) : Math.floor(Math.random() * 80000000) + 10000000;
    const finalRepoId = repoId ? Number(repoId) : Math.floor(Math.random() * 800000000) + 100000000;

    // Insert student_repo
    const { data: studentRepo, error: srErr } = await supabaseAdmin
      .from("student_repos")
      .upsert(
        {
          assignment_id: assignmentId,
          full_name: fullName,
          student_no: studentNo ? String(studentNo).trim() : null,
          student_name: studentName ? String(studentName).trim() : null,
          profile_id: profileId,
          github_id: finalGithubId,
          repo_id: finalRepoId,
        },
        {
          onConflict: "assignment_id,github_id",
        }
      )
      .select()
      .single();

    if (srErr || !studentRepo) {
      throw srErr || new Error("Failed to insert student repo");
    }

    // Upsert initial repo_status
    await supabaseAdmin
      .from("repo_status")
      .upsert({
        student_repo_id: studentRepo.id,
        stale: true,
        updated_at: new Date().toISOString(),
      });

    return NextResponse.json({ success: true, studentRepo });
  } catch (err: any) {
    console.error("Error creating student repo:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
