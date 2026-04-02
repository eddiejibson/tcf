import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole, CompanyRole } from "@/server/entities/User";
import { ILike } from "typeorm";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const excludeAdmins = searchParams.get("role") === "USER";
  const search = searchParams.get("search")?.trim() || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));

  const db = await getDb();
  const repo = db.getRepository(User);

  const where: Record<string, unknown>[] = [];
  if (search) {
    const like = ILike(`%${search}%`);
    if (excludeAdmins) {
      where.push(
        { email: like, role: UserRole.USER },
        { companyName: like, role: UserRole.USER },
      );
    } else {
      where.push({ email: like }, { companyName: like });
    }
  } else if (excludeAdmins) {
    where.push({ role: UserRole.USER });
  }

  const [users, total] = await repo.findAndCount({
    where: where.length > 0 ? where : undefined,
    order: { createdAt: "DESC" },
    relations: ["orders"],
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      companyName: u.companyName || null,
      orderCount: u.orders?.length || 0,
      creditBalance: Number(u.creditBalance) || 0,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { email, role, companyName, companyId } = await request.json();
  if (!email) return NextResponse.json({ error: "Email is required" }, { status: 400 });

  const isAdmin = role === "ADMIN";
  if (!isAdmin && !companyId) return NextResponse.json({ error: "Company is required for non-admin users" }, { status: 400 });

  const db = await getDb();
  const repo = db.getRepository(User);

  const existing = await repo.findOneBy({ email: email.toLowerCase().trim() });
  if (existing) return NextResponse.json({ error: "User already exists" }, { status: 409 });

  // Look up company name if companyId provided
  let resolvedCompanyName = (companyName || "").trim();
  if (companyId) {
    const { Company } = await import("@/server/entities/Company");
    const company = await db.getRepository(Company).findOneBy({ id: companyId });
    if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
    resolvedCompanyName = company.name;
  }

  const user = await repo.save({
    email: email.toLowerCase().trim(),
    role: isAdmin ? UserRole.ADMIN : UserRole.USER,
    companyName: resolvedCompanyName || null,
    companyId: isAdmin ? null : (companyId || null),
    companyRole: isAdmin ? null : CompanyRole.MEMBER,
  });

  return NextResponse.json({ id: user.id, email: user.email, role: user.role, createdAt: user.createdAt });
}
