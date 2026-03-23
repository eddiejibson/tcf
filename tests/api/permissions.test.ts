/**
 * Server-side unit tests for the permissions model.
 * These test the pure logic functions without hitting the database.
 */
import { describe, it, expect } from "vitest";
import { Permission, ALL_PERMISSIONS, PERMISSION_LABELS, userHasPermission } from "@/app/lib/permissions";

describe("Permission enum", () => {
  it("has all 8 expected permissions", () => {
    expect(ALL_PERMISSIONS).toHaveLength(8);
    expect(ALL_PERMISSIONS).toContain("create_order");
    expect(ALL_PERMISSIONS).toContain("create_catalog_order");
    expect(ALL_PERMISSIONS).toContain("view_orders");
    expect(ALL_PERMISSIONS).toContain("view_shipments");
    expect(ALL_PERMISSIONS).toContain("view_payments");
    expect(ALL_PERMISSIONS).toContain("manage_payments");
    expect(ALL_PERMISSIONS).toContain("view_doa");
    expect(ALL_PERMISSIONS).toContain("create_doa");
  });

  it("every permission has a label and description", () => {
    for (const perm of ALL_PERMISSIONS) {
      const label = PERMISSION_LABELS[perm as Permission];
      expect(label).toBeDefined();
      expect(label.label).toBeTruthy();
      expect(label.description).toBeTruthy();
    }
  });

  it("enum values match string literals", () => {
    expect(Permission.CREATE_ORDER).toBe("create_order");
    expect(Permission.VIEW_SHIPMENTS).toBe("view_shipments");
    expect(Permission.MANAGE_PAYMENTS).toBe("manage_payments");
  });
});

describe("userHasPermission", () => {
  describe("ADMIN role", () => {
    const admin = { role: "ADMIN", companyRole: null, permissions: null };

    it("grants all permissions to ADMIN regardless of companyRole or permissions", () => {
      for (const perm of ALL_PERMISSIONS) {
        expect(userHasPermission(admin, perm as Permission)).toBe(true);
      }
    });

    it("grants even with empty permissions array", () => {
      const adminEmpty = { role: "ADMIN", companyRole: null, permissions: [] };
      expect(userHasPermission(adminEmpty, Permission.CREATE_ORDER)).toBe(true);
    });
  });

  describe("OWNER companyRole", () => {
    const owner = { role: "USER", companyRole: "OWNER", permissions: null };

    it("grants all permissions to OWNER", () => {
      for (const perm of ALL_PERMISSIONS) {
        expect(userHasPermission(owner, perm as Permission)).toBe(true);
      }
    });

    it("grants even with empty permissions array", () => {
      const ownerEmpty = { role: "USER", companyRole: "OWNER", permissions: [] };
      expect(userHasPermission(ownerEmpty, Permission.MANAGE_PAYMENTS)).toBe(true);
    });
  });

  describe("No companyRole (legacy users)", () => {
    it("grants all permissions when companyRole is null", () => {
      const legacy = { role: "USER", companyRole: null, permissions: null };
      for (const perm of ALL_PERMISSIONS) {
        expect(userHasPermission(legacy, perm as Permission)).toBe(true);
      }
    });

    it("grants all permissions when companyRole is undefined", () => {
      const legacy = { role: "USER" };
      for (const perm of ALL_PERMISSIONS) {
        expect(userHasPermission(legacy, perm as Permission)).toBe(true);
      }
    });
  });

  describe("MEMBER companyRole", () => {
    it("grants only permissions in the array", () => {
      const member = {
        role: "USER",
        companyRole: "MEMBER",
        permissions: ["create_order", "view_orders", "view_shipments"],
      };
      expect(userHasPermission(member, Permission.CREATE_ORDER)).toBe(true);
      expect(userHasPermission(member, Permission.VIEW_ORDERS)).toBe(true);
      expect(userHasPermission(member, Permission.VIEW_SHIPMENTS)).toBe(true);
      expect(userHasPermission(member, Permission.MANAGE_PAYMENTS)).toBe(false);
      expect(userHasPermission(member, Permission.VIEW_PAYMENTS)).toBe(false);
      expect(userHasPermission(member, Permission.CREATE_DOA)).toBe(false);
      expect(userHasPermission(member, Permission.VIEW_DOA)).toBe(false);
      expect(userHasPermission(member, Permission.CREATE_CATALOG_ORDER)).toBe(false);
    });

    it("denies all permissions when permissions array is empty", () => {
      const member = { role: "USER", companyRole: "MEMBER", permissions: [] };
      for (const perm of ALL_PERMISSIONS) {
        expect(userHasPermission(member, perm as Permission)).toBe(false);
      }
    });

    it("denies all permissions when permissions is null", () => {
      const member = { role: "USER", companyRole: "MEMBER", permissions: null };
      for (const perm of ALL_PERMISSIONS) {
        expect(userHasPermission(member, perm as Permission)).toBe(false);
      }
    });

    it("grants all permissions when given ALL_PERMISSIONS", () => {
      const member = { role: "USER", companyRole: "MEMBER", permissions: [...ALL_PERMISSIONS] };
      for (const perm of ALL_PERMISSIONS) {
        expect(userHasPermission(member, perm as Permission)).toBe(true);
      }
    });

    it("handles a single permission correctly", () => {
      const member = { role: "USER", companyRole: "MEMBER", permissions: ["view_shipments"] };
      expect(userHasPermission(member, Permission.VIEW_SHIPMENTS)).toBe(true);
      expect(userHasPermission(member, Permission.CREATE_ORDER)).toBe(false);
    });
  });
});
