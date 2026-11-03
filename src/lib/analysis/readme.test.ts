import { describe, it, expect } from "vitest";
import { checkReadmeKeywords, extractHeadingLines } from "./readme";

describe("README 대제목 키워드 검사기", () => {
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

  it("빈 README나 빈 키워드 목록 처리", () => {
    expect(checkReadmeKeywords("", weeklyKeywords).satisfied).toBe(false);
    expect(checkReadmeKeywords("# Hello", []).satisfied).toBe(true);
  });
});
