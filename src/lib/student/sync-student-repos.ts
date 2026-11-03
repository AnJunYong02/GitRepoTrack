import { supabaseAdmin } from "@/lib/supabase/admin";
import { getInstallationOctokit, normalizeOrgName } from "@/lib/github/app";
import { parseRepoName, ParsedRepoInfo } from "@/lib/github/repo-parser";

/**
 * Resolves the logged-in student's student_no (e.g. "22300743")
 * by checking user_metadata, existing student_repos, commit author history, or GitHub profile.
 */
export async function resolveStudentNo(user: any, profile: any): Promise<string | null> {
  if (!user) return null;

  // 1. Check user_metadata.student_no
  const metaStudentNo = user.user_metadata?.student_no?.trim();
  if (metaStudentNo && /^[0-9]{6,10}$/.test(metaStudentNo)) {
    return metaStudentNo;
  }

  // 2. Check already-linked student_repos
  const { data: linkedRepos } = await supabaseAdmin
    .from("student_repos")
    .select("student_no")
    .or(`profile_id.eq.${user.id},github_id.eq.${profile?.github_id || 0}`)
    .not("student_no", "is", null)
    .limit(1);

  const existingStudentNo = linkedRepos?.[0]?.student_no?.trim();
  if (existingStudentNo && /^[0-9]{6,10}$/.test(existingStudentNo)) {
    await saveStudentNoToMetadata(user.id, user.user_metadata, existingStudentNo);
    return existingStudentNo;
  }

  // 3. Check commit history by github_login
  const githubLogin = profile?.github_login || user.user_metadata?.user_name;
  if (githubLogin) {
    const { data: matchedCommits } = await supabaseAdmin
      .from("commits")
      .select("student_repo_id, student_repos(student_no)")
      .ilike("author_login", githubLogin)
      .limit(5);

    if (matchedCommits && matchedCommits.length > 0) {
      for (const c of matchedCommits) {
        const sr: any = Array.isArray(c.student_repos) ? c.student_repos[0] : c.student_repos;
        const commitStudentNo = sr?.student_no?.trim();
        if (commitStudentNo && /^[0-9]{6,10}$/.test(commitStudentNo)) {
          await saveStudentNoToMetadata(user.id, user.user_metadata, commitStudentNo);
          await syncReposForStudent(user.id, profile?.github_id, commitStudentNo, {
            scanOrgRepos: false,
          });
          return commitStudentNo;
        }
      }
    }
  }

  // 4. Check if GitHub login or display name contains an 8-digit student ID (e.g. 22300743)
  const candidateStrings = [
    githubLogin,
    user.user_metadata?.full_name,
    user.user_metadata?.name,
  ].filter(Boolean);

  for (const text of candidateStrings) {
    const match = String(text).match(/\b(2[0-9]{7})\b/);
    if (match) {
      const detectedNo = match[1];
      await saveStudentNoToMetadata(user.id, user.user_metadata, detectedNo);
      await syncReposForStudent(user.id, profile?.github_id, detectedNo, {
        scanOrgRepos: true,
      });
      return detectedNo;
    }
  }

  return null;
}

export async function saveStudentNoToMetadata(
  userId: string,
  currentMetadata: Record<string, any> | undefined,
  studentNo: string
) {
  try {
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(currentMetadata || {}),
        student_no: studentNo,
      },
    });
  } catch (err) {
    console.warn("[saveStudentNoToMetadata] Failed to update user metadata:", err);
  }
}

/**
 * Links all DB `student_repos` matching `studentNo` to `userId`,
 * and optionally scans the GitHub Organization to import any missing repositories for this `studentNo`.
 */
export async function syncReposForStudent(
  userId: string,
  githubId: number | undefined,
  studentNo: string,
  options: { scanOrgRepos?: boolean } = { scanOrgRepos: true }
): Promise<{ linkedCount: number; syncedFromOrg: number }> {
  const cleanNo = studentNo.trim();
  if (!/^[0-9]{6,10}$/.test(cleanNo)) {
    throw new Error("유효한 학번 형식(숫자 6~10자리, 예: 22300743)을 입력해주세요.");
  }

  // 1. Link existing student_repos in DB that match student_no or repo name suffix
  const { data: matchingDbRepos } = await supabaseAdmin
    .from("student_repos")
    .select("id, student_no, profile_id")
    .or(`student_no.eq.${cleanNo},full_name.ilike.%-${cleanNo},full_name.ilike.%_${cleanNo}`);

  let linkedCount = 0;
  if (matchingDbRepos && matchingDbRepos.length > 0) {
    const idsToUpdate = matchingDbRepos.map((r) => r.id);
    const { error: updateErr } = await supabaseAdmin
      .from("student_repos")
      .update({
        profile_id: userId,
        student_no: cleanNo,
      })
      .in("id", idsToUpdate);

    if (!updateErr) {
      linkedCount = idsToUpdate.length;
    }
  }

  let syncedFromOrg = 0;

  // 2. Scan GitHub Organization for any repos belonging to this studentNo
  if (options.scanOrgRepos) {
    try {
      const targetOrg = normalizeOrgName(process.env.GITHUB_ORG_NAME || "2026-2-WebService");
      const octokit = await getInstallationOctokit(targetOrg);

      let allRepos: any[] = [];
      let page = 1;
      while (true) {
        const { data } = await octokit.rest.apps.listReposAccessibleToInstallation({
          per_page: 100,
          page,
        });
        allRepos.push(...data.repositories);
        if (allRepos.length >= data.total_count || data.repositories.length < 100) {
          break;
        }
        page++;
      }

      const studentOrgRepos: ParsedRepoInfo[] = [];
      for (const r of allRepos) {
        const parsed = parseRepoName({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          html_url: r.html_url,
          updated_at: r.updated_at,
        });
        if (parsed.studentNo === cleanNo && parsed.category !== "other") {
          studentOrgRepos.push(parsed);
        }
      }

      if (studentOrgRepos.length > 0) {
        // Fetch all existing assignments
        const { data: existingAssignments } = await supabaseAdmin
          .from("assignments")
          .select("id, title, branch, org_name");

        const assignmentsList = [...(existingAssignments || [])];

        for (const parsedRepo of studentOrgRepos) {
          // Find or create assignment for this category
          let matchedAssignment = assignmentsList.find(
            (a) =>
              a.title.toLowerCase().includes(parsedRepo.category.toLowerCase()) ||
              a.title.toLowerCase().includes(parsedRepo.categoryLabel.toLowerCase())
          );

          if (!matchedAssignment) {
            const numMatch = parsedRepo.category.match(/([0-9]+)/);
            const defaultTitle = numMatch
              ? parsedRepo.category.includes("midterm")
                ? `웹서비스 개발 ${parseInt(numMatch[1], 10)}차 중간고사 (${parsedRepo.category})`
                : `웹서비스 개발 ${parseInt(numMatch[1], 10)}차 과제 (${parsedRepo.category})`
              : `과제 (${parsedRepo.category})`;

            const { data: newAssignment } = await supabaseAdmin
              .from("assignments")
              .insert({
                title: defaultTitle,
                org_name: targetOrg,
                branch: "main",
                deadline_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                ranking_mode: "live",
                ranking_started_at: new Date().toISOString(),
              })
              .select("id, title, branch, org_name")
              .single();

            if (newAssignment) {
              matchedAssignment = newAssignment;
              assignmentsList.push(newAssignment);

              const defaultRules = {
                branch: "main",
                minCommits: 0,
                requiredFiles: [
                  {
                    type: "glob_exists",
                    pattern: "src/**/*",
                    label: "src 디렉토리 내 소스 코드 존재",
                    description: "src 디렉토리 내 소스 코드 존재",
                  },
                ],
                readmeKeywords: [],
                readme: {
                  required: true,
                  headerKeywords: [],
                },
                codeChecks: [],
              };

              const { data: criteriaVer } = await supabaseAdmin
                .from("criteria_versions")
                .insert({
                  assignment_id: newAssignment.id,
                  version: 1,
                  rules: defaultRules,
                })
                .select("id")
                .single();

              if (criteriaVer) {
                await supabaseAdmin
                  .from("assignments")
                  .update({ current_criteria_version_id: criteriaVer.id })
                  .eq("id", newAssignment.id);
              }
            }
          }

          if (matchedAssignment) {
            // Check if this repo is already in student_repos for this assignment
            const { data: existingSr } = await supabaseAdmin
              .from("student_repos")
              .select("id, profile_id")
              .eq("assignment_id", matchedAssignment.id)
              .or(`repo_id.eq.${parsedRepo.repoId},student_no.eq.${cleanNo}`)
              .maybeSingle();

            if (existingSr) {
              await supabaseAdmin
                .from("student_repos")
                .update({
                  profile_id: userId,
                  student_no: cleanNo,
                  full_name: parsedRepo.fullName,
                  repo_id: parsedRepo.repoId,
                })
                .eq("id", existingSr.id);
              syncedFromOrg++;
            } else {
              const fallbackGithubId = !isNaN(Number(cleanNo))
                ? Number(cleanNo)
                : githubId || parsedRepo.repoId;

              const { data: insertedSr } = await supabaseAdmin
                .from("student_repos")
                .upsert(
                  {
                    assignment_id: matchedAssignment.id,
                    full_name: parsedRepo.fullName,
                    student_no: cleanNo,
                    github_id: fallbackGithubId,
                    profile_id: userId,
                    repo_id: parsedRepo.repoId,
                  },
                  {
                    onConflict: "assignment_id,github_id",
                  }
                )
                .select("id")
                .single();

              if (insertedSr) {
                await supabaseAdmin.from("repo_status").upsert({
                  student_repo_id: insertedSr.id,
                  stale: true,
                  updated_at: new Date().toISOString(),
                });
                syncedFromOrg++;
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn("[syncReposForStudent] Organization scan warning:", err);
    }
  }

  return {
    linkedCount: Math.max(linkedCount, syncedFromOrg),
    syncedFromOrg,
  };
}
