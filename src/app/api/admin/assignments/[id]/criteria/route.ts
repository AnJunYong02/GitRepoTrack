import { NextResponse } from "next/server";
import { guardErrorStatus, requireAssignmentOwner } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ANALYSIS_BRANCH } from "@/lib/assignments/branch";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const { user } = await requireAssignmentOwner(assignmentId);

    const body = await req.json();
    const { rules: rawRules, deadlineAt } = body;

    if (!rawRules) {
      return NextResponse.json({ error: "Rules payload required" }, { status: 400 });
    }

    // 제출 마감 기한 검증
    const deadline = deadlineAt ? new Date(String(deadlineAt)) : null;
    if (!deadline || Number.isNaN(deadline.getTime())) {
      return NextResponse.json({ error: "제출 마감 기한이 올바르지 않습니다." }, { status: 400 });
    }

    // 분석 브랜치는 main으로 고정
    const rules = { ...rawRules, branch: ANALYSIS_BRANCH };

    // 1. Get latest criteria version number
    const { data: latestVersion } = await supabaseAdmin
      .from("criteria_versions")
      .select("version")
      .eq("assignment_id", assignmentId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = (latestVersion?.version || 0) + 1;

    // 2. Insert new immutable criteria version
    const { data: newVersion, error: insertErr } = await supabaseAdmin
      .from("criteria_versions")
      .insert({
        assignment_id: assignmentId,
        version: nextVersion,
        rules,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr || !newVersion) {
      throw insertErr || new Error("Failed to insert criteria version");
    }

    // 3. 현재 기준 버전 + 마감 기한 + 브랜치(main 고정) 갱신
    const { error: updateErr } = await supabaseAdmin
      .from("assignments")
      .update({
        current_criteria_version_id: newVersion.id,
        deadline_at: deadline.toISOString(),
        branch: ANALYSIS_BRANCH,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);

    if (updateErr) throw updateErr;

    return NextResponse.json({ success: true, version: newVersion });
  } catch (error: any) {
    const status = guardErrorStatus(error);
    return NextResponse.json({ error: error.message }, { status });
  }
}
