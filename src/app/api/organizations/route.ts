import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getDefaultOrgName, normalizeOrgName } from "@/lib/github/app";
import {
  ACTIVE_ORG_COOKIE,
  getAvailableOrganizations,
  isValidOrgSlug,
  resolveActiveOrg,
} from "@/lib/org/active-org";

export async function GET(req: Request) {
  try {
    await requireUser();
    const url = new URL(req.url);
    const queryOrg = url.searchParams.get("org");
    const activeOrg = await resolveActiveOrg(queryOrg);
    const organizations = await getAvailableOrganizations(activeOrg);

    return NextResponse.json({
      activeOrg,
      defaultOrg: getDefaultOrgName(),
      organizations,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Organization 목록 조회에 실패했습니다." },
      { status: 401 }
    );
  }
}

export async function POST(req: Request) {
  try {
    await requireUser();
    const body = await req.json();
    const normalized = normalizeOrgName(String(body.orgName || ""));

    if (!isValidOrgSlug(normalized)) {
      return NextResponse.json(
        {
          error:
            "유효한 GitHub Organization 이름 또는 URL(예: 2026-2-WebService)을 입력해주세요.",
        },
        { status: 400 }
      );
    }

    const res = NextResponse.json({
      success: true,
      activeOrg: normalized,
    });

    res.cookies.set(ACTIVE_ORG_COOKIE, normalized, {
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Organization 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
