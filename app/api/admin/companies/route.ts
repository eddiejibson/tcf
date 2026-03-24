import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Company } from "@/server/entities/Company";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const companies = await db.getRepository(Company).find({
    relations: ["users"],
    order: { createdAt: "DESC" },
  });

  return NextResponse.json(
    companies.map((c) => ({
      id: c.id,
      name: c.name,
      discount: Number(c.discount) || 0,
      userCount: c.users?.length || 0,
      createdAt: c.createdAt,
    }))
  );
}
