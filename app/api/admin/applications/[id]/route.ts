import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Application, ApplicationStatus } from "@/server/entities/Application";
import { User, UserRole } from "@/server/entities/User";
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

    // Check if user already exists
    const existing = await userRepo.findOneBy({ email: application.contactEmail });
    let userId: string;

    if (existing) {
      userId = existing.id;
      // Update company name if not set
      if (!existing.companyName) {
        await userRepo.update(existing.id, { companyName: application.companyName });
      }
    } else {
      const user = await userRepo.save({
        email: application.contactEmail,
        role: UserRole.USER,
        companyName: application.companyName,
      });
      userId = user.id;
    }

    await repo.update(id, {
      status: ApplicationStatus.APPROVED,
      userId,
    });

    try {
      await sendApplicationApproved(application.contactEmail, application.companyName);
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
