import { NextResponse } from "next/server";
import { guardErrorStatus, requireOrgOwner } from "@/lib/auth/guards";
import { normalizeOrgName } from "@/lib/github/app";
import { isValidOrgSlug } from "@/lib/org/active-org";
import { parseRosterCsv } from "@/lib/roster/parse-roster";
import { decodeCsvBytes } from "@/lib/roster/decode-csv";
import { loadOrgRoster, replaceOrgRoster } from "@/lib/roster/org-roster";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 1024 * 1024; // 1MB
const MAX_STUDENTS = 2000;

function readOrg(value: unknown): string | null {
  const org = normalizeOrgName(typeof value === "string" ? value : "");
  return isValidOrgSlug(org) ? org : null;
}

/** GET ?org= : org 학생 명단 (Owner 전용) */
export async function GET(req: Request) {
  try {
    const org = readOrg(new URL(req.url).searchParams.get("org"));
    if (!org) return NextResponse.json({ error: "org 값이 올바르지 않습니다." }, { status: 400 });

    await requireOrgOwner(org);
    const students = (await loadOrgRoster(org)).map((s) => ({
      studentNo: s.studentNo,
      name: s.name,
      githubLogin: s.githubLogin,
      updatedAt: s.updatedAt,
    }));
    return NextResponse.json({ students });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: guardErrorStatus(err) });
  }
}

/**
 * POST multipart { org, file } : CSV로 org 학생 명단을 전체 교체 (Owner 전용)
 * 형식 오류 행이 하나라도 있으면 저장하지 않고 오류 목록을 돌려준다.
 * 명단 내용은 로그에 남기지 않는다.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "CSV 파일을 첨부해주세요." }, { status: 400 });

    const org = readOrg(form.get("org"));
    if (!org) return NextResponse.json({ error: "org 값이 올바르지 않습니다." }, { status: 400 });

    // 파일 내용을 읽기 전에 권한부터 확인
    const { user } = await requireOrgOwner(org);

    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "CSV 파일을 첨부해주세요." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "CSV 파일은 1MB 이하만 올릴 수 있습니다." }, { status: 400 });
    }

    const text = decodeCsvBytes(await file.arrayBuffer());
    const { students, errors } = parseRosterCsv(text);

    if (errors.length > 0) {
      return NextResponse.json(
        { error: `형식 오류가 ${errors.length}건 있어 저장하지 않았습니다.`, errors },
        { status: 400 }
      );
    }
    if (students.length === 0) {
      return NextResponse.json({ error: "등록할 학생이 없습니다." }, { status: 400 });
    }
    if (students.length > MAX_STUDENTS) {
      return NextResponse.json(
        { error: `한 번에 최대 ${MAX_STUDENTS}명까지 올릴 수 있습니다.` },
        { status: 400 }
      );
    }

    const count = await replaceOrgRoster(org, students, user.id);
    return NextResponse.json({ count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: guardErrorStatus(err) });
  }
}
