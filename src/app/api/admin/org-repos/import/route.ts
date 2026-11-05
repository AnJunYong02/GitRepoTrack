import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ParsedRepoInfo } from "@/lib/github/repo-parser";
import { resolveActiveOrg } from "@/lib/org/active-org";

export async function POST(req: Request) {
  try {
    const { user } = await requireStaff();
    const body = await req.json();

    const {
      category,
      title: inputTitle,
      orgName: inputOrgName,
      branch = "main",
      deadlineAt,
      rankingMode = "live",
      repos,
    }: {
      category: string;
      title?: string;
      orgName?: string;
      branch?: string;
      deadlineAt?: string;
      rankingMode?: "live" | "none";
      repos: ParsedRepoInfo[];
    } = body;

    if (!category || !repos || !Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json({ error: "카테고리와 등록할 저장소 목록이 필요합니다." }, { status: 400 });
    }

    const orgName = await resolveActiveOrg(inputOrgName);
    const numMatch = category.match(/([0-9]+)/);
    const defaultTitle = numMatch
      ? `웹서비스 개발 ${parseInt(numMatch[1], 10)}차 과제 (${category})`
      : `과제 (${category})`;
    const title = inputTitle?.trim() || defaultTitle;
    const finalDeadline =
      deadlineAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Find or create assignment scoped to orgName
    let assignmentId: string;
    const { data: existingAssignment } = await supabaseAdmin
      .from("assignments")
      .select("id")
      .ilike("org_name", orgName)
      .eq("title", title)
      .maybeSingle();

    if (existingAssignment) {
      assignmentId = existingAssignment.id;
    } else {
      const { data: newAssignment, error: aErr } = await supabaseAdmin
        .from("assignments")
        .insert({
          title,
          org_name: orgName,
          branch,
          deadline_at: finalDeadline,
          ranking_mode: rankingMode,
          ranking_started_at: rankingMode === "live" ? new Date().toISOString() : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (aErr || !newAssignment) {
        throw aErr || new Error("과제 생성 실패");
      }

      assignmentId = newAssignment.id;

      const defaultRules = {
        branch,
        requiredFiles: [],
        readmeKeywords: [],
        readme: {
          required: true,
          headerKeywords: [],
        },
        codeChecks: [],
      };

      const { data: criteriaVer } = await supabaseAdmin
        .from("criteria_versions")
        .insert({
          assignment_id: assignmentId,
          version: 1,
          rules: defaultRules,
          created_by: user.id,
        })
        .select()
        .single();

      if (criteriaVer) {
        await supabaseAdmin
          .from("assignments")
          .update({ current_criteria_version_id: criteriaVer.id })
          .eq("id", assignmentId);
      }
    }

    // 2. Fetch all profiles and existing student_no -> profile_id links to auto-link
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, github_id, github_login");

    const { data: existingLinkedRepos } = await supabaseAdmin
      .from("student_repos")
      .select("student_no, profile_id")
      .not("student_no", "is", null)
      .not("profile_id", "is", null);

    const studentNoToProfileId = new Map<string, string>();
    for (const row of existingLinkedRepos || []) {
      if (row.student_no && row.profile_id) {
        studentNoToProfileId.set(row.student_no, row.profile_id);
      }
    }

    let importedCount = 0;

    for (const r of repos) {
      // Determine student_no and unique numeric github_id
      const studentNo = r.studentNo || null;
      // If studentNo is an 8-digit number, use it as unique fallback github_id
      const fallbackGithubId = studentNo && !isNaN(Number(studentNo))
        ? Number(studentNo)
        : r.repoId;

      // Check if student has already registered a profile or linked their student_no
      const matchedProfile = profiles?.find((p) => p.github_id === fallbackGithubId);
      const linkedProfileId =
        matchedProfile?.id || (studentNo ? studentNoToProfileId.get(studentNo) || null : null);

      const { data: sr, error: srErr } = await supabaseAdmin
        .from("student_repos")
        .upsert(
          {
            assignment_id: assignmentId,
            full_name: r.fullName,
            student_no: studentNo,
            github_id: matchedProfile ? matchedProfile.github_id : fallbackGithubId,
            profile_id: linkedProfileId,
            repo_id: r.repoId,
          },
          {
            onConflict: "assignment_id,github_id",
          }
        )
        .select()
        .single();

      if (!srErr && sr) {
        // Upsert repo_status with stale: true
        await supabaseAdmin
          .from("repo_status")
          .upsert({
            student_repo_id: sr.id,
            stale: true,
            updated_at: new Date().toISOString(),
          });
        importedCount++;
      } else if (srErr) {
        console.warn(`[Import Org Repo] Failed to upsert ${r.fullName}:`, srErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      assignmentId,
      importedCount,
      totalRequested: repos.length,
    });
  } catch (err: any) {
    console.error("[POST /api/admin/org-repos/import] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
