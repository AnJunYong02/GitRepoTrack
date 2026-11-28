import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  owner: vi.fn(),
  roster: vi.fn(),
  github: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: { rpc: mocks.rpc } }));
vi.mock("@/lib/auth/guards", () => ({
  requireOrgOwner: mocks.owner,
  guardErrorStatus: () => 403,
}));
vi.mock("@/lib/roster/org-roster", () => ({ loadOrgRoster: mocks.roster }));
vi.mock("@/lib/github/app", () => ({
  normalizeOrgName: (value: string) => value.trim(),
  getInstallationOctokit: async () => ({
    rest: { apps: { listReposAccessibleToInstallation: {} } },
    paginate: mocks.github,
  }),
}));
vi.mock("@/lib/org/active-org", () => ({
  isValidOrgSlug: (value: string) => value === "course",
}));
import { POST } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.mockResolvedValue({ user: { id: "teacher" } });
  mocks.roster.mockResolvedValue([
    { studentNo: "00123456", name: "가상학생 A", githubLogin: "test-a" },
    { studentNo: "00123457", name: "가상학생 B", githubLogin: "test-b" },
  ]);
  mocks.github.mockResolvedValue([]);
  mocks.rpc.mockResolvedValue({ data: "plan-id", error: null });
});

function upload(
  students = [
    { studentNo: "00123456", repoName: "untrusted-name" },
    { studentNo: "00123457", repoName: "other-name" },
  ],
) {
  return POST(
    new Request("http://localhost/api/admin/repo-provisioning?org=course", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: "11111111-1111-4111-8111-111111111111",
        settings: {
          title: "과제",
          repoBase: "assignment01",
          repoConvention: "course-edited-c02",
          classCode: "2",
          deadlineAt: "2026-12-05T14:59:00Z",
          keywords: [],
          minCommits: 0,
          readmeRequired: true,
        },
        students,
        files: [],
      }),
    }),
  );
}

describe("creation planning", () => {
  it("derives every repository from the single edited convention and stored roster", async () => {
    const response = await upload();
    expect(response.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(
      "create_assignment_plan",
      expect.objectContaining({
        p_org: "course",
        p_user: "teacher",
        p_students: [
          {
            studentNo: "00123456",
            name: "가상학생 A",
            githubLogin: "test-a",
            repoName: "course-edited-c02-test-a",
          },
          {
            studentNo: "00123457",
            name: "가상학생 B",
            githubLogin: "test-b",
            repoName: "course-edited-c02-test-b",
          },
        ],
      }),
    );
  });
  it("checks course authorization before reading student data or calling GitHub", async () => {
    mocks.owner.mockRejectedValue(new Error("Forbidden"));
    expect((await upload()).status).toBe(403);
    expect(mocks.roster).not.toHaveBeenCalled();
    expect(mocks.github).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("does not create a plan for students outside the course roster", async () => {
    expect(
      (await upload([{ studentNo: "99999999", repoName: "invalid" }])).status,
    ).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
