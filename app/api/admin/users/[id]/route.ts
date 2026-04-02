import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { User, UserRole } from "@/server/entities/User";
import { Application } from "@/server/entities/Application";
import { Address } from "@/server/entities/Address";
import { Company } from "@/server/entities/Company";
import { MagicLink } from "@/server/entities/MagicLink";
import { CreditTransaction } from "@/server/entities/CreditTransaction";
import { Order } from "@/server/entities/Order";
import { Shipment } from "@/server/entities/Shipment";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const user = await db.getRepository(User).findOne({
    where: { id },
    relations: ["orders", "company"],
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get company with addresses and users
  let addresses: Address[] = [];
  let company: Company | null = null;
  let companyUsers: User[] = [];
  if (user.companyId) {
    company = await db.getRepository(Company).findOneBy({ id: user.companyId });
    addresses = await db.getRepository(Address).find({ where: { companyId: user.companyId } });
    companyUsers = await db.getRepository(User).find({ where: { companyId: user.companyId } });
  }

  // Find application by email
  const application = await db.getRepository(Application).findOne({
    where: [
      { contactEmail: user.email },
      { userId: user.id },
    ],
    order: { createdAt: "DESC" },
  });

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    companyName: user.companyName,
    companyId: user.companyId,
    companyRole: user.companyRole,
    creditBalance: Number(user.creditBalance) || 0,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    orderCount: user.orders?.length || 0,
    company: company ? {
      id: company.id,
      name: company.name,
      companyNumber: company.companyNumber,
      discount: Number(company.discount) || 0,
      users: companyUsers.map((u) => ({ id: u.id, email: u.email, companyRole: u.companyRole })),
    } : null,
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
    application: application ? {
      id: application.id,
      companyName: application.companyName,
      companyNumber: application.companyNumber,
      contactName: application.contactName,
      contactEmail: application.contactEmail,
      phone: application.phone,
      accountsName: application.accountsName,
      accountsEmail: application.accountsEmail,
      additionalInfo: application.additionalInfo,
      status: application.status,
      billingAddress: application.billingAddress,
      shippingAddress: application.shippingAddress,
      createdAt: application.createdAt,
    } : null,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();

  const db = await getDb();
  const userRepo = db.getRepository(User);

  const user = await userRepo.findOneBy({ id });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Update user fields
  const { role, companyName, email } = body;
  const update: Record<string, unknown> = {};
  if (role !== undefined) update.role = role === "ADMIN" ? UserRole.ADMIN : UserRole.USER;
  if (companyName !== undefined) update.companyName = companyName || null;
  if (email !== undefined) update.email = email.toLowerCase().trim();
  if (Object.keys(update).length > 0) await userRepo.update(id, update);

  // Update company fields if provided
  if (body.companyNumber !== undefined && user.companyId) {
    await db.getRepository(Company).update(user.companyId, { companyNumber: body.companyNumber || null });
  }

  // Update addresses if provided
  if (body.addresses) {
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

  const updated = await userRepo.findOneBy({ id });
  return NextResponse.json({ id: updated!.id, email: updated!.email, role: updated!.role });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await getDb();

  const user = await db.getRepository(User).findOneBy({ id });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await db.transaction(async (em) => {
    await em.getRepository(MagicLink).delete({ userId: id });
    await em.getRepository(CreditTransaction).delete({ userId: id });
    await em.getRepository(Order).update({ userId: id }, { userId: null });
    await em.getRepository(Application).update({ userId: id }, { userId: null });
    await em.getRepository(Shipment).update({ createdById: id }, { createdById: admin.userId });
    await em.getRepository(User).update({ invitedById: id }, { invitedById: null });
    await em.getRepository(User).delete(id);
  });

  return NextResponse.json({ success: true });
}
