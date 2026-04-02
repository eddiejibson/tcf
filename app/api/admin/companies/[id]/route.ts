import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Company } from "@/server/entities/Company";
import { User } from "@/server/entities/User";
import { Address } from "@/server/entities/Address";
import { sendApplicationApproved } from "@/server/services/email.service";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const company = await db.getRepository(Company).findOneBy({ id });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const users = await db.getRepository(User).find({ where: { companyId: id } });
  const addresses = await db.getRepository(Address).find({ where: { companyId: id } });

  return NextResponse.json({
    id: company.id,
    name: company.name,
    companyNumber: company.companyNumber,
    discount: Number(company.discount) || 0,
    createdAt: company.createdAt,
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      companyRole: u.companyRole,
      lastLogin: u.lastLogin,
    })),
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();

  const db = await getDb();
  const repo = db.getRepository(Company);
  const company = await repo.findOneBy({ id });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  // Resend welcome emails
  if (body.resendWelcome) {
    const users = await db.getRepository(User).find({ where: { companyId: id } });
    let sent = 0;
    for (const u of users) {
      sendApplicationApproved(u.email, company.name).catch((e) =>
        log.error("Failed to send welcome email", e, { meta: { email: u.email, companyId: id } })
      );
      sent++;
    }
    return NextResponse.json({ sent });
  }

  // Update company fields
  if (body.name !== undefined) company.name = body.name;
  if (body.companyNumber !== undefined) company.companyNumber = body.companyNumber || null;
  if (body.discount !== undefined) {
    const num = Number(body.discount);
    if (!isNaN(num) && num >= 0 && num <= 100) company.discount = num;
  }
  await repo.save(company);

  // Update addresses
  if (body.addresses && Array.isArray(body.addresses)) {
    const addressRepo = db.getRepository(Address);
    for (const addr of body.addresses) {
      if (addr.id) {
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
  }

  // Also update companyName on all linked users
  if (body.name !== undefined) {
    await db.getRepository(User).update({ companyId: id }, { companyName: body.name });
  }

  return NextResponse.json({ id: company.id, name: company.name, discount: Number(company.discount) });
}
