import { NextRequest, NextResponse } from "next/server";
import { verifyMagicToken, createSession } from "@/server/services/auth.service";
import { getDb } from "@/server/db/data-source";
import { User } from "@/server/entities/User";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=missing_token", request.url));
  }

  const user = await verifyMagicToken(token);
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url));
  }

  // Update last login timestamp
  const db = await getDb();
  await db.getRepository(User).update(user.id, { lastLogin: new Date() });

  const jwt = await createSession(user);

  const to = request.nextUrl.searchParams.get("to");
  const isValidRedirect = to && to.startsWith("/") && !to.startsWith("//") && !to.includes("://");
  const defaultRedirect = user.role === "ADMIN" ? "/admin/shipments" : "/shipments";
  const redirectUrl = isValidRedirect ? to : defaultRedirect;
  const response = NextResponse.redirect(new URL(redirectUrl, request.url));

  response.cookies.set("tcf_session", jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
