import { NextResponse } from "next/server";
import { after } from "next/server";
import { verifyWebhookSignature } from "@/lib/github/webhook";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runRepoAnalysis } from "@/lib/analysis/run-analysis";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const bodyText = await req.text();
  const signature = req.headers.get("x-hub-signature-256");
  const event = req.headers.get("x-github-event");
  const deliveryId = req.headers.get("x-github-delivery");

  // 1. Verify HMAC Signature
  if (!verifyWebhookSignature(bodyText, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Only handle push events
  if (event !== "push") {
    return NextResponse.json({ message: `Ignored event: ${event}` }, { status: 200 });
  }

  if (!deliveryId) {
    return NextResponse.json({ error: "Missing x-github-delivery" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const repoId = payload.repository?.id;
  const ref = payload.ref;
  const afterSha = payload.after;
  const pushedAt = payload.repository?.pushed_at
    ? new Date(payload.repository.pushed_at * 1000).toISOString()
    : new Date().toISOString();

  // 2. Check if this repository is mapped to any student_repo
  const { data: studentRepo } = await supabaseAdmin
    .from("student_repos")
    .select("id, assignment_id, assignments(branch)")
    .eq("repo_id", repoId)
    .maybeSingle();

  const targetBranch = (studentRepo as any)?.assignments?.branch || "main";
  const isTargetBranch = ref === `refs/heads/${targetBranch}`;

  // 3. Record push event for idempotency and queue tracking
  const { data: pushEvent, error: insertErr } = await supabaseAdmin
    .from("push_events")
    .insert({
      delivery_id: deliveryId,
      repo_id: repoId,
      ref,
      after_sha: afterSha,
      pushed_at: pushedAt,
      status: studentRepo && isTargetBranch ? "pending" : "ignored",
    })
    .select()
    .single();

  if (insertErr) {
    // Unique constraint violation means this delivery was already processed
    if (insertErr.code === "23505") {
      return NextResponse.json({ message: "Duplicate delivery ignored" }, { status: 200 });
    }
    console.error("Error logging push event:", insertErr);
  }

  // 4. Mark repo_status as stale immediately
  if (studentRepo) {
    await supabaseAdmin
      .from("repo_status")
      .update({ stale: true })
      .eq("student_repo_id", studentRepo.id);
  }

  // 5. Asynchronously trigger analysis in background after responding with 202
  if (studentRepo && isTargetBranch) {
    after(async () => {
      try {
        await runRepoAnalysis(studentRepo.id, {
          forceRefresh: true,
          source: "webhook",
        });

        if (pushEvent) {
          await supabaseAdmin
            .from("push_events")
            .update({ status: "done" })
            .eq("id", pushEvent.id);
        }
      } catch (err: any) {
        console.error("Failed to process push webhook background analysis:", err);
        if (pushEvent) {
          await supabaseAdmin
            .from("push_events")
            .update({ status: "failed", error: err.message, attempts: 1 })
            .eq("id", pushEvent.id);
        }
      }
    });
  }

  return NextResponse.json({ message: "Webhook accepted" }, { status: 202 });
}
