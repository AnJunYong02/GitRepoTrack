import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  saveStudentNoToMetadata,
  syncReposForStudent,
} from "@/lib/student/sync-student-repos";
import { resolveActiveOrg } from "@/lib/org/active-org";

export async function POST(req: Request) {
  try {
    const { user, profile } = await requireUser();
    const body = await req.json();
    const rawStudentNo = String(body.studentNo || "").trim();
    const targetOrg = await resolveActiveOrg(body.orgName);

    if (!/^[0-9]{6,10}$/.test(rawStudentNo)) {
      return NextResponse.json(
        { error: "유효한 학번 형식(숫자 6~10자리, 예: 22300743)을 입력해주세요." },
        { status: 400 }
      );
    }

    // 1. Check if this user already has a bound student_no
    const metaStudentNo = user.user_metadata?.student_no?.trim();
    const { data: userExistingRepos } = await supabaseAdmin
      .from("student_repos")
      .select("student_no")
      .eq("profile_id", user.id)
      .not("student_no", "is", null)
      .limit(1);

    const existingStudentNo =
      metaStudentNo || userExistingRepos?.[0]?.student_no?.trim() || null;

    // Prevent changing student_no once registered (prevents viewing other students' repos)
    if (existingStudentNo && existingStudentNo !== rawStudentNo) {
      return NextResponse.json(
        {
          error: `보안 정책상 한 번 등록된 학번(${existingStudentNo})은 변경할 수 없습니다. 학번 수정이 필요한 경우 담당 교수님 또는 TA에게 문의해주세요.`,
        },
        { status: 403 }
      );
    }

    // 2. Prevent claiming a student_no that is already linked to another student's profile
    const { data: otherUserRepos } = await supabaseAdmin
      .from("student_repos")
      .select("profile_id")
      .eq("student_no", rawStudentNo)
      .not("profile_id", "is", null)
      .neq("profile_id", user.id)
      .limit(1);

    if (otherUserRepos && otherUserRepos.length > 0) {
      return NextResponse.json(
        {
          error: "이미 다른 학생 계정에 등록된 학번입니다. 본인의 학번만 연동할 수 있습니다.",
        },
        { status: 403 }
      );
    }

    // Save to user_metadata
    await saveStudentNoToMetadata(user.id, user.user_metadata, rawStudentNo);

    // Sync from DB and selected GitHub Organization
    const result = await syncReposForStudent(user.id, profile?.github_id, rawStudentNo, {
      scanOrgRepos: true,
      orgName: targetOrg,
    });

    return NextResponse.json({
      success: true,
      studentNo: rawStudentNo,
      orgName: targetOrg,
      linkedCount: result.linkedCount,
      syncedFromOrg: result.syncedFromOrg,
    });
  } catch (err: any) {
    console.error("[POST /api/student/student-no] Error:", err);
    return NextResponse.json(
      { error: err.message || "학번 연동 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
