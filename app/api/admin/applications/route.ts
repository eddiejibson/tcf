import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Application } from "@/server/entities/Application";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
  const status = searchParams.get("status") || undefined;

  const db = await getDb();
  const repo = db.getRepository(Application);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [applications, total] = await repo.findAndCount({
    where: Object.keys(where).length > 0 ? where : undefined,
    order: { createdAt: "DESC" },
    skip: (page - 1) * limit,
    take: limit,
  });

  return NextResponse.json({
    applications: applications.map((a) => ({
      id: a.id,
      companyName: a.companyName,
      contactName: a.contactName,
      contactEmail: a.contactEmail,
      status: a.status,
      createdAt: a.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
