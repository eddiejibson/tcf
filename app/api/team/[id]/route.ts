import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, CompanyRole } from "@/server/entities/User";
import { ALL_PERMISSIONS } from "@/server/lib/permissions";
import { isUuid } from "@/server/utils";

async function getOwner(userId: string) {
  const db = await getDb();
  const owner = await db.getRepository(User).findOneBy({ id: userId });
  if (!owner) return null;
  if (owner.companyRole === CompanyRole.OWNER && owner.companyId) return owner;
  // Old user with companyName — ensureCompanyOwner in GET /api/team should have fixed them
  if (owner.companyName && owner.companyId) return owner;
  return null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = await getOwner(user.userId);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const userRepo = db.getRepository(User);
  const member = await userRepo.findOneBy({ id });

  if (!member) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (member.companyId !== owner.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (member.companyRole === "OWNER") return NextResponse.json({ error: "Cannot modify owner permissions" }, { status: 400 });

  const { permissions } = await request.json();
  const validPerms = Array.isArray(permissions)
    ? permissions.filter((p: string) => ALL_PERMISSIONS.includes(p as typeof ALL_PERMISSIONS[number]))
    : member.permissions;

  await userRepo.update(id, { permissions: validPerms });

  const updated = await userRepo.findOneBy({ id });
  return NextResponse.json({
    id: updated!.id,
    email: updated!.email,
    companyRole: updated!.companyRole,
    permissions: updated!.permissions,
    lastLogin: updated!.lastLogin,
    createdAt: updated!.createdAt,
  });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const owner = await getOwner(user.userId);
  if (!owner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (id === user.userId) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });

  const db = await getDb();
  const userRepo = db.getRepository(User);
  const member = await userRepo.findOneBy({ id });

  if (!member) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (member.companyId !== owner.companyId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (member.companyRole === "OWNER") return NextResponse.json({ error: "Cannot remove company owner" }, { status: 400 });

  // Preserve user record but remove company access
  await userRepo.update(id, {
    companyId: null,
    companyRole: null,
    permissions: null,
  });

  return NextResponse.json({ ok: true });
}
