import { NextRequest, NextResponse } from "next/server";
import { requestMagicLink } from "@/server/services/auth.service";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await requestMagicLink(email);

    return NextResponse.json({ message: "If an account exists, a login link has been sent." });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
