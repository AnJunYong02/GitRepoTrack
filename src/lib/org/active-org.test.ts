import { describe, it, expect } from "vitest";
import { normalizeOrgName } from "@/lib/github/app";
import { isValidOrgSlug } from "./active-org";

describe("normalizeOrgName", () => {
  it("returns plain slug unchanged", () => {
    expect(normalizeOrgName("2026-2-WebService")).toBe("2026-2-WebService");
    expect(normalizeOrgName("my-org")).toBe("my-org");
  });

  it("trims whitespace", () => {
    expect(normalizeOrgName("  2026-2-WebService  ")).toBe("2026-2-WebService");
  });

  it("strips https://github.com/ prefix and trailing slashes", () => {
    expect(normalizeOrgName("https://github.com/my-org")).toBe("my-org");
    expect(normalizeOrgName("https://github.com/my-org/")).toBe("my-org");
    expect(normalizeOrgName("http://github.com/my-org/")).toBe("my-org");
  });

  it("extracts org name when a repository path is included in the URL", () => {
    expect(normalizeOrgName("https://github.com/my-org/my-repo")).toBe("my-org");
  });

  it("handles empty or undefined input gracefully", () => {
    expect(normalizeOrgName("")).toBe("");
    expect(normalizeOrgName(undefined)).toBe("");
  });
});

describe("isValidOrgSlug", () => {
  it("validates standard GitHub organization slugs", () => {
    expect(isValidOrgSlug("2026-2-WebService")).toBe(true);
    expect(isValidOrgSlug("github")).toBe(true);
    expect(isValidOrgSlug("org_name.test")).toBe(true);
    expect(isValidOrgSlug("a")).toBe(true);
  });

  it("rejects invalid slugs with spaces, special characters or slashes", () => {
    expect(isValidOrgSlug("org name")).toBe(false);
    expect(isValidOrgSlug("org/repo")).toBe(false);
    expect(isValidOrgSlug("org?foo=bar")).toBe(false);
    expect(isValidOrgSlug("https://github.com/org")).toBe(false);
  });

  it("rejects slugs starting with non-alphanumeric characters", () => {
    expect(isValidOrgSlug("-org")).toBe(false);
    expect(isValidOrgSlug(".org")).toBe(false);
    expect(isValidOrgSlug("_org")).toBe(false);
  });

  it("rejects null, undefined, or empty strings", () => {
    expect(isValidOrgSlug("")).toBe(false);
    expect(isValidOrgSlug(null)).toBe(false);
    expect(isValidOrgSlug(undefined)).toBe(false);
  });
});
