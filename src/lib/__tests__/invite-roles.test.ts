import { describe, it, expect } from "vitest";
import { INVITE_ROLES, normalizeInviteRole } from "@/lib/invite-roles";

describe("normalizeInviteRole", () => {
  it("accepts every canonical invite role", () => {
    for (const r of INVITE_ROLES) expect(normalizeInviteRole(r)).toBe(r);
  });
  it("normalizes mixed case and surrounding whitespace", () => {
    expect(normalizeInviteRole(" Admin ")).toBe("admin");
    expect(normalizeInviteRole("MANAGER")).toBe("manager");
  });
  it("never accepts owner — owners cannot be invited", () => {
    expect(normalizeInviteRole("owner")).toBeNull();
    expect(normalizeInviteRole(" Owner ")).toBeNull();
  });
  it("rejects unknown / empty / non-string input", () => {
    expect(normalizeInviteRole("staff")).toBeNull();
    expect(normalizeInviteRole("")).toBeNull();
    expect(normalizeInviteRole(null)).toBeNull();
    expect(normalizeInviteRole(undefined)).toBeNull();
    expect(normalizeInviteRole(42 as unknown)).toBeNull();
  });
});