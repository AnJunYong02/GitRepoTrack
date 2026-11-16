import { describe, expect, it } from "vitest";
import { isSameListPage } from "./same-list-page";

describe("isSameListPage", () => {
  it("같은 경로와 같은 org면 true (org 대소문자 무시)", () => {
    expect(isSameListPage("/dashboard?org=2026-1-WebService", "/dashboard?org=2026-1-webservice")).toBe(true);
    expect(isSameListPage("/admin?org=MyOrg", "/admin?org=MyOrg")).toBe(true);
  });

  it("한쪽에 org가 없으면 같은 목록으로 본다 (쿠키로 들어온 /admin)", () => {
    expect(isSameListPage("/admin", "/admin?org=MyOrg")).toBe(true);
    expect(isSameListPage("/admin?org=MyOrg", "/admin")).toBe(true);
  });

  it("org가 다르거나 경로가 다르면 false", () => {
    expect(isSameListPage("/dashboard?org=OrgA", "/dashboard?org=OrgB")).toBe(false);
    expect(isSameListPage("/dashboard?org=OrgA", "/admin?org=OrgA")).toBe(false);
    expect(isSameListPage("/admin/assignments/1", "/admin?org=OrgA")).toBe(false);
  });

  it("org 외의 쿼리와 끝의 슬래시는 무시한다", () => {
    expect(isSameListPage("/dashboard/?org=OrgA&tab=list", "/dashboard?org=OrgA")).toBe(true);
  });

  it("직전 페이지가 없거나 외부 URL이면 false", () => {
    expect(isSameListPage(null, "/dashboard")).toBe(false);
    expect(isSameListPage("", "/dashboard")).toBe(false);
    expect(isSameListPage("https://evil.example/dashboard", "/dashboard")).toBe(false);
    expect(isSameListPage("//evil.example/dashboard", "/dashboard")).toBe(false);
  });
});
