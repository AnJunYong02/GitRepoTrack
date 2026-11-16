import { NextResponse } from "next/server";
import { guardErrorStatus, requireOrgOwner } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getInstallationOctokit } from "@/lib/github/app";
import { parseRepoName, ParsedRepoInfo } from "@/lib/github/repo-parser";
import { resolveActiveOrg } from "@/lib/org/active-org";
import { cachedCall, safeRevalidateTag } from "@/lib/cache/shared-cache";
import { escapeLikePattern, orgReposTag } from "@/lib/cache/cache-keys";

// org repo 목록 캐시 시간 (Vercel Data Cache: 인스턴스끼리 공유)
const ORG_REPOS_CACHE_TTL_SECONDS = 3 * 60;

/** 캐시에 저장하는 repo 정보 (캐시 크기를 줄이려고 필요한 필드만 남긴다) */
interface CachedOrgRepo {
  id: number;
  name: string;
  full_name: string;
  html_url?: string;
  updated_at?: string;
}

/** GitHub App 설치 범위의 org repo 전체를 가져온다 (페이지 단위, 캐시 없음) */
async function fetchOrgReposFromGitHub(octokit: any): Promise<CachedOrgRepo[]> {
  const repos: CachedOrgRepo[] = [];
  let page = 1;
  while (true) {
    const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
      page,
    });
    for (const r of data.repositories) {
      repos.push({
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        html_url: r.html_url,
        updated_at: r.updated_at ?? undefined,
      });
    }
    if (repos.length >= data.total_count || data.repositories.length < 100) {
      break;
    }
    page++;
  }
  return repos;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const targetOrg = await resolveActiveOrg(url.searchParams.get("org"));
    // 캐시를 보기 전에 이 org의 Owner인지 확인 (캐시는 사용자 구분 없이 org별로 공유됨)
    await requireOrgOwner(targetOrg);
    const forceRefresh = url.searchParams.get("refresh") === "1";
    const tag = orgReposTag(targetOrg);

    // 1. org repo 목록: 공유 캐시(3분). 새로고침이면 캐시를 무효화하고 GitHub에서 바로 가져온다
    //    (캐시가 맞으면 GitHub 토큰 발급도 하지 않는다)
    let fetchedFromGitHub = false;
    const loadFromGitHub = async () => {
      fetchedFromGitHub = true;
      const octokit = await getInstallationOctokit(targetOrg);
      return fetchOrgReposFromGitHub(octokit);
    };

    let allRepos: CachedOrgRepo[];
    try {
      if (forceRefresh) {
        safeRevalidateTag(tag);
        allRepos = await loadFromGitHub();
      } else {
        allRepos = await cachedCall(
          ["org-repos", targetOrg.toLowerCase()],
          { revalidate: ORG_REPOS_CACHE_TTL_SECONDS, tags: [tag] },
          loadFromGitHub
        );
      }
    } catch (githubErr: any) {
      // GitHub App이 이 org에 설치되지 않은 경우 (실패는 캐시되지 않음)
      if (githubErr?.status === 404) {
        return NextResponse.json(
          {
            error: `선택한 GitHub Organization("${targetOrg}")에 아직 GitHub App이 설치되지 않았거나 존재하지 않는 조직입니다. GitHub App 설정(Install App)에서 "${targetOrg}" 조직에 앱을 먼저 설치해주세요.`,
            orgName: targetOrg,
            notInstalled: true,
          },
          { status: 404 }
        );
      }
      throw githubErr;
    }
    const fromCache = !fetchedFromGitHub;

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
    // DB에서 현재 org 과제만 조회 (ilike: 대소문자 무시, org 이름의 _ 와일드카드는 이스케이프)
    const { data: orgAssignments } = await supabaseAdmin
      .from("assignments")
      .select("id, title, branch, org_name, student_repos(count)")
      .ilike("org_name", escapeLikePattern(targetOrg))
      .order("created_at", { ascending: false });

    const assignments = orgAssignments || [];

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
    return NextResponse.json({ error: err.message }, { status: guardErrorStatus(err) });
  }
}
