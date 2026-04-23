import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin } from "@/server/middleware/auth";
import { createSession } from "@/server/services/auth.service";
import { getDb } from "@/server/db/data-source";
import { User } from "@/server/entities/User";
import { isUuid } from "@/server/utils";

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const target = await db.getRepository(User).findOneBy({ id });
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (target.id === admin.userId) {
    return NextResponse.json({ error: "Cannot sudo into yourself" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const adminToken = cookieStore.get("tcf_session")?.value;
  if (!adminToken) return NextResponse.json({ error: "No session" }, { status: 401 });

  const targetJwt = await createSession(target);

  const response = NextResponse.json({ success: true });
  const isProd = process.env.NODE_ENV === "production";

  // Stash admin's current token so we can restore it later
  response.cookies.set("tcf_admin_session", adminToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  // Swap the active session to the target user
  response.cookies.set("tcf_session", targetJwt, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
