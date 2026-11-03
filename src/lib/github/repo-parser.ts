export interface ParsedRepoInfo {
  repoId: number;
  name: string;
  fullName: string;
  category: string; // e.g. "assign01", "assign02", "other"
  categoryLabel: string; // e.g. "과제 1차 (assign01)"
  studentNo: string | null; // e.g. "22100063"
  classCode: string | null; // e.g. "c01"
  isStudentRepo: boolean;
  htmlUrl?: string;
  updatedAt?: string;
}

/**
 * Normalizes category key (e.g. "assign1" -> "assign01", "assign08_midterm" -> "assign08_midterm")
 */
export function normalizeCategoryKey(prefix: string): string {
  const clean = prefix.toLowerCase().replace(/[^a-z0-9_]/g, "");
  const numMatch = clean.match(/(?:assign|assignment)?([0-9]+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    const padded = num < 10 ? `0${num}` : `${num}`;
    if (clean.includes("midterm")) {
      return `assign${padded}_midterm`;
    }
    return `assign${padded}`;
  }
  if (clean.includes("midterm")) {
    return "assign08_midterm";
  }
  return clean || "other";
}

function buildCategoryLabel(category: string): string {
  const numMatch = category.match(/([0-9]+)/);
  if (numMatch) {
    const num = parseInt(numMatch[1], 10);
    if (category.includes("midterm")) {
      return `과제 ${num}차 중간고사 (${category})`;
    }
    return `과제 ${num}차 (${category})`;
  }
  return category;
}

/**
 * Parses repository names like `assign1-c01-22100063`, `assign01-c01-21800001`, `assign08_midterm-c01-22100063`
 */
export function parseRepoName(repo: {
  id: number;
  name: string;
  full_name: string;
  html_url?: string;
  updated_at?: string;
}): ParsedRepoInfo {
  const name = repo.name.trim();

  // Pattern 1: prefix - classCode - studentNo (e.g. assign1-c01-22100063, assign08_midterm-c01-22100063)
  const pattern1 = name.match(/^([a-zA-Z0-9_]+?)[-_]([a-zA-Z0-9]+)[-_]([0-9]{6,10})$/);
  if (pattern1) {
    const rawCategory = pattern1[1];
    const classCode = pattern1[2];
    const studentNo = pattern1[3];
    const category = normalizeCategoryKey(rawCategory);
    const categoryLabel = buildCategoryLabel(category);

    return {
      repoId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      category,
      categoryLabel,
      studentNo,
      classCode,
      isStudentRepo: true,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
    };
  }

  // Pattern 2: prefix - studentNo (e.g. assign01-22100063, assign2_22100063)
  const pattern2 = name.match(/^([a-zA-Z0-9_]+?)[-_]([0-9]{6,10})$/);
  if (pattern2) {
    const rawCategory = pattern2[1];
    const studentNo = pattern2[2];
    const category = normalizeCategoryKey(rawCategory);
    const categoryLabel = buildCategoryLabel(category);

    return {
      repoId: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      category,
      categoryLabel,
      studentNo,
      classCode: null,
      isStudentRepo: true,
      htmlUrl: repo.html_url,
      updatedAt: repo.updated_at,
    };
  }

  return {
    repoId: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    category: "other",
    categoryLabel: "기타 / 강의자료",
    studentNo: null,
    classCode: null,
    isStudentRepo: false,
    htmlUrl: repo.html_url,
    updatedAt: repo.updated_at,
  };
}
