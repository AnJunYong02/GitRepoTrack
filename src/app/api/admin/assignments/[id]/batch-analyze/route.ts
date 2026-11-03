import { requireStaff } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runRepoAnalysis } from "@/lib/analysis/run-analysis";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaff();
    const { id: assignmentId } = await params;

    // Fetch all student_repos for this assignment
    const { data: studentRepos, error: sErr } = await supabaseAdmin
      .from("student_repos")
      .select("id, full_name, student_no")
      .eq("assignment_id", assignmentId);

    if (sErr) {
      return new Response(JSON.stringify({ error: sErr.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const total = studentRepos?.length || 0;
    const encoder = new TextEncoder();

    if (total === 0) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "done",
                total: 0,
                successCount: 0,
                failCount: 0,
                errors: [],
              }) + "\n"
            )
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
        },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        let successCount = 0;
        let failCount = 0;
        let analyzedCount = 0;
        const errors: Array<{ fullName: string; error: string }> = [];

        // Notify client of start
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "start",
              total,
            }) + "\n"
          )
        );

        // Run analysis in small chunks of 3 for fast, responsive streaming
        const chunkSize = 3;
        for (let i = 0; i < studentRepos.length; i += chunkSize) {
          const chunk = studentRepos.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (sr) => {
              try {
                await runRepoAnalysis(sr.id, {
                  forceRefresh: true,
                  source: "manual",
                  bypassCooldown: true,
                });
                successCount++;
              } catch (err: any) {
                failCount++;
                errors.push({ fullName: sr.full_name, error: err.message });
                console.warn(`[Batch Analyze] Error analyzing ${sr.full_name}:`, err.message);
              } finally {
                analyzedCount++;
              }
            })
          );

          // Stream progress
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "progress",
                analyzedCount,
                total,
                successCount,
                failCount,
              }) + "\n"
            )
          );
        }

        // Stream final completion
        controller.enqueue(
          encoder.encode(
            JSON.stringify({
              type: "done",
              total,
              successCount,
              failCount,
              errors: errors.slice(0, 10),
            }) + "\n"
          )
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err: any) {
    console.error("[POST /api/admin/assignments/[id]/batch-analyze] Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
