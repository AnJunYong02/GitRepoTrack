import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  try {
    const { user } = await requireStaff();
    const body = await req.json();
    const { title, orgName, branch = "main", deadlineAt, rankingMode = "live" } = body;

    if (!title || !orgName || !deadlineAt) {
      return NextResponse.json({ error: "필수 입력값이 누락되었습니다." }, { status: 400 });
    }

    // 1. Insert assignment
    const { data: assignment, error: aErr } = await supabaseAdmin
      .from("assignments")
      .insert({
        title,
        org_name: orgName,
        branch,
        deadline_at: deadlineAt,
        ranking_mode: rankingMode,
        ranking_started_at: rankingMode === "live" ? new Date().toISOString() : null,
        created_by: user.id,
      })
      .select()
      .single();

    if (aErr || !assignment) {
      throw aErr || new Error("과제 생성 실패");
    }

    // 2. Create initial criteria version with default Weekly Report 5 keywords
    const defaultRules = {
      branch,
      requiredFiles: [
        {
          type: "glob_exists",
          pattern: "src/**/*",
          label: "src/ 아래 소스 파일 존재",
        },
      ],
      readme: {
        required: true,
        headerKeywords: [],
      },
    };

    const { data: version } = await supabaseAdmin
      .from("criteria_versions")
      .insert({
        assignment_id: assignment.id,
        version: 1,
        rules: defaultRules,
        created_by: user.id,
      })
      .select()
      .single();

    if (version) {
      await supabaseAdmin
        .from("assignments")
        .update({ current_criteria_version_id: version.id })
        .eq("id", assignment.id);
    }

    return NextResponse.json({ success: true, assignment });
  } catch (err: any) {
    const status = err.message?.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
