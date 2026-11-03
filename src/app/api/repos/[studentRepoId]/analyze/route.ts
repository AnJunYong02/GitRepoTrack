import { NextResponse } from "next/server";
import { requireStudentRepo } from "@/lib/auth/guards";
import { runRepoAnalysis } from "@/lib/analysis/run-analysis";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studentRepoId: string }> }
) {
  try {
    const { studentRepoId } = await params;

    // Strict access control: guarantees only the owner or staff can analyze
    await requireStudentRepo(studentRepoId);

    const body = await req.json().catch(() => ({}));
    const forceRefresh = Boolean(body.forceRefresh);

    const result = await runRepoAnalysis(studentRepoId, {
      forceRefresh,
      source: "manual",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    const status = error.message?.includes("Forbidden")
      ? 403
      : error.message?.includes("Unauthorized")
      ? 401
      : error.message?.includes("쿨다운")
      ? 429
      : 500;

    return NextResponse.json({ error: error.message || "Analysis failed" }, { status });
  }
}
