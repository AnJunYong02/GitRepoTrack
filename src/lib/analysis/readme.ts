export interface KeywordDetail {
  keyword: string;
  found: boolean;
}

export interface ReadmeCheckResult {
  satisfied: boolean;
  missingKeywords: string[];
  details: KeywordDetail[];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts markdown heading lines (#, ##, ###), bold leading labels (**Keyword**:),
 * and list items with leading keywords (- Keyword, 1. Keyword, etc.)
 */
export function extractHeadingLines(content: string): string[] {
  if (!content) return [];

  const lines = content.split(/\r?\n/);
  const headings: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Matches markdown headings: # Heading, ## Heading, etc.
    if (/^#{1,6}\s+/.test(trimmed)) {
      headings.push(trimmed.replace(/^#{1,6}\s+/, "").trim());
      continue;
    }

    // Matches bullet (- * +) or numbered (1. 2. 1) 2)) list items
    const listMatch = trimmed.match(/^([-*+]|\d+[.)])\s+(.*)/);
    if (listMatch && listMatch[2]) {
      let listContent = listMatch[2].trim();
      // Remove leading bold tags if present: **Keyword**: or **Keyword**
      listContent = listContent.replace(/^(\*\*|__)(.*?)\1[:\s]*/, "$2 ");
      headings.push(listContent.trim());
      continue;
    }

    // Matches leading bold labels: **Key Learning**: or __Key Learning__:
    const boldLabelMatch = trimmed.match(/^(\*\*|__)(.*?)\1[:\s]/);
    if (boldLabelMatch && boldLabelMatch[2]) {
      headings.push(boldLabelMatch[2].trim());
    }
  }

  return headings;
}

/**
 * Evaluates whether the required heading keywords exist in the README.
 * Matching is case-insensitive and ignores extra whitespace.
 */
export function checkReadmeKeywords(
  readmeContent: string,
  requiredKeywords: string[]
): ReadmeCheckResult {
  if (!requiredKeywords || requiredKeywords.length === 0) {
    return {
      satisfied: true,
      missingKeywords: [],
      details: [],
    };
  }

  if (!readmeContent || readmeContent.trim().length === 0) {
    return {
      satisfied: false,
      missingKeywords: [...requiredKeywords],
      details: requiredKeywords.map((k) => ({ keyword: k, found: false })),
    };
  }

  const headingLines = extractHeadingLines(readmeContent);

  const details: KeywordDetail[] = requiredKeywords.map((keyword) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return { keyword, found: true };

    const escaped = escapeRegex(trimmedKeyword);
    // Matches keyword within heading line as a discrete phrase
    const regex = new RegExp(`(^|[^a-zA-Z0-9가-힣])${escaped}($|[^a-zA-Z0-9가-힣])`, "i");

    const found = headingLines.some((heading) => regex.test(heading));
    return {
      keyword: trimmedKeyword,
      found,
    };
  });

  const missingKeywords = details.filter((d) => !d.found).map((d) => d.keyword);

  return {
    satisfied: missingKeywords.length === 0,
    missingKeywords,
    details,
  };
}
