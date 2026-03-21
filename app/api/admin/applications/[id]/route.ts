import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Application, ApplicationStatus } from "@/server/entities/Application";
import { User, UserRole, CompanyRole } from "@/server/entities/User";
import { Company } from "@/server/entities/Company";
import { ALL_PERMISSIONS } from "@/server/lib/permissions";
import { Address, AddressType } from "@/server/entities/Address";
import { getDownloadUrl } from "@/server/services/storage.service";
import { sendApplicationApproved, sendApplicationRejected } from "@/server/services/email.service";
import { isUuid } from "@/server/utils";
import { log } from "@/server/logger";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const application = await db.getRepository(Application).findOne({
    where: { id },
  });
  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });

  let licenseFileUrl: string | null = null;
  if (application.licenseFileKey) {
    licenseFileUrl = await getDownloadUrl(application.licenseFileKey);
  }

  const shopPhotoUrls: string[] = [];
  for (const key of application.shopPhotoKeys || []) {
    shopPhotoUrls.push(await getDownloadUrl(key));
  }

  return NextResponse.json({
    ...application,
    licenseFileUrl,
    shopPhotoUrls,
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { action, rejectionReason } = body;

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const db = await getDb();
  const repo = db.getRepository(Application);
  const application = await repo.findOneBy({ id });

  if (!application) return NextResponse.json({ error: "Application not found" }, { status: 404 });
  if (application.status !== ApplicationStatus.PENDING) {
    return NextResponse.json({ error: "Application has already been processed" }, { status: 400 });
  }

  if (action === "approve") {
    const userRepo = db.getRepository(User);
    const companyRepo = db.getRepository(Company);
    const addressRepo = db.getRepository(Address);

    // Create or find Company
    let company = await companyRepo.findOneBy({
      name: application.companyName,
      ...(application.companyNumber ? { companyNumber: application.companyNumber } : {}),
    });

    if (!company) {
      company = await companyRepo.save({
        name: application.companyName,
        companyNumber: application.companyNumber,
      });
    }

    // Create Address records if address data exists
    if (application.billingAddress) {
      await addressRepo.save({
        companyId: company.id,
        type: AddressType.BILLING,
        line1: application.billingAddress.line1,
        line2: application.billingAddress.line2 || null,
        city: application.billingAddress.city,
        county: application.billingAddress.county || null,
        postcode: application.billingAddress.postcode,
        country: application.billingAddress.country || "United Kingdom",
      });
    }

    if (application.shippingAddress) {
      await addressRepo.save({
        companyId: company.id,
        type: AddressType.SHIPPING,
        line1: application.shippingAddress.line1,
        line2: application.shippingAddress.line2 || null,
        city: application.shippingAddress.city,
        county: application.shippingAddress.county || null,
        postcode: application.shippingAddress.postcode,
        country: application.shippingAddress.country || "United Kingdom",
      });
    }

    // Create primary user (contactEmail)
    const existing = await userRepo.findOneBy({ email: application.contactEmail });
    let userId: string;

    if (existing) {
      userId = existing.id;
      await userRepo.update(existing.id, {
        companyName: existing.companyName || application.companyName,
        companyId: company.id,
        companyRole: CompanyRole.OWNER,
      });
    } else {
      const user = await userRepo.save({
        email: application.contactEmail,
        role: UserRole.USER,
        companyName: application.companyName,
        companyId: company.id,
        companyRole: CompanyRole.OWNER,
      });
      userId = user.id;
    }

    // Create second user if accountsEmail differs from contactEmail
    if (
      application.accountsEmail &&
      application.accountsEmail.toLowerCase() !== application.contactEmail.toLowerCase()
    ) {
      const existingAccounts = await userRepo.findOneBy({ email: application.accountsEmail });
      if (!existingAccounts) {
        await userRepo.save({
          email: application.accountsEmail,
          role: UserRole.USER,
          companyName: application.companyName,
          companyId: company.id,
          companyRole: CompanyRole.MEMBER,
          permissions: ALL_PERMISSIONS,
        });
      } else if (!existingAccounts.companyId) {
        await userRepo.update(existingAccounts.id, {
          companyName: existingAccounts.companyName || application.companyName,
          companyId: company.id,
          companyRole: CompanyRole.MEMBER,
          permissions: ALL_PERMISSIONS,
        });
      }
    }

    await repo.update(id, {
      status: ApplicationStatus.APPROVED,
      userId,
    });

    try {
      await sendApplicationApproved(application.contactEmail, application.companyName);
      // Also notify accounts email if different
      if (
        application.accountsEmail &&
        application.accountsEmail.toLowerCase() !== application.contactEmail.toLowerCase()
      ) {
        await sendApplicationApproved(application.accountsEmail, application.companyName);
      }
    } catch (emailErr) {
      log.error("Failed to send application approval email", emailErr, {
        route: "/api/admin/applications/[id]",
        method: "PATCH",
        meta: { applicationId: id },
      });
    }

    const updated = await repo.findOneBy({ id });
    return NextResponse.json(updated);
  }

  // Reject
  await repo.update(id, {
    status: ApplicationStatus.REJECTED,
    rejectionReason: rejectionReason || null,
  });

  try {
    await sendApplicationRejected(application.contactEmail, application.companyName, rejectionReason);
  } catch (emailErr) {
    log.error("Failed to send application rejection email", emailErr, {
      route: "/api/admin/applications/[id]",
      method: "PATCH",
      meta: { applicationId: id },
    });
  }

  const updated = await repo.findOneBy({ id });
  return NextResponse.json(updated);
}
