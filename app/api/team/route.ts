import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole, CompanyRole } from "@/server/entities/User";
import { Company } from "@/server/entities/Company";
import { ALL_PERMISSIONS, PERMISSION_LABELS, Permission } from "@/server/lib/permissions";
import { requestMagicLink } from "@/server/services/auth.service";
import { sendTeamInvite } from "@/server/services/email.service";

/**
 * Ensures the requesting user has a Company + OWNER role.
 * Old users may have companyName but no companyId — auto-provision for them.
 */
async function ensureCompanyOwner(userId: string): Promise<{ companyId: string; owner: User } | null> {
  const db = await getDb();
  const userRepo = db.getRepository(User);
  const owner = await userRepo.findOneBy({ id: userId });
  if (!owner) return null;

  // Already fully set up
  if (owner.companyId && owner.companyRole === CompanyRole.OWNER) {
    return { companyId: owner.companyId, owner };
  }

  // Has companyName but no companyId — auto-create a Company
  if (owner.companyName && !owner.companyId) {
    const companyRepo = db.getRepository(Company);
    const company = await companyRepo.save({ name: owner.companyName });
    await userRepo.update(owner.id, {
      companyId: company.id,
      companyRole: CompanyRole.OWNER,
    });
    owner.companyId = company.id;
    owner.companyRole = CompanyRole.OWNER;
    return { companyId: company.id, owner };
  }

  // Has companyId but missing OWNER role — fix it
  if (owner.companyId && !owner.companyRole) {
    await userRepo.update(owner.id, { companyRole: CompanyRole.OWNER });
    owner.companyRole = CompanyRole.OWNER;
    return { companyId: owner.companyId, owner };
  }

  return null;
}

function isCompanyAdmin(user: { role: string; companyRole?: string | null; companyName?: string | null }) {
  return user.companyRole === "OWNER" || (!!user.companyName && user.companyRole !== "MEMBER");
}

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check client-side eligibility first
  const dbCheck = await ensureCompanyOwner(user.userId);
  if (!dbCheck && !isCompanyAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = dbCheck || await ensureCompanyOwner(user.userId);
  if (!result) return NextResponse.json({ error: "No company found" }, { status: 400 });

  const db = await getDb();
  const members = await db.getRepository(User).find({
    where: { companyId: result.companyId },
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

  const result = await ensureCompanyOwner(user.userId);
  if (!result) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const member = await userRepo.save({
    email: cleanEmail,
    role: UserRole.USER,
    companyRole: CompanyRole.MEMBER,
    companyId: result.companyId,
    companyName: result.owner.companyName || null,
    permissions: validPerms,
    invitedById: user.userId,
  });

  // Send invite email with a login link
  const baseUrl = process.env.MAGIC_LINK_BASE_URL || "http://localhost:3000";
  const permLabels = validPerms.map((p: string) => PERMISSION_LABELS[p as Permission]?.label).filter(Boolean);
  await requestMagicLink(cleanEmail);
  await sendTeamInvite(
    cleanEmail,
    `${baseUrl}/login?email=${encodeURIComponent(cleanEmail)}`,
    result.owner.email || "your company owner",
    result.owner.companyName || null,
    permLabels,
  );

  return NextResponse.json({
    id: member.id,
    email: member.email,
    companyRole: member.companyRole,
    permissions: member.permissions,
    lastLogin: member.lastLogin,
    createdAt: member.createdAt,
  }, { status: 201 });
}
