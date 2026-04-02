import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Company } from "@/server/entities/Company";
import { User, UserRole, CompanyRole } from "@/server/entities/User";
import { Address, AddressType } from "@/server/entities/Address";
import { ALL_PERMISSIONS } from "@/server/lib/permissions";
import { sendApplicationApproved } from "@/server/services/email.service";
import { log } from "@/server/logger";

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
      creditBalance: Number(c.creditBalance) || 0,
      userCount: c.users?.length || 0,
      createdAt: c.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { companyName, companyNumber, contactEmail, accountsEmail, billingAddress, shippingAddress, additionalUsers, linkUserIds } = body;

  if (!companyName?.trim()) return NextResponse.json({ error: "Company name is required" }, { status: 400 });
  if (!contactEmail?.trim()) return NextResponse.json({ error: "Primary contact email is required" }, { status: 400 });

  const db = await getDb();
  const companyRepo = db.getRepository(Company);
  const userRepo = db.getRepository(User);
  const addressRepo = db.getRepository(Address);

  const company = await companyRepo.save({
    name: companyName.trim(),
    companyNumber: companyNumber?.trim() || null,
  });

  if (billingAddress?.line1?.trim()) {
    await addressRepo.save({
      companyId: company.id,
      type: AddressType.BILLING,
      line1: billingAddress.line1.trim(),
      line2: billingAddress.line2?.trim() || null,
      city: billingAddress.city?.trim() || "",
      county: billingAddress.county?.trim() || null,
      postcode: billingAddress.postcode?.trim() || "",
      country: billingAddress.country?.trim() || "United Kingdom",
    });
  }

  if (shippingAddress?.line1?.trim()) {
    await addressRepo.save({
      companyId: company.id,
      type: AddressType.SHIPPING,
      line1: shippingAddress.line1.trim(),
      line2: shippingAddress.line2?.trim() || null,
      city: shippingAddress.city?.trim() || "",
      county: shippingAddress.county?.trim() || null,
      postcode: shippingAddress.postcode?.trim() || "",
      country: shippingAddress.country?.trim() || "United Kingdom",
    });
  }

  // Track processed emails to avoid dupes, and newly created for welcome emails
  const processed = new Set<string>();
  const newlyCreated = new Set<string>();

  // Primary contact → OWNER
  const primaryEmail = contactEmail.trim().toLowerCase();
  let existing = await userRepo.findOneBy({ email: primaryEmail });
  if (existing) {
    await userRepo.update(existing.id, { companyName: companyName.trim(), companyId: company.id, companyRole: CompanyRole.OWNER });
  } else {
    await userRepo.save({ email: primaryEmail, role: UserRole.USER, companyName: companyName.trim(), companyId: company.id, companyRole: CompanyRole.OWNER });
    newlyCreated.add(primaryEmail);
  }
  processed.add(primaryEmail);

  // Accounts contact → MEMBER
  if (accountsEmail?.trim() && !processed.has(accountsEmail.trim().toLowerCase())) {
    const accEmail = accountsEmail.trim().toLowerCase();
    existing = await userRepo.findOneBy({ email: accEmail });
    if (existing && !existing.companyId) {
      await userRepo.update(existing.id, { companyName: companyName.trim(), companyId: company.id, companyRole: CompanyRole.MEMBER, permissions: ALL_PERMISSIONS });
    } else if (!existing) {
      await userRepo.save({ email: accEmail, role: UserRole.USER, companyName: companyName.trim(), companyId: company.id, companyRole: CompanyRole.MEMBER, permissions: ALL_PERMISSIONS });
      newlyCreated.add(accEmail);
    }
    processed.add(accEmail);
  }

  // Additional users → MEMBER
  if (additionalUsers && Array.isArray(additionalUsers)) {
    for (const u of additionalUsers) {
      const email = u.email?.trim()?.toLowerCase();
      if (!email || processed.has(email)) continue;
      existing = await userRepo.findOneBy({ email });
      if (!existing) {
        await userRepo.save({ email, role: UserRole.USER, companyName: companyName.trim(), companyId: company.id, companyRole: CompanyRole.MEMBER, permissions: ALL_PERMISSIONS });
        newlyCreated.add(email);
      }
      processed.add(email);
    }
  }

  // Link existing users by ID (no welcome email — they already have accounts)
  if (linkUserIds && Array.isArray(linkUserIds)) {
    for (const uid of linkUserIds) {
      const u = await userRepo.findOneBy({ id: uid });
      if (u && !u.companyId && !processed.has(u.email.toLowerCase())) {
        await userRepo.update(uid, { companyName: companyName.trim(), companyId: company.id, companyRole: CompanyRole.MEMBER });
        processed.add(u.email.toLowerCase());
      }
    }
  }

  // Only send welcome email to newly created users, not existing ones
  for (const email of newlyCreated) {
    sendApplicationApproved(email, companyName.trim()).catch((e) =>
      log.error("Failed to send welcome email", e, { meta: { email, companyId: company.id } })
    );
  }

  return NextResponse.json({ id: company.id, name: company.name, usersCreated: processed.size }, { status: 201 });
}
