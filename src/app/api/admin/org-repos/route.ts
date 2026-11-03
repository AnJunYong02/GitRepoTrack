import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getInstallationOctokit, normalizeOrgName } from "@/lib/github/app";
import { parseRepoName, ParsedRepoInfo } from "@/lib/github/repo-parser";

export async function GET() {
  try {
    await requireStaff();

    const targetOrg = normalizeOrgName(process.env.GITHUB_ORG_NAME || "2026-2-WebService");
    const octokit = await getInstallationOctokit(targetOrg);

    // 1. Fetch all repositories of the organization (handle pagination up to 500)
    let allRepos: any[] = [];
    let page = 1;
    while (true) {
      const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
        per_page: 100,
        page,
      });

      allRepos.push(...data.repositories);
      if (allRepos.length >= data.total_count || data.repositories.length < 100) {
        break;
      }
      page++;
    }

    // 2. Parse and group repositories
    const categoryMap = new Map<
      string,
      {
        category: string;
        label: string;
        repos: ParsedRepoInfo[];
      }
    >();

    for (const r of allRepos) {
      const parsed = parseRepoName({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        html_url: r.html_url,
        updated_at: r.updated_at,
      });

      if (!categoryMap.has(parsed.category)) {
        categoryMap.set(parsed.category, {
          category: parsed.category,
          label: parsed.categoryLabel,
          repos: [],
        });
      }

      categoryMap.get(parsed.category)!.repos.push(parsed);
    }

    // 3. Fetch existing assignments from DB to match
    const { data: assignments } = await supabaseAdmin
      .from("assignments")
      .select("id, title, branch, org_name, student_repos(count)")
      .order("created_at", { ascending: false });

    const categories = Array.from(categoryMap.values()).map((c) => {
      // Sort repos by studentNo
      c.repos.sort((a, b) => (a.studentNo || a.name).localeCompare(b.studentNo || b.name));

      // Check if assignment matching this category exists
      const matchedAssignment = assignments?.find(
        (a) =>
          a.title.toLowerCase().includes(c.category.toLowerCase()) ||
          a.title.toLowerCase().includes(c.label.toLowerCase())
      );

      return {
        category: c.category,
        label: c.label,
        count: c.repos.length,
        isStudentCategory: c.category !== "other",
        repos: c.repos,
        existingAssignmentId: matchedAssignment?.id,
        existingAssignmentTitle: matchedAssignment?.title,
        existingRepoCount: (matchedAssignment as any)?.student_repos?.[0]?.count ?? 0,
      };
    });

    // Sort categories: newest first (e.g. assign08_midterm, assign07, ... assign01), then other at the end
    categories.sort((a, b) => {
      if (a.category === "other") return 1;
      if (b.category === "other") return -1;
      return b.category.localeCompare(a.category);
    });

    return NextResponse.json({
      orgName: targetOrg,
      totalRepos: allRepos.length,
      categories,
      existingAssignments: assignments || [],
    });
  } catch (err: any) {
    console.error("[GET /api/admin/org-repos] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
