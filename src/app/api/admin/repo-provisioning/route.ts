import { NextResponse } from "next/server";
import { guardErrorStatus, requireOrgOwner } from "@/lib/auth/guards";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getInstallationOctokit, normalizeOrgName } from "@/lib/github/app";
import { isValidOrgSlug } from "@/lib/org/active-org";
import { loadOrgRoster } from "@/lib/roster/org-roster";
import {
  loadAssignmentPresets,
  CreationError,
} from "@/lib/assignments/creation-plan";
import {
  buildStudentRepoFromConvention,
  MAX_CREATION_REQUEST_BYTES,
  REPO_NAME_PATTERN,
  UUID_PATTERN,
  validateCreationSettings,
  validateCreationStudent,
  type PlannedStudent,
} from "@/lib/assignments/creation";
import {
  initialFilesManifest,
  validateInitialFiles,
} from "@/lib/github/initial-files";

export const runtime = "nodejs";
export const maxDuration = 60;

function readOrg(input: unknown) {
  const org = normalizeOrgName(typeof input === "string" ? input : "");
  if (!isValidOrgSlug(org)) throw new CreationError("과목을 선택하세요.");
  return org;
}

function creationErrorResponse(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (["PGRST205", "PGRST202", "42P01", "42883"].includes(code ?? "")) {
    return NextResponse.json(
      {
        error:
          "과제 생성 DB 설정이 필요합니다. assignment_creation_plans 마이그레이션을 적용하세요.",
      },
      { status: 503 },
    );
  }
  const status =
    error instanceof CreationError ? error.status : guardErrorStatus(error);
  const message =
    error instanceof CreationError
      ? error.message
      : status === 401
        ? "다시 로그인하세요."
        : status === 403
          ? "이 과목의 Owner만 과제를 생성할 수 있습니다."
          : "과제 생성 정보를 처리하지 못했습니다. 잠시 후 다시 시도하세요.";
  return NextResponse.json({ error: message }, { status });
}

/** Course roster and safe presets. File contents are never returned by this endpoint. */
export async function GET(req: Request) {
  try {
    const org = readOrg(new URL(req.url).searchParams.get("org"));
    await requireOrgOwner(org);
    const [students, presets] = await Promise.all([
      loadOrgRoster(org),
      loadAssignmentPresets(org),
    ]);
    return NextResponse.json({
      students: students.map(({ studentNo, name, githubLogin }) => ({
        studentNo,
        name,
        githubLogin,
      })),
      presets,
    });
  } catch (error) {
    return creationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const org = readOrg(new URL(req.url).searchParams.get("org"));
    const { user } = await requireOrgOwner(org);
    if (Number(req.headers.get("Content-Length")) > MAX_CREATION_REQUEST_BYTES)
      throw new CreationError("초기 파일을 포함한 요청이 너무 큽니다.");
    const text = await req.text();
    if (Buffer.byteLength(text) > MAX_CREATION_REQUEST_BYTES)
      throw new CreationError("초기 파일을 포함한 요청이 너무 큽니다.");
    let body;
    let settings;
    let files;
    try {
      body = JSON.parse(text);
      settings = validateCreationSettings(body.settings);
      files = validateInitialFiles(body.files);
    } catch (error) {
      throw new CreationError((error as Error).message);
    }
    if (!UUID_PATTERN.test(body.id ?? ""))
      throw new CreationError("생성 요청을 새로 시작하세요.");
    const roster = await loadOrgRoster(org);
    const rosterByNo = new Map(
      roster.map((student) => [student.studentNo, student]),
    );
    if (
      !Array.isArray(body.students) ||
      !body.students.length ||
      body.students.length > 2000
    )
      throw new CreationError("생성할 학생을 선택하세요.");
    const seenStudents = new Set<string>();
    const seenLogins = new Set<string>();
    const seenNames = new Set<string>();
    const students: PlannedStudent[] = body.students.map((value: unknown) => {
      if (!value || typeof value !== "object")
        throw new CreationError("생성할 학생 정보를 확인하세요.");
      const input = value as { studentNo?: string; repoName?: string };
      const rosterStudent = rosterByNo.get(input.studentNo ?? "");
      if (!rosterStudent)
        throw new CreationError(
          "과목 명단이 변경되었습니다. 학생 목록을 다시 불러오세요.",
        );
      let student;
      try {
        student = validateCreationStudent(rosterStudent);
      } catch (error) {
        throw new CreationError(
          `${rosterStudent.studentNo}: ${(error as Error).message}`,
        );
      }
      let repoName;
      try {
        repoName = buildStudentRepoFromConvention(
          settings.repoConvention ??
            `${org}-${settings.repoBase}-${settings.classCode}`,
          student.githubLogin,
        );
      } catch (error) {
        throw new CreationError((error as Error).message);
      }
      if (!REPO_NAME_PATTERN.test(repoName) || [".", ".."].includes(repoName))
        throw new CreationError(
          "미리보기의 저장소 이름을 확인하세요. 최대 100자까지 입력할 수 있습니다.",
        );
      if (
        seenStudents.has(student.studentNo) ||
        seenLogins.has(student.githubLogin.toLowerCase()) ||
        seenNames.has(repoName.toLowerCase())
      )
        throw new CreationError(
          "학번, GitHub 아이디 또는 저장소 이름이 중복되었습니다.",
        );
      seenStudents.add(student.studentNo);
      seenLogins.add(student.githubLogin.toLowerCase());
      seenNames.add(repoName.toLowerCase());
      return { ...student, repoName };
    });
    const octokit = await getInstallationOctokit(org);
    // Check name collisions before reserving an assignment. Read only this app's accessible repositories.
    const repos = await octokit.paginate(
      octokit.rest.apps.listReposAccessibleToInstallation,
      { per_page: 100 },
    );
    const byName = new Map(
      repos
        .filter((repo) => repo.owner.login.toLowerCase() === org.toLowerCase())
        .map((repo) => [repo.name.toLowerCase(), repo.description]),
    );
    for (const student of students) {
      if (
        byName.has(student.repoName.toLowerCase()) &&
        byName.get(student.repoName.toLowerCase()) !==
          `RepoTrack assignment ${body.id} / ${student.studentNo}`
      ) {
        throw new CreationError(
          `${student.repoName} 이름의 저장소가 이미 있습니다. 이름을 수정하세요.`,
          409,
        );
      }
    }
    const { error } = await supabaseAdmin.rpc("create_assignment_plan", {
      p_id: body.id,
      p_org: org,
      p_user: user.id,
      p_settings: settings,
      p_students: students,
      p_files: initialFilesManifest(files),
    });
    if (error?.code === "23505")
      throw new CreationError(
        "이 생성 요청이 이미 저장되었습니다. 새 과제 생성으로 다시 시작하세요.",
        409,
      );
    if (error) throw error;
    return NextResponse.json({ assignmentId: body.id });
  } catch (error) {
    return creationErrorResponse(error);
  }
}
