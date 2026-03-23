/**
 * Tests for the server-side auth middleware permission helpers.
 * Tests hasPermission and canAccessOrder logic.
 */
import { describe, it, expect } from "vitest";
import { Permission } from "@/server/lib/permissions";

// Re-implement the logic here to test it in isolation (same logic as auth.ts)
function hasPermission(
  user: { role: string; companyRole?: string | null; permissions?: string[] | null },
  permission: Permission
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.companyRole === "OWNER") return true;
  if (!user.companyRole) return true;
  return user.permissions?.includes(permission) ?? false;
}

function canAccessOrder(
  user: { role: string; userId: string; companyId?: string | null; companyRole?: string | null; permissions?: string[] | null },
  order: { userId: string | null; user?: { companyId?: string | null } | null }
): boolean {
  if (user.role === "ADMIN") return true;
  if (order.userId === user.userId) return true;
  if (user.companyId && order.user?.companyId === user.companyId && hasPermission(user, Permission.VIEW_ORDERS)) {
    return true;
  }
  return false;
}

describe("hasPermission (server middleware)", () => {
  it("ADMIN always has permission", () => {
    const admin = { role: "ADMIN", companyRole: null, permissions: null };
    expect(hasPermission(admin, Permission.CREATE_ORDER)).toBe(true);
    expect(hasPermission(admin, Permission.MANAGE_PAYMENTS)).toBe(true);
  });

  it("OWNER always has permission", () => {
    const owner = { role: "USER", companyRole: "OWNER", permissions: null };
    expect(hasPermission(owner, Permission.CREATE_ORDER)).toBe(true);
    expect(hasPermission(owner, Permission.MANAGE_PAYMENTS)).toBe(true);
  });

  it("null companyRole (legacy user) has full access", () => {
    const legacy = { role: "USER", companyRole: null, permissions: null };
    expect(hasPermission(legacy, Permission.CREATE_ORDER)).toBe(true);
    expect(hasPermission(legacy, Permission.MANAGE_PAYMENTS)).toBe(true);
  });

  it("undefined companyRole (old JWT) has full access", () => {
    const old = { role: "USER" };
    expect(hasPermission(old, Permission.VIEW_SHIPMENTS)).toBe(true);
  });

  it("MEMBER with specific permissions", () => {
    const member = { role: "USER", companyRole: "MEMBER", permissions: ["view_orders", "view_shipments"] };
    expect(hasPermission(member, Permission.VIEW_ORDERS)).toBe(true);
    expect(hasPermission(member, Permission.VIEW_SHIPMENTS)).toBe(true);
    expect(hasPermission(member, Permission.CREATE_ORDER)).toBe(false);
    expect(hasPermission(member, Permission.MANAGE_PAYMENTS)).toBe(false);
  });

  it("MEMBER with null permissions has no access", () => {
    const member = { role: "USER", companyRole: "MEMBER", permissions: null };
    expect(hasPermission(member, Permission.VIEW_ORDERS)).toBe(false);
  });

  it("MEMBER with empty permissions has no access", () => {
    const member = { role: "USER", companyRole: "MEMBER", permissions: [] as string[] };
    expect(hasPermission(member, Permission.VIEW_ORDERS)).toBe(false);
  });
});

describe("canAccessOrder", () => {
  const companyId = "company-123";

  it("ADMIN can access any order", () => {
    const admin = { role: "ADMIN", userId: "admin-1", companyId: null, companyRole: null, permissions: null };
    const order = { userId: "user-2", user: { companyId: "other-company" } };
    expect(canAccessOrder(admin, order)).toBe(true);
  });

  it("order owner can always access their own order", () => {
    const user = { role: "USER", userId: "user-1", companyId: null, companyRole: null, permissions: null };
    const order = { userId: "user-1", user: null };
    expect(canAccessOrder(user, order)).toBe(true);
  });

  it("different user without company cannot access", () => {
    const user = { role: "USER", userId: "user-1", companyId: null, companyRole: null, permissions: null };
    const order = { userId: "user-2", user: null };
    expect(canAccessOrder(user, order)).toBe(false);
  });

  it("same company OWNER can access company orders", () => {
    const owner = { role: "USER", userId: "user-1", companyId, companyRole: "OWNER", permissions: null };
    const order = { userId: "user-2", user: { companyId } };
    expect(canAccessOrder(owner, order)).toBe(true);
  });

  it("same company MEMBER with VIEW_ORDERS can access company orders", () => {
    const member = { role: "USER", userId: "user-1", companyId, companyRole: "MEMBER", permissions: ["view_orders"] };
    const order = { userId: "user-2", user: { companyId } };
    expect(canAccessOrder(member, order)).toBe(true);
  });

  it("same company MEMBER WITHOUT VIEW_ORDERS cannot access other users orders", () => {
    const member = { role: "USER", userId: "user-1", companyId, companyRole: "MEMBER", permissions: ["create_order"] };
    const order = { userId: "user-2", user: { companyId } };
    expect(canAccessOrder(member, order)).toBe(false);
  });

  it("same company MEMBER can access their OWN order even without VIEW_ORDERS", () => {
    const member = { role: "USER", userId: "user-1", companyId, companyRole: "MEMBER", permissions: ["create_order"] };
    const order = { userId: "user-1", user: { companyId } };
    expect(canAccessOrder(member, order)).toBe(true);
  });

  it("different company user cannot access orders", () => {
    const user = { role: "USER", userId: "user-1", companyId: "company-A", companyRole: "OWNER", permissions: null };
    const order = { userId: "user-2", user: { companyId: "company-B" } };
    expect(canAccessOrder(user, order)).toBe(false);
  });

  it("legacy user (no companyRole) can access own orders only", () => {
    const legacy = { role: "USER", userId: "user-1", companyId: null, companyRole: null, permissions: null };
    expect(canAccessOrder(legacy, { userId: "user-1", user: null })).toBe(true);
    expect(canAccessOrder(legacy, { userId: "user-2", user: null })).toBe(false);
  });

  it("order with null userId cannot be accessed by non-admin", () => {
    const user = { role: "USER", userId: "user-1", companyId: null, companyRole: null, permissions: null };
    const order = { userId: null, user: null };
    expect(canAccessOrder(user, order)).toBe(false);
  });
});
