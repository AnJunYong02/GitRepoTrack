/** Shared form validation. No credentials or file-system access. */
export interface CreationStudent {
  studentNo: string;
  name: string;
  githubLogin: string;
}

export interface PlannedStudent extends CreationStudent {
  repoName: string;
}

export interface InitialFile {
  path: string;
  content: string; // base64, including binary files
}

export interface CreationSettings {
  repoConvention?: string;
  repoBase: string;
  classCode: string;
  title: string;
  deadlineAt: string;
  keywords: string[];
  minCommits: number;
  readmeRequired: boolean;
}

export interface AssignmentPreset extends CreationSettings {
  id: string;
  studentNos?: string[];
}

export const MAX_INITIAL_FILE_BYTES = 2 * 1024 * 1024;
export const MAX_INITIAL_FILES = 100;
export const MAX_CREATION_REQUEST_BYTES = 4 * 1024 * 1024;
export const REPO_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,100}$/;
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeClassCode(input: string): string | null {
  const match = /^(?:c)?0*([1-9][0-9]?)$/i.exec(input.trim());
  return match ? `c${match[1].padStart(2, "0")}` : null;
}

export function validateCreationStudent(input: unknown): CreationStudent {
  const value = input as Partial<CreationStudent> | null;
  const studentNo =
    typeof value?.studentNo === "string" ? value.studentNo.trim() : "";
  const name = typeof value?.name === "string" ? value.name.trim() : "";
  const githubLogin =
    typeof value?.githubLogin === "string"
      ? value.githubLogin.trim().replace(/^@/, "")
      : "";
  if (!/^[0-9]{6,10}$/.test(studentNo))
    throw new Error("학번은 숫자 6~10자리로 입력하세요.");
  if (!name || name.length > 100 || /[\r\n]/.test(name))
    throw new Error("학생 이름은 1~100자로 입력하세요.");
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(githubLogin) ||
    githubLogin.length > 39
  ) {
    throw new Error("GitHub 아이디를 확인하세요. 이메일은 사용할 수 없습니다.");
  }
  return { studentNo, name, githubLogin };
}

export function parseKeywords(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[,\r\n]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  ];
}

export function buildCreationRepoName(
  org: string,
  repoBase: string,
  classCode: string,
  githubLogin: string,
) {
  return `${org}-${repoBase}-${classCode}-${githubLogin}`;
}

export function buildStudentRepoFromConvention(
  convention: string,
  githubLogin: string,
) {
  const name = `${convention.trim()}-${githubLogin}`;
  if (!REPO_NAME_PATTERN.test(name))
    throw new Error(
      "공통 레포 이름과 GitHub 아이디를 합쳐 100자 이내로 입력하세요.",
    );
  return name;
}

export function validateCreationSettings(input: unknown): CreationSettings {
  const value = input as Partial<CreationSettings> | null;
  const repoBase =
    typeof value?.repoBase === "string" ? value.repoBase.trim() : "";
  const title = typeof value?.title === "string" ? value.title.trim() : "";
  const classCode =
    typeof value?.classCode === "string"
      ? normalizeClassCode(value.classCode)
      : null;
  const deadline =
    typeof value?.deadlineAt === "string" ? new Date(value.deadlineAt) : null;
  if (
    !REPO_NAME_PATTERN.test(repoBase) ||
    repoBase === "." ||
    repoBase === ".."
  )
    throw new Error(
      "레포 이름은 영문, 숫자, 하이픈, 밑줄, 마침표로 입력하세요.",
    );
  if (!title || title.length > 120)
    throw new Error("과제 이름은 1~120자로 입력하세요.");
  if (!classCode) throw new Error("분반은 1~99 또는 c01~c99로 입력하세요.");
  if (!deadline || !Number.isFinite(deadline.getTime()))
    throw new Error("마감 기한을 확인하세요.");
  if (
    !Array.isArray(value?.keywords) ||
    value.keywords.length > 100 ||
    value.keywords.some(
      (keyword) =>
        typeof keyword !== "string" || !keyword.trim() || keyword.length > 200,
    )
  ) {
    throw new Error("README 검사 단어는 최대 100개, 각 200자까지 입력하세요.");
  }
  const repoConvention =
    typeof value.repoConvention === "string"
      ? value.repoConvention.trim()
      : undefined;
  if (
    repoConvention !== undefined &&
    (!REPO_NAME_PATTERN.test(repoConvention) ||
      [".", ".."].includes(repoConvention))
  )
    throw new Error("공통 레포 이름을 확인하세요.");
  const minCommits = value.minCommits ?? 0;
  if (
    !Number.isSafeInteger(minCommits) ||
    minCommits < 0 ||
    minCommits > 100000
  )
    throw new Error("최소 커밋 수를 확인하세요.");
  return {
    ...(repoConvention !== undefined ? { repoConvention } : {}),
    repoBase,
    title,
    classCode,
    deadlineAt: deadline.toISOString(),
    keywords: [...new Set(value.keywords.map((word) => word.trim()))],
    minCommits,
    readmeRequired: value.readmeRequired !== false,
  };
}

export function validateInitialFilePath(path: string) {
  if (
    !path ||
    path.length > 240 ||
    /[\\\u0000-\u001f]/.test(path) ||
    path.startsWith("/") ||
    /^[A-Za-z]:/.test(path)
  ) {
    throw new Error("업로드할 파일 경로를 확인하세요.");
  }
  const parts = path.split("/");
  if (
    parts.some(
      (part) =>
        !part || part === "." || part === ".." || part.toLowerCase() === ".git",
    )
  ) {
    throw new Error(".git 폴더와 상대 경로는 업로드할 수 없습니다.");
  }
}
