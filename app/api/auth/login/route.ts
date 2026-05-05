import { NextRequest, NextResponse, after } from "next/server";
import { prepareMagicLink } from "@/server/services/auth.service";
import { sendMagicLink } from "@/server/services/email.service";
import { log } from "@/server/logger";

export async function POST(request: NextRequest) {
  try {
    const { email, to } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // DB work runs synchronously so we know the user exists before responding.
    // The actual Cloudflare email send (slow) is deferred via after() so the
    // user gets the "check your email" response immediately.
    const prepared = await prepareMagicLink(email, to);
    if (prepared) {
      after(async () => {
        try {
          await sendMagicLink(prepared.email, prepared.url);
        } catch (err) {
          log.error("Magic link email send failed (deferred)", err, {
            route: "/api/auth/login",
            meta: { email: prepared.email },
          });
        }
      });
    }

    return NextResponse.json({ message: "If an account exists, a login link has been sent." });
  } catch (e) {
    log.error("Login magic link request failed", e, { route: "/api/auth/login", method: "POST" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
