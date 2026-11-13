export interface KeywordDetail {
  keyword: string;
  found: boolean;
}

export interface ReadmeCheckResult {
  satisfied: boolean;
  missingKeywords: string[];
  details: KeywordDetail[];
}

/**
 * 비교용 정규화: 모든 공백 문자(스페이스·탭·줄바꿈·전각 공백)를 제거하고 소문자로 바꾼다.
 * 그래서 "실행 방법"과 "실행방법", "Key Learning"과 "keylearning"을 같은 것으로 본다.
 */
export function normalizeForKeywordMatch(text: string): string {
  return text.replace(/\s+/gu, "").toLowerCase();
}

/**
 * README에 필수 키워드가 포함되어 있는지 검사한다.
 * 대제목(#) 여부와 상관없이 README 어디에든 키워드 문구가 들어 있으면 통과한다.
 * 대소문자와 띄어쓰기는 무시한다.
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

  const normalizedReadme = normalizeForKeywordMatch(readmeContent);

  const details: KeywordDetail[] = requiredKeywords.map((keyword) => {
    const trimmedKeyword = keyword.trim();
    const normalizedKeyword = normalizeForKeywordMatch(trimmedKeyword);
    // 공백만 있는 키워드는 검사 대상이 아니므로 통과 처리
    if (!normalizedKeyword) return { keyword, found: true };

    return {
      keyword: trimmedKeyword,
      found: normalizedReadme.includes(normalizedKeyword),
    };
  });

  const missingKeywords = details.filter((d) => !d.found).map((d) => d.keyword);

  return {
    satisfied: missingKeywords.length === 0,
    missingKeywords,
    details,
  };
}
