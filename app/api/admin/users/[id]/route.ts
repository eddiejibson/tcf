import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole } from "@/server/entities/User";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { role, companyName } = await request.json();

  const db = await getDb();
  const repo = db.getRepository(User);

  const update: Partial<User> = {};
  if (role !== undefined) update.role = role === "ADMIN" ? UserRole.ADMIN : UserRole.USER;
  if (companyName !== undefined) update.companyName = companyName || null;
  await repo.update(id, update);
  const user = await repo.findOneBy({ id });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ id: user.id, email: user.email, role: user.role });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = await getDb();
  const result = await db.getRepository(User).delete(id);

  if (!result.affected) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
