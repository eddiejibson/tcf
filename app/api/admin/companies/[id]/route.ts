import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Company } from "@/server/entities/Company";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { discount } = await request.json();

  if (discount === undefined || discount === null) {
    return NextResponse.json({ error: "Discount is required" }, { status: 400 });
  }

  const num = Number(discount);
  if (isNaN(num) || num < 0 || num > 100) {
    return NextResponse.json({ error: "Discount must be between 0 and 100" }, { status: 400 });
  }

  const db = await getDb();
  const repo = db.getRepository(Company);
  const company = await repo.findOneBy({ id });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  company.discount = num;
  await repo.save(company);

  return NextResponse.json({ id: company.id, name: company.name, discount: Number(company.discount) });
}
