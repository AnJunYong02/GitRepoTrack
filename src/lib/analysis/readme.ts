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

// 영문/숫자 리스트 마커: "- ", "* ", "+ ", "1. ", "2) "
const ASCII_LIST_REGEX = /^([-*+]|\d+[.)])\s+(.*)/;

// 원문자·유니코드 번호(①~⑳, ⑴~⒇, ⒈~⒛, ⓪~⓿, ❶~❿, ㉑~㉟, ㊱~㊿, ㉠~㉻, Ⅰ~Ⅻ 등),
// 괄호 번호((1), [1]) 및 주요 글머리 기호(■, ▶, ●, ✅ 등). 마커 뒤 공백은 선택(①과제 소개).
const SYMBOL_MARKER_REGEX =
  /^(?:[•■□◆◇●○▶▷★☆✓✔✅📌💡🔹🔸]|[\u2460-\u24FF\u2776-\u2793\u3251-\u325F\u32B1-\u32BF\u3200-\u321E\u3260-\u327B\u2160-\u217F]+|\(\d+\)|\[\d+\])\s*(.+)$/u;

/**
 * Extracts markdown heading lines (#, ##, ###), bold leading labels (**Keyword**:),
 * list items with leading keywords (- Keyword, 1. Keyword, etc.), and lines prefixed
 * with circled numbers / bracketed numbers / bullet symbols (① Keyword, (1) Keyword, ■ Keyword)
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

    // Strip leading list / numbering markers (can be stacked, e.g. "- ① Keyword")
    let rest = trimmed;
    let hasMarker = false;
    for (let i = 0; i < 3; i++) {
      const asciiMatch = rest.match(ASCII_LIST_REGEX);
      if (asciiMatch && asciiMatch[2]) {
        rest = asciiMatch[2].trim();
        hasMarker = true;
        continue;
      }
      const symbolMatch = rest.match(SYMBOL_MARKER_REGEX);
      if (symbolMatch && symbolMatch[1]) {
        rest = symbolMatch[1].trim();
        hasMarker = true;
        continue;
      }
      break;
    }

    if (hasMarker && rest) {
      // Remove leading bold tags if present: **Keyword**: or **Keyword**
      rest = rest.replace(/^(\*\*|__)(.*?)\1[:\s]*/, "$2 ");
      headings.push(rest.trim());
      continue;
    }

    // Matches leading bold labels: **Key Learning**: or __Key Learning__: or a standalone **Keyword** line
    const boldLabelMatch = trimmed.match(/^(\*\*|__)(.*?)\1(?:[:\s]|$)/);
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
