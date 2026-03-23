import { Page, expect } from "@playwright/test";

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

/**
 * Set a session cookie on the page by calling a test helper endpoint,
 * or by injecting the cookie directly.
 */
export async function loginAs(page: Page, sessionCookie: string) {
  await page.context().addCookies([
    {
      name: "tcf_session",
      value: sessionCookie,
      domain: new URL(BASE).hostname,
      path: "/",
    },
  ]);
}

/**
 * Make an API call from the test and return JSON + status.
 */
export async function apiCall(
  page: Page,
  path: string,
  opts: { method?: string; body?: unknown } = {}
) {
  const result = await page.evaluate(
    async ({ path, method, body }) => {
      const headers: Record<string, string> = {};
      if (body) headers["Content-Type"] = "application/json";
      const res = await fetch(path, {
        method: method || "GET",
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data };
    },
    { path, method: opts.method, body: opts.body }
  );
  return result;
}

/**
 * Check that a sidebar link exists or doesn't exist
 */
export async function sidebarHasLink(page: Page, label: string): Promise<boolean> {
  const nav = page.locator("aside nav");
  const link = nav.locator(`text=${label}`);
  return (await link.count()) > 0;
}

/**
 * Check that certain text is visible on the page
 */
export async function hasText(page: Page, text: string): Promise<boolean> {
  return (await page.locator(`text=${text}`).count()) > 0;
}

export { BASE };
