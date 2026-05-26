import { NextRequest, NextResponse, after } from "next/server";
import { prepareMagicLink } from "@/server/services/auth.service";
import { sendMagicLink } from "@/server/services/email.service";
import { log } from "@/server/logger";

export async function POST(request: NextRequest) {
  const R = "/api/auth/login";
  let rawBody = "";
  try {
    rawBody = await request.text();
    log.info("Magic link request received", { route: R, meta: { body: rawBody } });

    let parsed: { email?: unknown; to?: unknown } = {};
    try {
      parsed = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      log.warn("Magic link request rejected — body is not valid JSON", {
        route: R,
        meta: { body: rawBody, error: String(parseErr) },
      });
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const email = typeof parsed.email === "string" ? parsed.email : undefined;
    const to = typeof parsed.to === "string" ? parsed.to : undefined;

    if (!email) {
      log.warn("Magic link request rejected — no email in body", { route: R, meta: { body: rawBody } });
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    log.info("Magic link requested", { route: R, meta: { email, to: to ?? null } });

    // DB work runs synchronously so we know the user exists before responding.
    // The actual SMTP email send (slow) is deferred via after() so the
    // user gets the "check your email" response immediately.
    const prepared = await prepareMagicLink(email, to);
    if (!prepared) {
      log.warn("Magic link skipped — no user found for email", { route: R, meta: { email } });
    } else {
      log.info("Magic link prepared, queuing email send", { route: R, meta: { email: prepared.email } });
      after(async () => {
        const startedAt = Date.now();
        log.info("Magic link email send starting (deferred)", { route: R, meta: { email: prepared.email } });
        try {
          await sendMagicLink(prepared.email, prepared.url);
          log.info("Magic link email send completed", {
            route: R,
            meta: { email: prepared.email, ms: Date.now() - startedAt },
          });
        } catch (err) {
          log.error("Magic link email send failed (deferred)", err, {
            route: R,
            meta: { email: prepared.email, ms: Date.now() - startedAt },
          });
        }
      });
    }

    return NextResponse.json({ message: "If an account exists, a login link has been sent." });
  } catch (e) {
    log.error("Login magic link request failed", e, { route: R, method: "POST", meta: { body: rawBody } });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
