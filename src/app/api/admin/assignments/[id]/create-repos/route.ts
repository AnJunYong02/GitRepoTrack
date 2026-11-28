import { NextResponse } from "next/server";
import { guardErrorStatus, requireAssignmentOwner } from "@/lib/auth/guards";
import { getInstallationOctokit } from "@/lib/github/app";
import {
  CreationError,
  loadCreationPlan,
} from "@/lib/assignments/creation-plan";
import { MAX_CREATION_REQUEST_BYTES } from "@/lib/assignments/creation";
import {
  initialFilesManifest,
  validateInitialFiles,
} from "@/lib/github/initial-files";
import { createAssignmentRepo } from "@/lib/github/create-assignment-repo";
import { safeRevalidateTag } from "@/lib/cache/shared-cache";
import { orgReposTag } from "@/lib/cache/cache-keys";

export const runtime = "nodejs";
export const maxDuration = 300;

/** One student at a time bounds GitHub requests and makes partial failures retryable. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { user, assignment } = await requireAssignmentOwner(id);
    const plan = await loadCreationPlan(id);
    if (!plan)
      throw new CreationError(
        "이 과제의 생성 설정이 없습니다. 과제 생성을 새로 시작하세요.",
      );
    if (
      plan.created_by !== user.id ||
      plan.created_by !== assignment.created_by
    )
      throw new CreationError("이 과제를 생성한 계정으로 진행하세요.", 403);
    if (Number(req.headers.get("Content-Length")) > MAX_CREATION_REQUEST_BYTES)
      throw new CreationError("초기 파일이 너무 큽니다.");
    const raw = await req.text();
    if (Buffer.byteLength(raw) > MAX_CREATION_REQUEST_BYTES)
      throw new CreationError("초기 파일이 너무 큽니다.");
    let body;
    let files;
    try {
      body = JSON.parse(raw);
      files = validateInitialFiles(body.files);
    } catch {
      throw new CreationError("초기 파일을 다시 확인하세요.");
    }
    if (
      JSON.stringify(initialFilesManifest(files)) !== JSON.stringify(plan.files)
    )
      throw new CreationError(
        "초기 파일이 변경되었습니다. 원래 선택한 파일로 다시 시도하세요.",
        409,
      );
    const student = plan.students.find(
      (student) => student.studentNo === body.studentNo,
    );
    if (!student)
      throw new CreationError("이 과제의 생성 대상에 없는 학생입니다.");
    const octokit = await getInstallationOctokit(plan.org_name);
    const result = await createAssignmentRepo(octokit, plan, student, files);
    safeRevalidateTag(orgReposTag(plan.org_name));
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CreationError
            ? error.message
            : "저장소 생성에 실패했습니다. 다시 시도하세요.",
      },
      {
        status:
          error instanceof CreationError
            ? error.status
            : guardErrorStatus(error),
      },
    );
  }
}
