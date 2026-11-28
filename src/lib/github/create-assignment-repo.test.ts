import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Octokit } from "@octokit/rest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: {} }));
import { seedFiles } from "./create-assignment-repo";

const plan = {
  assignment_id: "test-plan-id",
  created_at: "2026-11-28T00:00:00.000Z",
};
const commit = {
  sha: "initial",
  parents: [],
  commit: { message: "Initial commit", tree: { sha: "initial-tree" } },
};
const api = {
  rest: {
    repos: {
      get: vi.fn(),
      getCommit: vi.fn(),
      listCommits: vi.fn(),
      update: vi.fn(),
    },
    git: {
      createBlob: vi.fn(),
      createTree: vi.fn(),
      createCommit: vi.fn(),
      updateRef: vi.fn(),
      createRef: vi.fn(),
      getRef: vi.fn(),
    },
  },
  paginate: vi.fn(),
};

beforeEach(() => {
  vi.resetAllMocks();
  api.rest.repos.get.mockResolvedValue({ data: { default_branch: "main" } });
  api.rest.repos.getCommit.mockResolvedValue({ data: commit });
  api.paginate.mockResolvedValue([commit]);
  api.rest.git.createBlob.mockResolvedValue({ data: { sha: "blob" } });
  api.rest.git.createTree.mockResolvedValue({ data: { sha: "tree" } });
  api.rest.git.createCommit.mockResolvedValue({ data: { sha: "seed-commit" } });
});

describe("seeding initial files", () => {
  it("commits binary files and nested paths together, then advances main without force", async () => {
    await seedFiles(api as unknown as Octokit, "course", "week-1", plan, [
      { path: "assets/image.bin", content: "AP8=" },
    ]);
    expect(api.rest.git.createBlob).toHaveBeenCalledWith({
      owner: "course",
      repo: "week-1",
      content: "AP8=",
      encoding: "base64",
    });
    expect(api.rest.git.createTree).toHaveBeenCalledWith(
      expect.objectContaining({
        tree: [
          {
            path: "assets/image.bin",
            mode: "100644",
            type: "blob",
            sha: "blob",
          },
        ],
      }),
    );
    expect(api.rest.git.updateRef).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: "heads/main",
        sha: "seed-commit",
        force: false,
      }),
    );
  });

  it("does not replace student changes when retrying after a completed seed", async () => {
    api.paginate.mockResolvedValue([
      { commit: { message: "Student changes" } },
      { commit: { message: "RepoTrack initial files [test-plan-id]" } },
    ]);
    await seedFiles(api as unknown as Octokit, "course", "week-1", plan, []);
    expect(api.rest.git.createBlob).not.toHaveBeenCalled();
    expect(api.rest.git.updateRef).not.toHaveBeenCalled();
  });

  it("refuses to seed an existing modified repository without the marker", async () => {
    api.paginate.mockResolvedValue([
      commit,
      { commit: { message: "Unexpected change" } },
    ]);
    await expect(
      seedFiles(api as unknown as Octokit, "course", "week-1", plan, []),
    ).rejects.toThrow("덮어쓸 수 없습니다");
    expect(api.rest.git.createCommit).not.toHaveBeenCalled();
  });

  it("handles no file selection and an organization default branch named master", async () => {
    api.rest.repos.get.mockResolvedValue({
      data: { default_branch: "master" },
    });
    await seedFiles(api as unknown as Octokit, "course", "week-1", plan, []);
    expect(api.rest.git.createTree).not.toHaveBeenCalled();
    expect(api.rest.git.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({ tree: "initial-tree" }),
    );
    expect(api.rest.git.createRef).toHaveBeenCalledWith(
      expect.objectContaining({ ref: "refs/heads/main" }),
    );
    expect(api.rest.repos.update).toHaveBeenCalledWith(
      expect.objectContaining({ default_branch: "main" }),
    );
  });
});
