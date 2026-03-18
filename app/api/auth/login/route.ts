import { NextRequest, NextResponse } from "next/server";
import { requestMagicLink } from "@/server/services/auth.service";
import { log } from "@/server/logger";

export async function POST(request: NextRequest) {
  try {
    const { email, to } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await requestMagicLink(email, to);

    return NextResponse.json({ message: "If an account exists, a login link has been sent." });
  } catch (e) {
    log.error("Login magic link request failed", e, { route: "/api/auth/login", method: "POST" });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
