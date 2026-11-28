import "server-only";

import type { Octokit } from "@octokit/rest";
import type { InitialFile, PlannedStudent } from "@/lib/assignments/creation";
import type { CreationPlan } from "@/lib/assignments/creation-plan";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface CreationResult {
  studentNo: string;
  repoName: string;
  ok: boolean;
  error?: string;
  fullName?: string;
}

function githubFailure(error: unknown) {
  const value = error as { status?: number; message?: string };
  if (value.status === 403)
    return "GitHub App의 Administration·Contents 쓰기 권한과 초대 제한을 확인하세요.";
  if (value.status === 404)
    return "GitHub 아이디 또는 GitHub App의 저장소 접근 권한을 확인하세요.";
  if (value.status === 422)
    return "저장소 이름 또는 GitHub 조직의 생성·초대 제한을 확인하세요.";
  if (value.status === 409) return "저장소가 변경되었습니다. 다시 시도하세요.";
  return error instanceof Error && !value.status
    ? error.message
    : "GitHub 요청에 실패했습니다. 다시 시도하세요.";
}

/** Create one repository, seed one commit, invite its student and register the mapping.
 * The description marker permits retries only for repositories created by this plan.
 */
export async function createAssignmentRepo(
  octokit: Octokit,
  plan: CreationPlan,
  student: PlannedStudent,
  files: InitialFile[],
): Promise<CreationResult> {
  const owner = plan.org_name;
  const repo = student.repoName;
  const description = `RepoTrack assignment ${plan.assignment_id} / ${student.studentNo}`;
  try {
    const { data: account } = await octokit.rest.users.getByUsername({
      username: student.githubLogin,
    });
    if (account.type !== "User")
      throw new Error("학생 GitHub 아이디는 개인 계정이어야 합니다.");
    const { data: existingMapping, error: lookupError } = await supabaseAdmin
      .from("student_repos")
      .select("id, repo_id, full_name")
      .eq("assignment_id", plan.assignment_id)
      .eq("github_id", account.id)
      .maybeSingle();
    if (lookupError) throw new Error("과제 저장 정보를 확인하지 못했습니다.");
    if (
      existingMapping &&
      existingMapping.full_name.toLowerCase() !==
        `${owner}/${repo}`.toLowerCase()
    ) {
      throw new Error("이 GitHub 계정에 다른 저장소가 이미 배정되었습니다.");
    }
    let repository;
    try {
      const result = await octokit.rest.repos.get({ owner, repo });
      if (result.data.description !== description)
        throw new Error(
          "같은 이름의 기존 저장소가 있습니다. 다른 이름으로 새 과제를 생성하세요.",
        );
      repository = result.data;
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
      try {
        const { data } = await octokit.rest.repos.createInOrg({
          org: owner,
          name: repo,
          private: true,
          auto_init: true,
          description,
        });
        repository = data;
      } catch (createError) {
        if ((createError as { status?: number }).status !== 422)
          throw createError;
        const { data } = await octokit.rest.repos.get({ owner, repo });
        if (data.description !== description)
          throw new Error("같은 이름의 기존 저장소가 있습니다.");
        repository = data;
      }
    }

    await seedFiles(octokit, owner, repo, plan, files);
    if (repository.default_branch !== "main")
      await octokit.rest.repos.update({ owner, repo, default_branch: "main" });
    await octokit.rest.repos.addCollaborator({
      owner,
      repo,
      username: account.login,
      permission: "push",
    });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("github_id", account.id)
      .maybeSingle();
    if (profileError)
      throw new Error("학생 계정 연결에 실패했습니다. 다시 시도하세요.");
    const { data: mapping, error } = await supabaseAdmin
      .from("student_repos")
      .upsert(
        {
          assignment_id: plan.assignment_id,
          profile_id: profile?.id ?? null,
          github_id: account.id,
          repo_id: repository.id,
          full_name: repository.full_name,
          student_no: student.studentNo,
          student_name: student.name,
        },
        { onConflict: "assignment_id,github_id" },
      )
      .select("id")
      .single();
    if (error || !mapping)
      throw new Error(
        "저장소는 생성되었지만 과제 연결에 실패했습니다. 다시 시도하세요.",
      );
    const { error: statusError } = await supabaseAdmin
      .from("repo_status")
      .upsert({
        student_repo_id: mapping.id,
        stale: true,
        updated_at: new Date().toISOString(),
      });
    if (statusError)
      throw new Error("과제 분석 상태 저장에 실패했습니다. 다시 시도하세요.");
    return {
      studentNo: student.studentNo,
      repoName: repo,
      fullName: repository.full_name,
      ok: true,
    };
  } catch (error) {
    return {
      studentNo: student.studentNo,
      repoName: repo,
      ok: false,
      error: githubFailure(error),
    };
  }
}

export async function seedFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  plan: Pick<CreationPlan, "assignment_id" | "created_at">,
  files: InitialFile[],
) {
  const seedMessage = `RepoTrack initial files [${plan.assignment_id}]`;
  const { data: repository } = await octokit.rest.repos.get({ owner, repo });
  const branch = repository.default_branch;
  const { data: head } = await octokit.rest.repos.getCommit({
    owner,
    repo,
    ref: branch,
  });
  // The seed commit remains an ancestor after students push, so retries never overwrite their work.
  const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
    owner,
    repo,
    sha: branch,
    per_page: 100,
  });
  if (commits.some((commit) => commit.commit.message === seedMessage)) return;
  if (commits.length !== 1 || head.parents.length !== 0)
    throw new Error("학생이 수정한 저장소에는 초기 파일을 덮어쓸 수 없습니다.");
  const entries = [];
  for (const file of files) {
    const { data: blob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: file.content,
      encoding: "base64",
    });
    entries.push({
      path: file.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blob.sha,
    });
  }
  // An empty file selection still gets a marker commit, so retry detection is stable.
  const treeSha = entries.length
    ? (
        await octokit.rest.git.createTree({
          owner,
          repo,
          base_tree: head.commit.tree.sha,
          tree: entries,
        })
      ).data.sha
    : head.commit.tree.sha;
  const { data: commit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message: seedMessage,
    tree: treeSha,
    parents: [head.sha],
    author: {
      name: "RepoTrack",
      email: "repotrack@users.noreply.github.com",
      date: plan.created_at,
    },
    committer: {
      name: "RepoTrack",
      email: "repotrack@users.noreply.github.com",
      date: plan.created_at,
    },
  });
  if (branch === "main")
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: "heads/main",
      sha: commit.sha,
      force: false,
    });
  else {
    try {
      await octokit.rest.git.createRef({
        owner,
        repo,
        ref: "refs/heads/main",
        sha: commit.sha,
      });
    } catch (error) {
      if ((error as { status?: number }).status !== 422) throw error;
      const { data } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: "heads/main",
      });
      if (data.object.sha !== commit.sha)
        throw new Error(
          "main 브랜치가 변경되었습니다. 초기 파일을 덮어쓰지 않았습니다.",
        );
    }
    await octokit.rest.repos.update({ owner, repo, default_branch: "main" });
  }
}
