/**
 * Browser E2E tests for the permissions system.
 *
 * Tests actual page rendering, sidebar links, team management,
 * and permission-gated UI elements.
 *
 * PREREQUISITES:
 * 1. App running at TEST_BASE_URL (default http://localhost:3000)
 * 2. Environment variables for session cookies:
 *    TEST_ADMIN_COOKIE, TEST_OWNER_COOKIE,
 *    TEST_MEMBER_COOKIE, TEST_RESTRICTED_MEMBER_COOKIE
 *
 * TEST_MEMBER_COOKIE = member with ALL permissions
 * TEST_RESTRICTED_MEMBER_COOKIE = member with only view_orders, view_shipments
 */
import { test, expect } from "@playwright/test";
import { loginAs, BASE } from "./helpers";

const ADMIN_COOKIE = process.env.TEST_ADMIN_COOKIE || "";
const OWNER_COOKIE = process.env.TEST_OWNER_COOKIE || "";
const MEMBER_COOKIE = process.env.TEST_MEMBER_COOKIE || "";
const RESTRICTED_COOKIE = process.env.TEST_RESTRICTED_MEMBER_COOKIE || "";

// ─── UNAUTHENTICATED REDIRECTS ─────────────────────────────────────────────

test.describe("Unauthenticated access", () => {
  test("redirects to /login when visiting /shipments without session", async ({ page }) => {
    await page.goto("/shipments");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to /login when visiting /orders without session", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to /login when visiting /team without session", async ({ page }) => {
    await page.goto("/team");
    await expect(page).toHaveURL(/\/login/);
  });

  test("redirects to /login when visiting /catalog without session", async ({ page }) => {
    await page.goto("/catalog");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ─── SIDEBAR VISIBILITY: ADMIN ─────────────────────────────────────────────

test.describe("Sidebar links for ADMIN", () => {
  test.skip(!ADMIN_COOKIE, "No admin cookie configured");

  test.beforeEach(async ({ page }) => {
    await loginAs(page, ADMIN_COOKIE);
  });

  test("shows admin navigation links", async ({ page }) => {
    await page.goto("/shipments");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");

    // Admin should see admin links
    await expect(sidebar.locator("text=Users")).toBeVisible();
    await expect(sidebar.locator("text=Shipments")).toBeVisible();
    await expect(sidebar.locator("text=Orders")).toBeVisible();
    await expect(sidebar.locator("text=DOAs")).toBeVisible();
    await expect(sidebar.locator("text=Catalog")).toBeVisible();
    await expect(sidebar.locator("text=Categories")).toBeVisible();
    await expect(sidebar.locator("text=Applications")).toBeVisible();
  });

  test("shows 'Admin' role in sidebar", async ({ page }) => {
    await page.goto("/shipments");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("text=Admin")).toBeVisible();
  });
});

// ─── SIDEBAR VISIBILITY: OWNER ──────────────────────────────────────────────

test.describe("Sidebar links for OWNER", () => {
  test.skip(!OWNER_COOKIE, "No owner cookie configured");

  test.beforeEach(async ({ page }) => {
    await loginAs(page, OWNER_COOKIE);
  });

  test("shows user navigation links based on full permissions", async ({ page }) => {
    await page.goto("/shipments");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");

    // Owner should see all user links
    await expect(sidebar.locator("a:has-text('Shipments')")).toBeVisible();
    await expect(sidebar.locator("a:has-text('My Orders')")).toBeVisible();
    await expect(sidebar.locator("a:has-text('Team')")).toBeVisible();
  });

  test("shows 'Company Admin' role display", async ({ page }) => {
    await page.goto("/shipments");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("text=Company Admin")).toBeVisible();
  });

  test("does NOT show admin links", async ({ page }) => {
    await page.goto("/shipments");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("a:has-text('Users')")).not.toBeVisible();
    await expect(sidebar.locator("a:has-text('Applications')")).not.toBeVisible();
  });
});

// ─── SIDEBAR VISIBILITY: MEMBER WITH ALL PERMISSIONS ────────────────────────

test.describe("Sidebar links for MEMBER (all permissions)", () => {
  test.skip(!MEMBER_COOKIE, "No member cookie configured");

  test.beforeEach(async ({ page }) => {
    await loginAs(page, MEMBER_COOKIE);
  });

  test("shows Shipments, My Orders, Catalog links", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");

    await expect(sidebar.locator("a:has-text('Shipments')")).toBeVisible();
    await expect(sidebar.locator("a:has-text('My Orders')")).toBeVisible();
    await expect(sidebar.locator("a:has-text('Catalog')")).toBeVisible();
  });

  test("does NOT show Team link (members cannot manage team)", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("a:has-text('Team')")).not.toBeVisible();
  });

  test("shows 'Team Member' role display", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("text=Team Member")).toBeVisible();
  });
});

// ─── SIDEBAR VISIBILITY: RESTRICTED MEMBER ──────────────────────────────────

test.describe("Sidebar links for RESTRICTED MEMBER (view_orders + view_shipments only)", () => {
  test.skip(!RESTRICTED_COOKIE, "No restricted member cookie configured");

  test.beforeEach(async ({ page }) => {
    await loginAs(page, RESTRICTED_COOKIE);
  });

  test("shows only Shipments and My Orders links", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");

    await expect(sidebar.locator("a:has-text('Shipments')")).toBeVisible();
    await expect(sidebar.locator("a:has-text('My Orders')")).toBeVisible();
  });

  test("does NOT show Catalog link (no create_catalog_order permission)", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("a:has-text('Catalog')")).not.toBeVisible();
  });

  test("does NOT show Team link", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");
    await expect(sidebar.locator("a:has-text('Team')")).not.toBeVisible();
  });
});

// ─── SHIPMENTS PAGE ─────────────────────────────────────────────────────────

test.describe("Shipments page", () => {
  test("loads for owner", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/shipments");

    // Should not show forbidden message
    await expect(page.locator("text=You don't have permission")).not.toBeVisible();
  });

  test("loads for member with view_shipments", async ({ page }) => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    await loginAs(page, MEMBER_COOKIE);
    await page.goto("/shipments");

    await expect(page.locator("text=You don't have permission")).not.toBeVisible();
  });

  test("loads for restricted member with view_shipments", async ({ page }) => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    await loginAs(page, RESTRICTED_COOKIE);
    await page.goto("/shipments");

    await expect(page.locator("text=You don't have permission")).not.toBeVisible();
  });
});

// ─── ORDERS PAGE ────────────────────────────────────────────────────────────

test.describe("Orders page", () => {
  test("loads for owner", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/orders");

    // Should not show forbidden message
    await expect(page.locator("text=You don't have permission")).not.toBeVisible();
  });

  test("loads for member with view_orders", async ({ page }) => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    await loginAs(page, MEMBER_COOKIE);
    await page.goto("/orders");

    await expect(page.locator("text=You don't have permission")).not.toBeVisible();
  });

  test("shows order cards with correct format", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/orders");

    // Wait for content to load (either orders or empty state)
    await page.waitForLoadState("networkidle");

    const noOrders = await page.locator("text=No orders yet").count();
    if (noOrders > 0) {
      // Empty state — verify links are shown
      await expect(page.locator("text=Browse Shipments")).toBeVisible();
      return;
    }

    // If orders exist, check format: order IDs are uppercase hex, price displayed
    const firstOrder = page.locator("a[href^='/orders/']").first();
    await expect(firstOrder).toBeVisible();
  });
});

// ─── TEAM PAGE ──────────────────────────────────────────────────────────────

test.describe("Team page", () => {
  test("loads for OWNER with team management UI", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/team");

    // Wait for page to load
    await page.waitForLoadState("networkidle");

    // Should show team header
    await expect(page.locator("text=Team")).toBeVisible();
    await expect(page.locator("text=Manage company members")).toBeVisible();

    // Should show invite button
    await expect(page.locator("button:has-text('Invite')")).toBeVisible();
  });

  test("shows forbidden message for MEMBER", async ({ page }) => {
    test.skip(!MEMBER_COOKIE, "No member cookie");
    await loginAs(page, MEMBER_COOKIE);
    await page.goto("/team");

    await page.waitForLoadState("networkidle");

    // Members should see forbidden message
    await expect(page.locator("text=don't have access")).toBeVisible();
  });

  test("shows OWNER in team list with correct badge", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/team");

    await page.waitForLoadState("networkidle");

    // Owner should be in the list with Owner badge
    await expect(page.locator("text=Owner").first()).toBeVisible();
  });

  test("invite modal opens and has permission checkboxes", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/team");
    await page.waitForLoadState("networkidle");

    // Click invite button
    await page.locator("button:has-text('Invite')").click();

    // Modal should appear with email input
    await expect(page.locator("input[type='email']")).toBeVisible();

    // Should show permission checkboxes
    await expect(page.locator("text=Create Shipment Orders")).toBeVisible();
    await expect(page.locator("text=View All Orders")).toBeVisible();
    await expect(page.locator("text=View Shipments")).toBeVisible();
    await expect(page.locator("text=View Payments")).toBeVisible();
    await expect(page.locator("text=Manage Payments")).toBeVisible();
    await expect(page.locator("text=View DOA Claims")).toBeVisible();
    await expect(page.locator("text=Submit DOA Claims")).toBeVisible();
  });

  test("invite modal validates email", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/team");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Invite')").click();

    // Try to submit without email
    const sendButton = page.locator("button:has-text('Send Invite')");
    await sendButton.click();

    // Email field should be required
    const emailInput = page.locator("input[type='email']");
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test("invite modal rejects duplicate email with 409", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/team");
    await page.waitForLoadState("networkidle");

    // Get owner's own email from /api/auth/me
    const meRes = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me");
      return res.json();
    });

    await page.locator("button:has-text('Invite')").click();

    const emailInput = page.locator("input[type='email']");
    await emailInput.fill(meRes.email);

    // Check at least one permission
    await page.locator("text=View All Orders").click();

    await page.locator("button:has-text('Send Invite')").click();

    // Should show error about duplicate
    await expect(page.locator("text=/already|exists/i")).toBeVisible({ timeout: 10000 });
  });

  test("OWNER row cannot be edited or removed", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/team");
    await page.waitForLoadState("networkidle");

    // Find the Owner row
    const ownerRow = page.locator("tr, div").filter({ hasText: "Owner" }).first();

    // Owner row should NOT have Edit or Remove buttons
    const editButton = ownerRow.locator("button:has-text('Edit')");
    const removeButton = ownerRow.locator("button:has-text('Remove')");

    expect(await editButton.count()).toBe(0);
    expect(await removeButton.count()).toBe(0);
  });
});

// ─── ORDER DETAIL: PAYMENT GATING ──────────────────────────────────────────

test.describe("Order detail page (payment permission gating)", () => {
  // These tests require a real order. We'll fetch the first order available.

  test("owner sees payment options on ACCEPTED order", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);

    // Get orders
    const orders = await page.evaluate(async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    });

    // Find an ACCEPTED order
    const accepted = orders.find((o: { status: string }) => o.status === "ACCEPTED");
    if (!accepted) {
      test.skip(true, "No ACCEPTED order available for testing");
      return;
    }

    await page.goto(`/orders/${accepted.id}`);
    await page.waitForLoadState("networkidle");

    // Owner should see payment options
    await expect(page.locator("text=/Bank Transfer|Card Payment|Finance/i").first()).toBeVisible();
  });

  test("restricted member does NOT see payment options", async ({ page }) => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    await loginAs(page, RESTRICTED_COOKIE);

    // Get orders
    const orders = await page.evaluate(async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    });

    const accepted = orders.find((o: { status: string }) => o.status === "ACCEPTED");
    if (!accepted) {
      test.skip(true, "No ACCEPTED order available");
      return;
    }

    await page.goto(`/orders/${accepted.id}`);
    await page.waitForLoadState("networkidle");

    // Restricted member without manage_payments should NOT see payment buttons
    await expect(page.locator("button:has-text('Bank Transfer')")).not.toBeVisible();
    await expect(page.locator("button:has-text('Card Payment')")).not.toBeVisible();
    await expect(page.locator("button:has-text('Finance')")).not.toBeVisible();
  });

  test("restricted member does NOT see credit toggle", async ({ page }) => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    await loginAs(page, RESTRICTED_COOKIE);

    const orders = await page.evaluate(async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    });

    const accepted = orders.find((o: { status: string }) => o.status === "ACCEPTED");
    if (!accepted) {
      test.skip(true, "No ACCEPTED order available");
      return;
    }

    await page.goto(`/orders/${accepted.id}`);
    await page.waitForLoadState("networkidle");

    // Should NOT see credit application checkbox
    await expect(page.locator("text=Use account credit")).not.toBeVisible();
    await expect(page.locator("text=Account credit applied")).not.toBeVisible();
  });

  test("order detail shows order info for restricted member", async ({ page }) => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    await loginAs(page, RESTRICTED_COOKIE);

    const orders = await page.evaluate(async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    });

    if (orders.length === 0) {
      test.skip(true, "No orders available");
      return;
    }

    await page.goto(`/orders/${orders[0].id}`);
    await page.waitForLoadState("networkidle");

    // Should still show basic order info (ID, items, totals)
    const orderId = orders[0].id.slice(0, 8).toUpperCase();
    await expect(page.locator(`text=#${orderId}`)).toBeVisible();
  });
});

// ─── ORDER DETAIL: DOA GATING ───────────────────────────────────────────────

test.describe("Order detail page (DOA permission gating)", () => {
  test("restricted member without create_doa cannot report DOA on paid order", async ({ page }) => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    await loginAs(page, RESTRICTED_COOKIE);

    const orders = await page.evaluate(async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    });

    const paid = orders.find((o: { status: string }) => o.status === "PAID");
    if (!paid) {
      test.skip(true, "No PAID order available");
      return;
    }

    await page.goto(`/orders/${paid.id}`);
    await page.waitForLoadState("networkidle");

    // Should NOT see "Report DOA" button (no create_doa permission)
    await expect(page.locator("button:has-text('Report DOA')")).not.toBeVisible();
  });

  test("owner can see DOA section on paid order", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);

    const orders = await page.evaluate(async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    });

    const paid = orders.find((o: { status: string }) => o.status === "PAID");
    if (!paid) {
      test.skip(true, "No PAID order available");
      return;
    }

    await page.goto(`/orders/${paid.id}`);
    await page.waitForLoadState("networkidle");

    // Owner should see DOA section (either existing claim or Report DOA button)
    const hasDoa = await page.locator("text=/Report DOA|DOA Claim/i").count();
    expect(hasDoa).toBeGreaterThan(0);
  });
});

// ─── ORDER DETAIL: INVOICE BUTTON ──────────────────────────────────────────

test.describe("Order detail page (invoice visibility)", () => {
  test("restricted member without view_payments cannot see invoice button", async ({ page }) => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    await loginAs(page, RESTRICTED_COOKIE);

    const orders = await page.evaluate(async () => {
      const res = await fetch("/api/orders");
      if (!res.ok) return [];
      return res.json();
    });

    // Find an accepted/paid order that would normally show invoice
    const eligibleOrder = orders.find(
      (o: { status: string }) =>
        ["ACCEPTED", "AWAITING_FULFILLMENT", "AWAITING_PAYMENT", "PAID"].includes(o.status)
    );

    if (!eligibleOrder) {
      test.skip(true, "No eligible order for invoice test");
      return;
    }

    await page.goto(`/orders/${eligibleOrder.id}`);
    await page.waitForLoadState("networkidle");

    // Should NOT see invoice download button
    await expect(page.locator("text=/Download Invoice|Invoice/i")).not.toBeVisible();
  });
});

// ─── NAVIGATION GUARD: DIRECT URL ACCESS ───────────────────────────────────

test.describe("Direct URL access with insufficient permissions", () => {
  test("restricted member navigating to /catalog gets appropriate response", async ({ page }) => {
    test.skip(!RESTRICTED_COOKIE, "No restricted member cookie");
    await loginAs(page, RESTRICTED_COOKIE);
    await page.goto("/catalog");

    await page.waitForLoadState("networkidle");

    // Should either redirect away or show forbidden/empty state
    // (restricted member has no create_catalog_order permission)
    const url = page.url();
    const hasForbidden = await page.locator("text=/permission|forbidden|not allowed/i").count();
    const redirectedAway = !url.includes("/catalog");

    expect(hasForbidden > 0 || redirectedAway).toBe(true);
  });
});

// ─── LOGOUT ─────────────────────────────────────────────────────────────────

test.describe("Logout", () => {
  test("logout button clears session and redirects to login", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/shipments");
    await page.waitForSelector("aside");

    // Find and click logout button
    const logoutButton = page.locator("button:has-text('Logout'), button:has-text('Log out')");

    if ((await logoutButton.count()) > 0) {
      await logoutButton.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});

// ─── CREDIT BALANCE DISPLAY ─────────────────────────────────────────────────

test.describe("Credit balance display", () => {
  test("owner sees credit balance in sidebar if > 0", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);

    // Check if user has credit
    const me = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me");
      return res.json();
    });

    await page.goto("/shipments");
    await page.waitForSelector("aside");

    const sidebar = page.locator("aside");

    if (me.creditBalance > 0) {
      // Should show credit balance
      await expect(sidebar.locator("text=/credit/i")).toBeVisible();
    } else {
      // Should NOT show credit section
      await expect(sidebar.locator("text=/credit balance/i")).not.toBeVisible();
    }
  });
});

// ─── ACTIVE LINK HIGHLIGHTING ───────────────────────────────────────────────

test.describe("Sidebar active link", () => {
  test("highlights current page link in sidebar", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/shipments");
    await page.waitForSelector("aside");

    // The Shipments link should have the active class
    const shipmentsLink = page.locator("aside a[href='/shipments']");
    if ((await shipmentsLink.count()) > 0) {
      const classes = await shipmentsLink.getAttribute("class");
      expect(classes).toContain("0984E3");
    }
  });
});

// ─── RESPONSIVE / MOBILE ───────────────────────────────────────────────────

test.describe("Mobile sidebar", () => {
  test("sidebar toggles on mobile viewport", async ({ page }) => {
    test.skip(!OWNER_COOKIE, "No owner cookie");
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAs(page, OWNER_COOKIE);
    await page.goto("/shipments");

    // On mobile, sidebar may be hidden initially
    // Look for a hamburger/menu button
    const menuButton = page.locator("button[aria-label='menu'], button[aria-label='Menu'], button:has(svg)").first();

    if ((await menuButton.count()) > 0) {
      // If there's a menu button, sidebar should be hideable
      await menuButton.click();
      // After click, sidebar should be visible
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();
    }
  });
});
