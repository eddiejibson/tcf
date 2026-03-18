import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole } from "@/server/entities/User";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const users = await db.getRepository(User).find({
    order: { createdAt: "DESC" },
    relations: ["orders"],
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      companyName: u.companyName || null,
      orderCount: u.orders?.length || 0,
      creditBalance: Number(u.creditBalance) || 0,
      createdAt: u.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, role, companyName } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const db = await getDb();
  const repo = db.getRepository(User);

  const existing = await repo.findOneBy({ email: email.toLowerCase().trim() });
  if (existing) return NextResponse.json({ error: "User already exists" }, { status: 409 });

  const user = await repo.save({
    email: email.toLowerCase().trim(),
    role: role === "ADMIN" ? UserRole.ADMIN : UserRole.USER,
    companyName: companyName || null,
  });

  return NextResponse.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
}
