import { describe, expect, it } from "vitest";
import { escapeLikePattern, orgReposTag } from "./cache-keys";

describe("orgReposTag", () => {
  it("org 이름 대소문자와 앞뒤 공백을 무시한다", () => {
    expect(orgReposTag(" My-Org ")).toBe("org-repos:my-org");
    expect(orgReposTag("my-org")).toBe(orgReposTag("MY-ORG"));
  });
});

describe("escapeLikePattern", () => {
  it("ilike 와일드카드를 문자 그대로 비교하도록 이스케이프한다", () => {
    expect(escapeLikePattern("my_org")).toBe("my\\_org");
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("2026-1-WebService")).toBe("2026-1-WebService");
  });
});
