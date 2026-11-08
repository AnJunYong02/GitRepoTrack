import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkIsUserOwnerOfOrg } from "@/lib/org/active-org";
import { getInstallationOctokit, normalizeOrgName } from "@/lib/github/app";
import { loadSecretRoster } from "@/lib/roster/secret-roster";
import {
  buildRepoPrefix,
  buildStudentRepoName,
  normalizeAssignmentPrefix,
} from "@/lib/github/student-repo-name";
import {
  describeGitHubError,
  EmailSearchState,
  loadVerifiedEmailIndex,
  provisionStudentRepo,
  resolveStudentLogin,
} from "@/lib/github/create-student-repos";
import type { OrgRepoSummary } from "@/lib/github/previous-repo-login";
import { listOrgRepos } from "@/lib/github/provision-preview";

export const runtime = "nodejs";
// Vercel 함수 실행 시간 제한 대비: 요청당 최대 MAX_PER_REQUEST명만 처리하고 클라이언트가 나눠 호출한다
export const maxDuration = 60;
const MAX_PER_REQUEST = 5;

/**
 * 과제를 조회하고, 요청자가 그 과제 Organization의 Owner인지 확인한다.
 */
async function loadOwnedAssignment(assignmentId: string) {
  const { user, profile } = await requireStaff();

  const { data: assignment } = await supabaseAdmin
    .from("assignments")
    .select("id, org_name, repo_prefix")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return { error: NextResponse.json({ error: "과제를 찾을 수 없습니다." }, { status: 404 }) };
  }

  const isOwner = await checkIsUserOwnerOfOrg(assignment.org_name, user, profile);
  if (!isOwner) {
    return {
      error: NextResponse.json(
        { error: "이 과제 Organization의 Owner만 repo를 생성할 수 있습니다." },
        { status: 403 }
      ),
    };
  }

  return { assignment: { ...assignment, org_name: normalizeOrgName(assignment.org_name) } };
}

function errorStatus(err: any): number {
  const msg = String(err?.message || "");
  if (msg.includes("Unauthorized")) return 401;
  if (msg.includes("Forbidden")) return 403;
  return 500;
}

/**
 * POST: 선택한 학생(최대 5명)의 repo 생성 + collaborator 등록 + student_repos 등록
 * 관리자 과제 목록 화면의 "학생 Repo 일괄 생성" 모달이 /api/admin/repo-provisioning으로
 * 과제 id를 확보한 뒤 5명씩 나눠 호출한다.
 * body: { prefix: string, studentNos: string[], templateRepo?: string }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const loaded = await loadOwnedAssignment(assignmentId);
    if (loaded.error) return loaded.error;
    const { assignment } = loaded;

    const body = await req.json().catch(() => ({}));
    const prefix = normalizeAssignmentPrefix(String(body.prefix || ""));
    if (!prefix) {
      return NextResponse.json(
        { error: "과제 접두사는 영문/숫자/밑줄만 사용할 수 있습니다. (예: assign10)" },
        { status: 400 }
      );
    }

    const studentNos: string[] = Array.isArray(body.studentNos)
      ? body.studentNos.map((n: unknown) => String(n))
      : [];
    if (studentNos.length === 0 || studentNos.length > MAX_PER_REQUEST) {
      return NextResponse.json(
        { error: `한 번에 1~${MAX_PER_REQUEST}명씩 요청해야 합니다.` },
        { status: 400 }
      );
    }

    const templateRepo =
      typeof body.templateRepo === "string" && /^[a-zA-Z0-9._-]+$/.test(body.templateRepo)
        ? body.templateRepo
        : undefined;

    // 학생 정보는 클라이언트가 보낸 값이 아니라 서버의 시크릿 명단에서만 가져온다
    const roster = await loadSecretRoster();
    const byStudentNo = new Map(roster.students.map((s) => [s.studentNo, s]));

    // 최종 접두사(assign10-c01)를 과제에 저장해 다음에도 재사용
    const repoPrefix = buildRepoPrefix(prefix);
    if (assignment.repo_prefix !== repoPrefix) {
      await supabaseAdmin
        .from("assignments")
        .update({ repo_prefix: repoPrefix, updated_at: new Date().toISOString() })
        .eq("id", assignment.id);
    }

    let octokit;
    try {
      octokit = await getInstallationOctokit(assignment.org_name);
    } catch (err) {
      return NextResponse.json({ error: describeGitHubError(err) }, { status: 502 });
    }

    // CSV에 GitHub ID가 없는 학생을 위해 이전 과제 repo를 찾을 org repo 목록 (클라이언트 값은 쓰지 않음)
    const needsLookup = studentNos.some((no) => {
      const s = byStudentNo.get(no);
      return s && !s.githubLogin;
    });
    const orgRepos: OrgRepoSummary[] = needsLookup
      ? await listOrgRepos(octokit, assignment.org_name).catch(() => [])
      : [];

    // GitHub API 속도 제한을 피하려고 순차 처리
    const emailSearch: EmailSearchState = { rateLimited: false };
    // CSV에 GitHub ID가 없는 학생이 있을 때만 로그인 인증 이메일 목록을 조회
    const verifiedUsers = needsLookup ? await loadVerifiedEmailIndex() : [];
    const results = [];
    for (const studentNo of studentNos) {
      const student = byStudentNo.get(studentNo);
      if (!student) {
        results.push({
          studentNo,
          repoName: buildStudentRepoName(prefix, studentNo),
          ok: false,
          error: "시크릿 명단에 없는 학번입니다.",
        });
        continue;
      }
      results.push(
        await provisionStudentRepo({
          octokit,
          org: assignment.org_name,
          assignmentId: assignment.id,
          assignmentPrefix: prefix,
          student,
          templateRepo,
          // CSV 값이 없을 때: 이전 과제 repo → 학교 이메일 검색 (서버에서 다시 결정)
          resolveLogin: async () =>
            (
              await resolveStudentLogin({
                octokit,
                org: assignment.org_name,
                student,
                orgRepos,
                currentRepoPrefix: repoPrefix,
                emailSearch,
                verifiedUsers,
              })
            ).resolved,
        })
      );
    }

    return NextResponse.json({ results });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "repo 생성 중 오류가 발생했습니다." },
      { status: errorStatus(err) }
    );
  }
}
