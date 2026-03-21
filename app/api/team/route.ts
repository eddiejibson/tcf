import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole, CompanyRole } from "@/server/entities/User";
import { ALL_PERMISSIONS } from "@/server/lib/permissions";
import { requestMagicLink } from "@/server/services/auth.service";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.companyRole !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const db = await getDb();
  const members = await db.getRepository(User).find({
    where: { companyId: user.companyId },
    order: { createdAt: "ASC" },
  });

  return NextResponse.json(
    members.map((m) => ({
      id: m.id,
      email: m.email,
      companyRole: m.companyRole,
      permissions: m.permissions,
      lastLogin: m.lastLogin,
      createdAt: m.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.companyRole !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!user.companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const { email, permissions } = await request.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();

  // Validate permissions
  const validPerms = Array.isArray(permissions)
    ? permissions.filter((p: string) => ALL_PERMISSIONS.includes(p as typeof ALL_PERMISSIONS[number]))
    : ALL_PERMISSIONS;

  const db = await getDb();
  const userRepo = db.getRepository(User);

  const existing = await userRepo.findOneBy({ email: cleanEmail });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
  }

  // Get owner's company name
  const owner = await userRepo.findOneBy({ id: user.userId });

  const member = await userRepo.save({
    email: cleanEmail,
    role: UserRole.USER,
    companyRole: CompanyRole.MEMBER,
    companyId: user.companyId,
    companyName: owner?.companyName || null,
    permissions: validPerms,
    invitedById: user.userId,
  });

  // Send magic link so they can log in
  await requestMagicLink(cleanEmail);

  return NextResponse.json({
    id: member.id,
    email: member.email,
    companyRole: member.companyRole,
    permissions: member.permissions,
    lastLogin: member.lastLogin,
    createdAt: member.createdAt,
  }, { status: 201 });
}
