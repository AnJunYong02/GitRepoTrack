import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getDefaultOrgName, normalizeOrgName } from "@/lib/github/app";
import {
  ACTIVE_ORG_COOKIE,
  checkIsUserOwnerOfOrg,
  getAvailableOrganizations,
  isValidOrgSlug,
  resolveActiveOrg,
  saveConnectedOrgToUserMetadata,
} from "@/lib/org/active-org";

export async function GET(req: Request) {
  try {
    const { user, profile } = await requireUser();
    const url = new URL(req.url);
    const queryOrg = url.searchParams.get("org");
    const searchQuery = url.searchParams.get("q") || "";
    const forceRefresh = url.searchParams.get("refresh") === "1";

    const activeOrg = await resolveActiveOrg(queryOrg);
    const organizations = await getAvailableOrganizations(
      activeOrg,
      {
        user,
        profile,
      },
      {
        forceRefresh,
        searchQuery,
      }
    );

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
    const { user, profile } = await requireUser();
    const body = await req.json();
    const normalized = normalizeOrgName(String(body.orgName || ""));

    if (!isValidOrgSlug(normalized)) {
      return NextResponse.json(
        {
          error: "유효한 GitHub Organization 이름을 입력하거나 선택해주세요.",
        },
        { status: 400 }
      );
    }

    const isOwner = await checkIsUserOwnerOfOrg(normalized, user, profile);

    // Save/update this organization in the user's connected organizations metadata
    await saveConnectedOrgToUserMetadata(user, normalized, isOwner);

    const targetPath = isOwner
      ? `/admin?org=${encodeURIComponent(normalized)}`
      : `/dashboard?org=${encodeURIComponent(normalized)}`;

    const res = NextResponse.json({
      success: true,
      activeOrg: normalized,
      isOwner,
      targetPath,
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
