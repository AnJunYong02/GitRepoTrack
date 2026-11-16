import { NextResponse } from "next/server";
import { guardErrorStatus, requireOrgOwner } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeOrgName } from "@/lib/github/app";
import { isValidOrgSlug } from "@/lib/org/active-org";
import { buildRepoPrefix, normalizeAssignmentPrefix } from "@/lib/github/student-repo-name";
import { buildProvisionPreview } from "@/lib/github/provision-preview";
import { defaultAssignmentTitle } from "@/lib/assignments/assignment-match";
import {
  createAssignmentWithDefaults,
  findAssignmentForPrefix,
} from "@/lib/assignments/ensure-assignment";

export const runtime = "nodejs";
// 미리보기는 학생별 GitHub 조회가 있어 시간이 걸릴 수 있음 (Vercel)
export const maxDuration = 60;

const PREFIX_ERROR = "과제 접두사는 영문/숫자/밑줄만 사용할 수 있습니다. (예: assign10)";

/**
 * org 이름을 검증하고, 요청자가 그 Organization의 Owner인지 확인한다.
 * (Owner가 아니면 guards.requireOrgOwner가 Forbidden 에러를 던진다)
 */
async function loadOwnedOrg(rawOrg: string) {
  const org = normalizeOrgName(rawOrg);
  if (!isValidOrgSlug(org)) {
    return { error: NextResponse.json({ error: "Organization 이름이 올바르지 않습니다." }, { status: 400 }) };
  }
  const { user } = await requireOrgOwner(org);
  return { org, user };
}

/**
 * GET ?org=&prefix= : 미리보기 + 연결될 과제(기존 과제 / 새 과제 제목 제안)
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const owner = await loadOwnedOrg(url.searchParams.get("org") || "");
    if (owner.error) return owner.error;

    const prefix = normalizeAssignmentPrefix(url.searchParams.get("prefix") || "");
    if (!prefix) {
      return NextResponse.json({ error: PREFIX_ERROR }, { status: 400 });
    }

    const [preview, existing] = await Promise.all([
      buildProvisionPreview(owner.org, prefix),
      findAssignmentForPrefix(owner.org, prefix),
    ]);

    return NextResponse.json({
      ...preview,
      existingAssignment: existing ? { id: existing.id, title: existing.title } : null,
      suggestedTitle: defaultAssignmentTitle(prefix),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "미리보기를 불러오지 못했습니다." },
      { status: guardErrorStatus(err) }
    );
  }
}

/**
 * POST { org, prefix, title?, deadlineAt? } : 과제를 찾거나 새로 만들고 assignmentId를 반환한다.
 * 실제 repo 생성은 POST /api/admin/assignments/[id]/create-repos 를 5명씩 호출한다.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const owner = await loadOwnedOrg(String(body.org || ""));
    if (owner.error) return owner.error;

    const prefix = normalizeAssignmentPrefix(String(body.prefix || ""));
    if (!prefix) {
      return NextResponse.json({ error: PREFIX_ERROR }, { status: 400 });
    }
    const repoPrefix = buildRepoPrefix(prefix);

    // 1. 같은 과제가 있으면 그 과제에 붙인다 (repo_prefix가 비어 있으면 채워 둔다)
    const existing = await findAssignmentForPrefix(owner.org, prefix);
    if (existing) {
      if (existing.repo_prefix !== repoPrefix) {
        await supabaseAdmin
          .from("assignments")
          .update({ repo_prefix: repoPrefix, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      return NextResponse.json({ assignmentId: existing.id, title: existing.title, created: false });
    }

    // 2. 없으면 새 과제 생성
    const title = String(body.title || "").trim() || defaultAssignmentTitle(prefix);
    const deadline = body.deadlineAt ? new Date(String(body.deadlineAt)) : null;
    if (!deadline || Number.isNaN(deadline.getTime())) {
      return NextResponse.json({ error: "마감 일시를 입력해주세요." }, { status: 400 });
    }

    const assignment = await createAssignmentWithDefaults({
      org: owner.org,
      title,
      deadlineAt: deadline.toISOString(),
      repoPrefix,
      userId: owner.user.id,
    });

    return NextResponse.json({ assignmentId: assignment.id, title: assignment.title, created: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "과제를 준비하지 못했습니다." },
      { status: guardErrorStatus(err) }
    );
  }
}
