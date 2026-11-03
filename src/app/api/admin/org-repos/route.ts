import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getInstallationOctokit } from "@/lib/github/app";
import { parseRepoName, ParsedRepoInfo } from "@/lib/github/repo-parser";
import { resolveActiveOrg } from "@/lib/org/active-org";

// In-memory cache for GitHub Organization repo list per org (TTL: 3 minutes)
const orgReposMemoryCache = new Map<
  string,
  { repos: any[]; fetchedAt: number }
>();
const ORG_REPOS_CACHE_TTL_MS = 3 * 60 * 1000;

export async function GET(req: Request) {
  try {
    await requireStaff();

    const url = new URL(req.url);
    const targetOrg = await resolveActiveOrg(url.searchParams.get("org"));
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const cacheKey = targetOrg.toLowerCase();
    const cached = orgReposMemoryCache.get(cacheKey);

    let allRepos: any[] = [];
    let fromCache = false;

    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.fetchedAt < ORG_REPOS_CACHE_TTL_MS
    ) {
      allRepos = cached.repos;
      fromCache = true;
    } else {
      let octokit;
      try {
        octokit = await getInstallationOctokit(targetOrg);
      } catch (installErr: any) {
        if (installErr?.status === 404) {
          return NextResponse.json(
            {
              error: `선택한 GitHub Organization("${targetOrg}")에 아직 GitHub App이 설치되지 않았거나 존재하지 않는 조직입니다. GitHub App 설정(Install App)에서 "${targetOrg}" 조직에 앱을 먼저 설치해주세요.`,
              orgName: targetOrg,
              notInstalled: true,
            },
            { status: 404 }
          );
        }
        throw installErr;
      }

      // 1. Fetch all repositories of the organization (handle pagination up to 500)
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

      orgReposMemoryCache.set(cacheKey, {
        repos: allRepos,
        fetchedAt: Date.now(),
      });
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

    // 3. Fetch existing assignments from DB scoped to targetOrg (case-insensitive)
    const { data: allAssignments } = await supabaseAdmin
      .from("assignments")
      .select("id, title, branch, org_name, student_repos(count)")
      .order("created_at", { ascending: false });

    const assignments = (allAssignments || []).filter(
      (a) => (a.org_name || "").toLowerCase() === targetOrg.toLowerCase()
    );

    const categories = Array.from(categoryMap.values()).map((c) => {
      // Sort repos by studentNo
      c.repos.sort((a, b) => (a.studentNo || a.name).localeCompare(b.studentNo || b.name));

      // Check if assignment matching this category exists in this Organization
      const matchedAssignment = assignments.find(
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

    // Sort categories: newest first (e.g. assign10, assign09, assign08_midterm, ... assign01), then other at the end
    categories.sort((a, b) => {
      if (a.category === "other") return 1;
      if (b.category === "other") return -1;
      return b.category.localeCompare(a.category);
    });

    return NextResponse.json({
      orgName: targetOrg,
      totalRepos: allRepos.length,
      categories,
      existingAssignments: assignments,
      fromCache,
    });
  } catch (err: any) {
    console.error("[GET /api/admin/org-repos] Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
