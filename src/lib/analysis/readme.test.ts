import { describe, it, expect } from "vitest";
import { checkReadmeKeywords, normalizeForKeywordMatch } from "./readme";

describe("README 키워드 포함 검사기", () => {
  const weeklyKeywords = [
    "Key Learning",
    "Problem & Solution",
    "Code Review",
    "AI Usage",
    "Reflection",
  ];

  it("모든 필수 대제목이 포함된 정상 Weekly Report 통과", () => {
    const validReadme = `
# Weekly Report 4주차

## Key Learning
새롭게 이해한 내용 3가지...

## Problem & Solution
문제 1개 이상과 해결 과정...

## Code Review
중요한 코드 1개와 동작 설명...

## AI Usage
AI 활용 내용 및 직접 수정한 부분, AI 사용률: 40%

## Reflection
추가로 공부하고 싶은 내용...
`;

    const result = checkReadmeKeywords(validReadme, weeklyKeywords);
    expect(result.satisfied).toBe(true);
    expect(result.missingKeywords).toHaveLength(0);
    expect(result.details.every((d) => d.found)).toBe(true);
  });

  it("대소문자 차이(소문자/대문자)가 있어도 정상 검출", () => {
    const readme = `
### key learning
학습 내용

### PROBLEM & SOLUTION
문제 해결

### code review
코드 리뷰

### ai usage
인공지능 활용

### reflection
회고
`;

    const result = checkReadmeKeywords(readme, weeklyKeywords);
    expect(result.satisfied).toBe(true);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it("특정 필수 키워드(예: Code Review)가 누락된 경우 미충족 판정", () => {
    const incompleteReadme = `
# Weekly Report

## Key Learning
배운 점 1, 2, 3

## Problem & Solution
에러 해결

## AI Usage
GPT-4 활용

## Reflection
다음 주 목표
`;

    const result = checkReadmeKeywords(incompleteReadme, weeklyKeywords);
    expect(result.satisfied).toBe(false);
    expect(result.missingKeywords).toEqual(["Code Review"]);
    expect(result.details.find((d) => d.keyword === "Code Review")?.found).toBe(false);
  });

  it("마크다운 굵은 글씨 라벨 형태(**Key Learning**:)도 대제목으로 인식", () => {
    const boldReadme = `
# 주간 보고서

**Key Learning**: 핵심 배운 점
**Problem & Solution**: 버그 조치
**Code Review**: 알고리즘 최적화
**AI Usage**: 코파일럿 사용
**Reflection**: 다음 주 계획
`;

    const result = checkReadmeKeywords(boldReadme, weeklyKeywords);
    expect(result.satisfied).toBe(true);
  });

  it("불릿 리스트(-, *, +) 및 번호 매기기 리스트(1., 2., 1)) 형태 키워드 정상 인식", () => {
    const listReadme = `
# 주간 보고서 요약

- Key Learning: 리액트 상태 관리와 비동기 통신
* Problem & Solution: PostgREST 관계 조인 에러 해결
+ Code Review: 최적화된 SQL 쿼리와 인덱스 활용
1. AI Usage: ChatGPT-4o 활용 (사용률 약 35%)
2) Reflection: 다음 과제에서는 타입 안정성에 더 집중할 계획
`;

    const result = checkReadmeKeywords(listReadme, weeklyKeywords);
    expect(result.satisfied).toBe(true);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it("불릿 리스트 내 볼드체(- **Key Learning**:) 형태도 완벽히 인식", () => {
    const boldListReadme = `
- **Key Learning**: 프론트엔드 최적화
- **Problem & Solution**: 브랜치 미존재 에러 해결
- **Code Review**: 코드 리뷰 진행
- **AI Usage**: 30% 사용
- **Reflection**: 회고 및 향후 목표
`;

    const result = checkReadmeKeywords(boldListReadme, weeklyKeywords);
    expect(result.satisfied).toBe(true);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it("원문자 숫자(①, ②...) 뒤에 키워드를 쓴 형태도 인식 (띄어쓰기 유무 무관)", () => {
    const keywords = ["과제 소개", "Database 환경", "이번 과제 키워드", "핵심 내용 정리"];
    const readme = `
① 과제 소개
내용

②Database 환경
내용

**③ 이번 과제 키워드**
내용

- ④ 핵심 내용 정리
`;
    const result = checkReadmeKeywords(readme, keywords);
    expect(result.satisfied).toBe(true);
    expect(result.missingKeywords).toHaveLength(0);
  });

  it("괄호 번호·기호 마커((1), [2], ■, ❶)와 마크다운 헤더 내 원문자도 인식", () => {
    const keywords = ["과제 소개", "실행 방법", "프로젝트 구조", "회고"];
    const readme = `
(1) 과제 소개
[2] 실행 방법
■ 프로젝트 구조
## ❶ 회고
`;
    expect(checkReadmeKeywords(readme, keywords).satisfied).toBe(true);
  });

  it("원문자 뒤 키워드가 없으면 여전히 미감지 처리", () => {
    const result = checkReadmeKeywords("① 과제 소개\n② 실행 방법", ["과제 소개", "회고"]);
    expect(result.satisfied).toBe(false);
    expect(result.missingKeywords).toEqual(["회고"]);
  });

  it("빈 README나 빈 키워드 목록 처리", () => {
    expect(checkReadmeKeywords("", weeklyKeywords).satisfied).toBe(false);
    expect(checkReadmeKeywords("# Hello", []).satisfied).toBe(true);
  });

  it("대제목이 아니어도 본문 문장 속에 키워드가 있으면 통과", () => {
    const readme = "이번 과제의 Code Review는 팀원과 진행했고, key learning도 정리했다.";
    const result = checkReadmeKeywords(readme, ["Code Review", "Key Learning"]);
    expect(result.satisfied).toBe(true);
  });

  it("띄어쓰기를 무시한다 (실행방법 = 실행 방법)", () => {
    expect(checkReadmeKeywords("## 실행 방법\n내용", ["실행방법"]).satisfied).toBe(true);
    expect(checkReadmeKeywords("실행방법: npm run dev", ["실행 방법"]).satisfied).toBe(true);
    expect(checkReadmeKeywords("Key\tLearning", ["KeyLearning"]).satisfied).toBe(true);
  });

  it("README에 없는 키워드는 미충족", () => {
    const result = checkReadmeKeywords("## 과제 소개\n내용", ["과제 소개", "실행 방법"]);
    expect(result.satisfied).toBe(false);
    expect(result.missingKeywords).toEqual(["실행 방법"]);
  });
});

describe("normalizeForKeywordMatch", () => {
  it("모든 공백을 지우고 소문자로 만든다", () => {
    expect(normalizeForKeywordMatch(" Key  Learning\n\u3000끝 ")).toBe("keylearning끝");
  });
});
