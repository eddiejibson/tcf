import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User } from "@/server/entities/User";
import { Company } from "@/server/entities/Company";
import { Address } from "@/server/entities/Address";

export async function GET() {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const user = await db.getRepository(User).findOneBy({ id: auth.userId });
  if (!user?.companyId) return NextResponse.json({ error: "No company linked" }, { status: 404 });

  const company = await db.getRepository(Company).findOneBy({ id: user.companyId });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const addresses = await db.getRepository(Address).find({ where: { companyId: company.id } });

  return NextResponse.json({
    id: company.id,
    name: company.name,
    companyNumber: company.companyNumber,
    addresses: addresses.map((a) => ({
      id: a.id,
      type: a.type,
      line1: a.line1,
      line2: a.line2,
      city: a.city,
      county: a.county,
      postcode: a.postcode,
      country: a.country,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = await getDb();
  const user = await db.getRepository(User).findOneBy({ id: auth.userId });
  if (!user?.companyId) return NextResponse.json({ error: "No company linked" }, { status: 404 });

  const body = await request.json();
  const addressRepo = db.getRepository(Address);

  // Only allow updating addresses
  if (body.addresses && Array.isArray(body.addresses)) {
    for (const addr of body.addresses) {
      if (!addr.id) continue;
      // Verify the address belongs to this company
      const existing = await addressRepo.findOneBy({ id: addr.id, companyId: user.companyId });
      if (!existing) continue;
      await addressRepo.update(addr.id, {
        line1: addr.line1,
        line2: addr.line2 || null,
        city: addr.city,
        county: addr.county || null,
        postcode: addr.postcode,
        country: addr.country || "United Kingdom",
      });
    }
  }

  return NextResponse.json({ success: true });
}
