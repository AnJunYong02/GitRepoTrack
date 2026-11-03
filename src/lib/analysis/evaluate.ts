import { checkReadmeKeywords, ReadmeCheckResult } from "./readme";

export interface RequiredFileRule {
  type: "glob_exists" | "path_exists";
  pattern?: string;
  path?: string;
  label?: string;
  description?: string;
}

export interface CriteriaRules {
  branch?: string;
  minCommits?: number;
  requiredFiles?: RequiredFileRule[];
  readmeKeywords?: string[];
  readme?: {
    required?: boolean;
    headerKeywords?: string[];
  };
}

export interface SnapshotData {
  treePaths: string[];
  readmeContent: string;
  commitCount?: number;
}

export interface FileCheckResult {
  label: string;
  satisfied: boolean;
  matchedPath?: string;
}

export interface EvaluationResult {
  submitted: boolean;
  filesSatisfied: boolean;
  readmeSatisfied: boolean;
  commitsSatisfied: boolean;
  minCommits: number;
  commitCount: number;
  fileResults: FileCheckResult[];
  readmeResults: ReadmeCheckResult;
}

/**
 * Simple glob matching for patterns like 'src/** /*.js' or 'src/** /*'
 */
function matchGlob(pattern: string, filePath: string): boolean {
  const normalizedPath = filePath.replace(/^\/+/, "");
  const normalizedPattern = pattern.replace(/^\/+/, "");

  if (normalizedPattern.endsWith("/**/*")) {
    const prefix = normalizedPattern.replace("/**/*", "");
    return normalizedPath.startsWith(prefix + "/") && normalizedPath.length > prefix.length + 1;
  }

  if (normalizedPattern.includes("/**/*.{")) {
    // e.g., src/**/*.{js,ts,py}
    const match = normalizedPattern.match(/^(.*?)\/\*\*\/\*\.\{(.*?)\}$/);
    if (match) {
      const prefix = match[1];
      const extensions = match[2].split(",").map((e) => e.trim());
      if (normalizedPath.startsWith(prefix + "/")) {
        return extensions.some((ext) => normalizedPath.endsWith(`.${ext}`));
      }
    }
  }

  // Exact path match
  return normalizedPath === normalizedPattern;
}

export function evaluateSnapshot(
  snapshot: SnapshotData,
  rules: CriteriaRules
): EvaluationResult {
  const fileResults: FileCheckResult[] = [];
  let filesSatisfied = true;

  if (rules.requiredFiles && rules.requiredFiles.length > 0) {
    for (const rule of rules.requiredFiles) {
      let satisfied = false;
      let matchedPath: string | undefined;

      if (rule.type === "path_exists" && rule.path) {
        satisfied = snapshot.treePaths.includes(rule.path);
        if (satisfied) matchedPath = rule.path;
      } else if (rule.type === "glob_exists" && rule.pattern) {
        const found = snapshot.treePaths.find((p) => matchGlob(rule.pattern!, p));
        if (found) {
          satisfied = true;
          matchedPath = found;
        }
      }

      fileResults.push({
        label: rule.label || rule.description || rule.pattern || rule.path || "src 디렉토리 내 소스 코드 존재",
        satisfied,
        matchedPath,
      });

      if (!satisfied) {
        filesSatisfied = false;
      }
    }
  }

  let readmeSatisfied = true;
  let readmeResults: ReadmeCheckResult = {
    satisfied: true,
    missingKeywords: [],
    details: [],
  };

  const requiredKeywords =
    rules.readmeKeywords ||
    rules.readme?.headerKeywords ||
    [];

  if (rules.readme?.required !== false && requiredKeywords.length > 0) {
    readmeResults = checkReadmeKeywords(snapshot.readmeContent, requiredKeywords);
    readmeSatisfied = readmeResults.satisfied;
  }

  const minCommits = rules.minCommits || 0;
  const commitCount = snapshot.commitCount || 0;
  const commitsSatisfied = minCommits <= 0 || commitCount >= minCommits;

  const submitted = filesSatisfied && readmeSatisfied && commitsSatisfied;

  return {
    submitted,
    filesSatisfied,
    readmeSatisfied,
    commitsSatisfied,
    minCommits,
    commitCount,
    fileResults,
    readmeResults,
  };
}
