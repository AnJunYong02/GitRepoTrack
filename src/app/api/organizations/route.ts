import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { getDefaultOrgName, normalizeOrgName } from "@/lib/github/app";
import {
  ACTIVE_ORG_COOKIE,
  checkIsUserOwnerOfOrg,
  getAvailableOrganizations,
  isValidOrgSlug,
  resolveActiveOrg,
  updateRegisteredOrgs,
} from "@/lib/org/active-org";

/**
 * 등록 목록을 처음 저장하는 기존 사용자를 위해, 지금 화면에 카드로 보이던 org 이름을 구한다.
 */
async function getSeedOrgNames(user: any, profile: any): Promise<string[]> {
  const orgs = await getAvailableOrganizations(undefined, { user, profile });
  return orgs.filter((o) => o.isRegistered).map((o) => o.name);
}

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
    // action: "register" = 등록만(이동 없음), "enter"(기본값) = 등록 + 활성 org로 입장
    const action = body.action === "register" ? "register" : "enter";

    if (!isValidOrgSlug(normalized)) {
      return NextResponse.json(
        {
          error: "유효한 GitHub Organization 이름을 입력하거나 선택해주세요.",
        },
        { status: 400 }
      );
    }

    const isOwner = await checkIsUserOwnerOfOrg(normalized, user, profile);

    // 본인의 등록 목록(app_metadata.registered_orgs)에 추가
    const seed = await getSeedOrgNames(user, profile);
    const registeredOrgs = await updateRegisteredOrgs(user.id, normalized, "add", seed);

    const targetPath = isOwner
      ? `/admin?org=${encodeURIComponent(normalized)}`
      : `/dashboard?org=${encodeURIComponent(normalized)}`;

    const res = NextResponse.json({
      success: true,
      activeOrg: normalized,
      isOwner,
      targetPath,
      registeredOrgs,
    });

    if (action === "enter") {
      res.cookies.set(ACTIVE_ORG_COOKIE, normalized, {
        path: "/",
        maxAge: 60 * 60 * 24 * 90, // 90 days
        sameSite: "lax",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Organization 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 대시보드 등록 목록에서 org를 삭제한다.
 * GitHub org 탈퇴나 과제·학생 데이터 삭제는 하지 않는다.
 */
export async function DELETE(req: Request) {
  try {
    const { user, profile } = await requireUser();
    const body = await req.json().catch(() => ({}));
    const normalized = normalizeOrgName(String(body.orgName || ""));

    if (!isValidOrgSlug(normalized)) {
      return NextResponse.json(
        { error: "삭제할 Organization 이름이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const seed = await getSeedOrgNames(user, profile);
    const registeredOrgs = await updateRegisteredOrgs(user.id, normalized, "remove", seed);

    const res = NextResponse.json({ success: true, registeredOrgs });

    // 삭제한 org가 현재 활성 org면 쿠키도 지운다
    const activeOrg = await resolveActiveOrg(null);
    if (activeOrg.toLowerCase() === normalized.toLowerCase()) {
      res.cookies.delete(ACTIVE_ORG_COOKIE);
    }

    return res;
  } catch (err: any) {
    const status = err.message?.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json(
      { error: err.message || "Organization 삭제 중 오류가 발생했습니다." },
      { status }
    );
  }
}
