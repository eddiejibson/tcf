import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/server/services/auth.service";

export async function POST() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get("tcf_admin_session")?.value;
  if (!adminToken) {
    return NextResponse.json({ error: "Not impersonating" }, { status: 400 });
  }

  // Verify the stashed token still validates and belongs to an admin
  try {
    const payload = await verifySession(adminToken);
    if (payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Invalid admin token" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid admin token" }, { status: 403 });
  }

  const response = NextResponse.json({ success: true });
  const isProd = process.env.NODE_ENV === "production";

  response.cookies.set("tcf_session", adminToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
  response.cookies.set("tcf_admin_session", "", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
