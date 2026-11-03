import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: assignmentId } = await params;
    const { user } = await requireStaff();

    const body = await req.json();
    const { rules } = body;

    if (!rules) {
      return NextResponse.json({ error: "Rules payload required" }, { status: 400 });
    }

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

    // 3. Update assignment current_criteria_version_id
    await supabaseAdmin
      .from("assignments")
      .update({
        current_criteria_version_id: newVersion.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", assignmentId);

    return NextResponse.json({ success: true, version: newVersion });
  } catch (error: any) {
    const status = error.message?.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
