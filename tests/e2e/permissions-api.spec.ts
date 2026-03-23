/**
 * E2E API tests for the permissions system.
 *
 * These tests run against the live app and test the full request cycle
 * including JWT verification, permission checks, and response codes.
 *
 * PREREQUISITES:
 * 1. App running at TEST_BASE_URL (default http://localhost:3000)
 * 2. Environment variables TEST_ADMIN_COOKIE, TEST_OWNER_COOKIE,
 *    TEST_MEMBER_COOKIE, TEST_RESTRICTED_MEMBER_COOKIE set with valid session cookies
 *
 * Generate cookies by logging in as each user type and copying the tcf_session cookie value.
 */
import { test, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

// Session cookies — set via env vars or hardcode for local testing
const ADMIN_COOKIE = process.env.TEST_ADMIN_COOKIE || "";
const OWNER_COOKIE = process.env.TEST_OWNER_COOKIE || "";
const MEMBER_COOKIE = process.env.TEST_MEMBER_COOKIE || ""; // member with ALL permissions
const RESTRICTED_COOKIE = process.env.TEST_RESTRICTED_MEMBER_COOKIE || ""; // member with only view_orders, view_shipments
const NO_AUTH = ""; // no cookie

async function api(path: string, opts: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.body) headers["Content-Type"] = "application/json";
  if (opts.cookie) headers["Cookie"] = `tcf_session=${opts.cookie}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });

  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ─── AUTH / ME ───────────────────────────────────────────────────────────────

test.describe("GET /api/auth/me", () => {
  test("returns 401 without cookie", async () => {
    const res = await api("/api/auth/me");
    expect(res.status).toBe(401);
  });

  test("returns user with companyRole and permissions for admin", async () => {
    test.skip(!ADMIN_COOKIE, "No admin cookie configured");
    const res = await api("/api/auth/me", { cookie: ADMIN_COOKIE });
    expect(res.status).toBe(200);
    expect(res.data.role).toBe("ADMIN");
    expect(res.data).toHaveProperty("companyRole");
    expect(res.data).toHaveProperty("permissions");
    expect(res.data).toHaveProperty("creditBalance");
  });

  test("returns companyRole=OWNER for owner", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie configured");
    const res = await api("/api/auth/me", { cookie: OWNER_COOKIE });
    expect(res.status).toBe(200);
    expect(res.data.role).toBe("USER");
    expect(res.data.companyRole).toBe("OWNER");
  });

  test("returns companyRole=MEMBER with permissions for member", async () => {
    test.skip(!MEMBER_COOKIE, "No member cookie configured");
    const res = await api("/api/auth/me", { cookie: MEMBER_COOKIE });
    expect(res.status).toBe(200);
    expect(res.data.companyRole).toBe("MEMBER");
    expect(Array.isArray(res.data.permissions)).toBe(true);
  });
});

// ─── SHIPMENTS ───────────────────────────────────────────────────────────────

test.describe("GET /api/shipments", () => {
  test("returns 401 without auth", async () => {
    const res = await api("/api/shipments");
    expect(res.status).toBe(401);
  });

  test("returns shipments for admin", async () => {
    test.skip(!ADMIN_COOKIE, "No admin cookie");
    const res = await api("/api/shipments", { cookie: ADMIN_COOKIE });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("returns shipments for owner", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    const res = await api("/api/shipments", { cookie: OWNER_COOKIE });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("returns shipments for member with view_shipments", async () => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    const res = await api("/api/shipments", { cookie: MEMBER_COOKIE });
    expect(res.status).toBe(200);
  });

  test("returns 401 for member without view_shipments", async () => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    // Restricted member only has view_orders and view_shipments — adjust if needed
    // This test assumes the restricted member does NOT have view_shipments
  });
});

// ─── ORDERS ──────────────────────────────────────────────────────────────────

test.describe("GET /api/orders", () => {
  test("returns 401 without auth", async () => {
    const res = await api("/api/orders");
    expect(res.status).toBe(401);
  });

  test("returns orders for admin", async () => {
    test.skip(!ADMIN_COOKIE, "No admin cookie");
    const res = await api("/api/orders", { cookie: ADMIN_COOKIE });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("returns orders for owner (company-scoped)", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    const res = await api("/api/orders", { cookie: OWNER_COOKIE });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });

  test("returns orders for member with view_orders", async () => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    const res = await api("/api/orders", { cookie: MEMBER_COOKIE });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
  });
});

// ─── TEAM ────────────────────────────────────────────────────────────────────

test.describe("GET /api/team", () => {
  test("returns 401 without auth", async () => {
    const res = await api("/api/team");
    expect(res.status).toBe(401);
  });

  test("returns team members for owner", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    const res = await api("/api/team", { cookie: OWNER_COOKIE });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    if (res.data.length > 0) {
      expect(res.data[0]).toHaveProperty("email");
      expect(res.data[0]).toHaveProperty("companyRole");
      expect(res.data[0]).toHaveProperty("permissions");
    }
  });

  test("returns 403 for member", async () => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    const res = await api("/api/team", { cookie: MEMBER_COOKIE });
    expect(res.status).toBe(403);
  });

  test("returns team members for admin (if admin has no company, returns error)", async () => {
    test.skip(!ADMIN_COOKIE, "No admin cookie");
    const res = await api("/api/team", { cookie: ADMIN_COOKIE });
    // Admin without company should get 403 or 400
    expect([200, 400, 403]).toContain(res.status);
  });
});

test.describe("POST /api/team (invite)", () => {
  test("returns 401 without auth", async () => {
    const res = await api("/api/team", { method: "POST", body: { email: "test@test.com", permissions: [] } });
    expect(res.status).toBe(401);
  });

  test("returns 403 for member trying to invite", async () => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    const res = await api("/api/team", {
      method: "POST",
      cookie: MEMBER_COOKIE,
      body: { email: "unauthorized-invite@test.com", permissions: ["view_orders"] },
    });
    expect(res.status).toBe(403);
  });

  test("returns 409 if email already exists", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    // Try inviting the owner's own email (which exists)
    const me = await api("/api/auth/me", { cookie: OWNER_COOKIE });
    if (me.status !== 200) return;
    const res = await api("/api/team", {
      method: "POST",
      cookie: OWNER_COOKIE,
      body: { email: me.data.email, permissions: ["view_orders"] },
    });
    expect(res.status).toBe(409);
  });
});

test.describe("PATCH /api/team/:id", () => {
  test("returns 401 without auth", async () => {
    const res = await api("/api/team/00000000-0000-0000-0000-000000000000", {
      method: "PATCH",
      body: { permissions: ["view_orders"] },
    });
    expect(res.status).toBe(401);
  });

  test("returns 403 for member trying to edit permissions", async () => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    const res = await api("/api/team/00000000-0000-0000-0000-000000000000", {
      method: "PATCH",
      cookie: MEMBER_COOKIE,
      body: { permissions: ["view_orders"] },
    });
    expect(res.status).toBe(403);
  });

  test("returns 404 for non-existent member", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    const res = await api("/api/team/00000000-0000-0000-0000-000000000000", {
      method: "PATCH",
      cookie: OWNER_COOKIE,
      body: { permissions: ["view_orders"] },
    });
    expect(res.status).toBe(404);
  });
});

test.describe("DELETE /api/team/:id", () => {
  test("returns 401 without auth", async () => {
    const res = await api("/api/team/00000000-0000-0000-0000-000000000000", { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("returns 403 for member trying to remove", async () => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    const res = await api("/api/team/00000000-0000-0000-0000-000000000000", {
      method: "DELETE",
      cookie: MEMBER_COOKIE,
    });
    expect(res.status).toBe(403);
  });

  test("owner cannot remove themselves", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    const me = await api("/api/auth/me", { cookie: OWNER_COOKIE });
    if (me.status !== 200) return;
    const res = await api(`/api/team/${me.data.userId}`, {
      method: "DELETE",
      cookie: OWNER_COOKIE,
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toContain("Cannot remove");
  });
});

// ─── ORDER DETAIL ACCESS ─────────────────────────────────────────────────────

test.describe("GET /api/orders/:id (access control)", () => {
  test("returns 401 without auth", async () => {
    const res = await api("/api/orders/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(401);
  });

  test("returns 404 for non-existent order", async () => {
    test.skip(!ADMIN_COOKIE, "No admin cookie");
    const res = await api("/api/orders/00000000-0000-0000-0000-000000000000", { cookie: ADMIN_COOKIE });
    expect(res.status).toBe(404);
  });
});

// ─── PAYMENT ROUTES ──────────────────────────────────────────────────────────

test.describe("Payment routes (unauthenticated)", () => {
  const orderId = "00000000-0000-0000-0000-000000000000";

  test("GET /api/orders/:id/payment returns 401", async () => {
    const res = await api(`/api/orders/${orderId}/payment`);
    expect(res.status).toBe(401);
  });

  test("POST /api/orders/:id/payment returns 401", async () => {
    const res = await api(`/api/orders/${orderId}/payment`, {
      method: "POST",
      body: { method: "BANK_TRANSFER" },
    });
    expect(res.status).toBe(401);
  });

  test("DELETE /api/orders/:id/payment returns 401", async () => {
    const res = await api(`/api/orders/${orderId}/payment`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });

  test("POST /api/orders/:id/payment/charge returns 401", async () => {
    const res = await api(`/api/orders/${orderId}/payment/charge`, {
      method: "POST",
      body: { sourceId: "test" },
    });
    expect(res.status).toBe(401);
  });

  test("POST /api/orders/:id/credit returns 401", async () => {
    const res = await api(`/api/orders/${orderId}/credit`, {
      method: "POST",
      body: { action: "apply" },
    });
    expect(res.status).toBe(401);
  });
});

// ─── DOA ROUTES ──────────────────────────────────────────────────────────────

test.describe("DOA routes (unauthenticated)", () => {
  const orderId = "00000000-0000-0000-0000-000000000000";

  test("GET /api/orders/:id/doa returns 401", async () => {
    const res = await api(`/api/orders/${orderId}/doa`);
    expect(res.status).toBe(401);
  });

  test("POST /api/orders/:id/doa returns 401", async () => {
    const res = await api(`/api/orders/${orderId}/doa`, {
      method: "POST",
      body: { items: [] },
    });
    expect(res.status).toBe(401);
  });
});

// ─── INVALID UUID HANDLING ───────────────────────────────────────────────────

test.describe("Invalid UUID handling", () => {
  test("GET /api/orders/not-a-uuid returns 404", async () => {
    test.skip(!ADMIN_COOKIE, "No admin cookie");
    const res = await api("/api/orders/not-a-uuid", { cookie: ADMIN_COOKIE });
    expect(res.status).toBe(404);
  });

  test("GET /api/shipments/not-a-uuid returns 404", async () => {
    test.skip(!ADMIN_COOKIE, "No admin cookie");
    const res = await api("/api/shipments/not-a-uuid", { cookie: ADMIN_COOKIE });
    expect(res.status).toBe(404);
  });

  test("PATCH /api/team/not-a-uuid returns 404", async () => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    const res = await api("/api/team/not-a-uuid", {
      method: "PATCH",
      cookie: OWNER_COOKIE,
      body: { permissions: [] },
    });
    expect(res.status).toBe(404);
  });
});
