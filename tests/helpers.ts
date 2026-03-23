/**
 * Test helpers for making authenticated API requests against the running app.
 * Requires the app to be running at TEST_BASE_URL (default: http://localhost:3000).
 *
 * These tests talk to the REAL database — they create real users and orders.
 * Run against a test/staging environment, NOT production.
 */

const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";

interface RequestOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
}

export async function api(path: string, opts: RequestOptions = {}) {
  const headers: Record<string, string> = {};
  if (opts.body) headers["Content-Type"] = "application/json";
  if (opts.cookie) headers["Cookie"] = opts.cookie;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });

  return res;
}

export async function apiJson(path: string, opts: RequestOptions = {}) {
  const res = await api(path, opts);
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text), headers: res.headers };
  } catch {
    return { status: res.status, data: text, headers: res.headers };
  }
}

/**
 * Create a user directly in the DB and get a session cookie for them.
 * This bypasses the magic link flow for test convenience.
 */
export async function createTestSession(overrides: {
  email: string;
  role?: string;
  companyName?: string | null;
  companyId?: string | null;
  companyRole?: string | null;
  permissions?: string[] | null;
}): Promise<string | null> {
  // We need to use the admin API to create users, then generate sessions.
  // For tests, we'll use a special test endpoint or direct DB access.
  // Since we can't easily do that without modifying the app, we'll rely on
  // pre-created test users in the setup.
  return null;
}

/**
 * Extract session cookie from a response
 */
export function getSessionCookie(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/tcf_session=([^;]+)/);
  return match ? `tcf_session=${match[1]}` : null;
}

export { BASE };
