import { Octokit } from "@octokit/rest";
import { getInstallationOctokit } from "./app";

export interface FetchedCommit {
  sha: string;
  committedAt: string;
  authorLogin: string;
  message: string;
}

export interface FetchedRepoData {
  headSha: string;
  treePaths: string[];
  readmeContent: string;
  commits: FetchedCommit[];
  commitCount: number;
}

export async function fetchRepoSnapshot(
  owner: string,
  repo: string,
  branch: string = "main"
): Promise<FetchedRepoData> {
  const octokit = await getInstallationOctokit(owner);

  // 1. Get branch HEAD commit with fallback for empty repos or alternate branch (e.g. master)
  let headSha = "";
  try {
    const { data: branchData } = await octokit.rest.repos.getBranch({
      owner,
      repo,
      branch,
    });
    headSha = branchData.commit.sha;
  } catch (err: any) {
    if (err.status === 404) {
      try {
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        if (repoData.size === 0) {
          // Empty repo (no commits at all)
          return {
            headSha: "empty",
            treePaths: [],
            readmeContent: "",
            commits: [],
            commitCount: 0,
          };
        }

        // Fallback to default branch or alternate branch (e.g. master)
        const altBranch =
          repoData.default_branch && repoData.default_branch !== branch
            ? repoData.default_branch
            : branch === "main"
            ? "master"
            : "main";

        const { data: altBranchData } = await octokit.rest.repos.getBranch({
          owner,
          repo,
          branch: altBranch,
        });
        headSha = altBranchData.commit.sha;
      } catch {
        // Empty repo or no branches exist
        return {
          headSha: "empty",
          treePaths: [],
          readmeContent: "",
          commits: [],
          commitCount: 0,
        };
      }
    } else {
      throw err;
    }
  }

  if (!headSha || headSha === "empty") {
    return {
      headSha: "empty",
      treePaths: [],
      readmeContent: "",
      commits: [],
      commitCount: 0,
    };
  }

  // 2. Get recursive tree
  let treePaths: string[] = [];
  try {
    const { data: treeData } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: headSha,
      recursive: "1",
    });
    treePaths = treeData.tree.map((item) => item.path || "").filter(Boolean);
  } catch (err) {
    console.warn(`Could not fetch git tree for ${owner}/${repo}:`, err);
  }

  // 3. Get README
  let readmeContent = "";
  try {
    const { data: readmeData } = await octokit.rest.repos.getReadme({
      owner,
      repo,
      ref: headSha,
    });
    if (readmeData.content) {
      readmeContent = Buffer.from(readmeData.content, "base64").toString("utf-8");
    }
  } catch {
    // README might not exist, which is a valid evaluation state
  }

  // 4. Get commits
  const commits: FetchedCommit[] = [];
  let commitCount = 0;
  try {
    const { data: commitsData } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      sha: headSha,
      per_page: 100,
    });
    commitCount = commitsData.length;
    for (const c of commitsData) {
      commits.push({
        sha: c.sha,
        committedAt: c.commit.committer?.date || c.commit.author?.date || new Date().toISOString(),
        authorLogin: c.author?.login || c.commit.author?.name || "unknown",
        message: c.commit.message || "",
      });
    }
  } catch (err) {
    console.warn(`Could not fetch commits for ${owner}/${repo}:`, err);
  }

  return {
    headSha,
    treePaths,
    readmeContent,
    commits,
    commitCount,
  };
}
