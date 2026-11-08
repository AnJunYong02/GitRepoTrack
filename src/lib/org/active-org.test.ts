import { describe, it, expect, vi, beforeEach } from "vitest";
import { normalizeOrgName, checkUserOrgRole, getDefaultOrgName } from "@/lib/github/app";
import {
  isValidOrgSlug,
  checkIsUserOwnerOfOrg,
  getRegisteredOrgNames,
  getLegacyOrgNames,
} from "./active-org";

vi.mock("@/lib/github/app", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/github/app")>();
  return {
    ...actual,
    checkUserOrgRole: vi.fn(),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      select: vi.fn().mockReturnValue({
        data: [],
      }),
    }),
  },
}));

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

describe("checkIsUserOwnerOfOrg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false if user is missing or org slug is invalid", async () => {
    expect(await checkIsUserOwnerOfOrg("valid-org", null)).toBe(false);
    expect(await checkIsUserOwnerOfOrg("valid-org", undefined)).toBe(false);
    expect(await checkIsUserOwnerOfOrg("", { id: "u1" })).toBe(false);
    expect(await checkIsUserOwnerOfOrg("invalid/slug", { id: "u1" })).toBe(false);
  });

  it("returns true when user.app_metadata.github_orgs indicates admin role", async () => {
    const user = {
      id: "user-123",
      app_metadata: {
        github_orgs: [
          { login: "MyOrg", role: "admin" },
          { login: "OtherOrg", role: "member" },
        ],
      },
    };
    const profile = { role: "staff" };

    const isOwner = await checkIsUserOwnerOfOrg("MyOrg", user, profile);
    expect(isOwner).toBe(true);
  });

  it("does not trust admin role written to user-editable user_metadata", async () => {
    // user_metadata는 사용자가 supabase.auth.updateUser()로 직접 고칠 수 있으므로 무시해야 한다
    const user = {
      id: "user-123",
      user_metadata: {
        github_orgs: [{ login: "MyOrg", role: "admin" }],
      },
    };

    const isOwner = await checkIsUserOwnerOfOrg("MyOrg", user, { role: "student" });
    expect(isOwner).toBe(false);
  });

  it("returns false when user.app_metadata.github_orgs only has member role", async () => {
    const user = {
      id: "user-123",
      app_metadata: {
        github_orgs: [
          { login: "MyOrg", role: "member" },
        ],
      },
    };

    const isOwner = await checkIsUserOwnerOfOrg("MyOrg", user, { role: "student" });
    expect(isOwner).toBe(false);
  });

  it("uses checkUserOrgRole fallback when org is not in metadata but login is available", async () => {
    const user = {
      id: "user-123",
      user_metadata: {
        user_name: "octocat",
      },
    };

    const mockedCheck = vi.mocked(checkUserOrgRole);
    mockedCheck.mockResolvedValueOnce("admin");

    const isOwnerAdmin = await checkIsUserOwnerOfOrg("SomeInstalledOrg", user, { role: "student" });
    expect(mockedCheck).toHaveBeenCalledWith("octocat", "SomeInstalledOrg");
    expect(isOwnerAdmin).toBe(true);

    mockedCheck.mockResolvedValueOnce("member");
    const isOwnerMember = await checkIsUserOwnerOfOrg("SomeInstalledOrg", user, { role: "student" });
    expect(isOwnerMember).toBe(false);
  });

  it("falls back to staff role for the default organization when no metadata exists", async () => {
    const defaultOrg = getDefaultOrgName();
    const user = {
      id: "user-123",
      user_metadata: {},
    };
    const profile = { role: "staff" };

    const isOwner = await checkIsUserOwnerOfOrg(defaultOrg, user, profile);
    expect(isOwner).toBe(true);

    const isOtherOwner = await checkIsUserOwnerOfOrg("DifferentOrg", user, profile);
    expect(isOtherOwner).toBe(false);
  });
});

describe("registered / legacy org helpers", () => {
  it("returns null when registered_orgs has never been saved", () => {
    expect(getRegisteredOrgNames({ app_metadata: {} })).toBeNull();
    expect(getRegisteredOrgNames(undefined)).toBeNull();
  });

  it("normalizes and filters registered org names", () => {
    expect(
      getRegisteredOrgNames({
        app_metadata: { registered_orgs: ["OODP", "https://github.com/MyOrg", "bad slug"] },
      })
    ).toEqual(["OODP", "MyOrg"]);
  });

  it("returns only valid org names from legacy user_metadata", () => {
    expect(
      getLegacyOrgNames({
        user_metadata: { github_orgs: [{ login: "team", role: "admin" }, { login: "" }] },
      })
    ).toEqual(["team"]);
  });
});
