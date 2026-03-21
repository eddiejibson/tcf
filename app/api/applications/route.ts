import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db/data-source";
import { Application, ApplicationStatus } from "@/server/entities/Application";
import { User, UserRole } from "@/server/entities/User";
import { sendApplicationNotification } from "@/server/services/email.service";
import { log } from "@/server/logger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const companyName = (body.companyName as string)?.trim();
    const contactName = (body.contactName as string)?.trim();
    const contactEmail = (body.contactEmail as string)?.trim()?.toLowerCase();
    const companyNumber = (body.companyNumber as string)?.trim() || null;
    const phone = (body.phone as string)?.trim() || null;
    const accountsName = (body.accountsName as string)?.trim() || null;
    const accountsEmail = (body.accountsEmail as string)?.trim()?.toLowerCase() || null;
    const additionalInfo = (body.additionalInfo as string)?.trim() || null;
    const licenseFileKey = (body.licenseFileKey as string) || null;
    const shopPhotoKeys: string[] = Array.isArray(body.shopPhotoKeys) ? body.shopPhotoKeys : [];
    const billingAddress = body.billingAddress || null;
    const shippingAddress = body.shippingAddress || null;

    if (!companyName || !contactName || !contactEmail) {
      return NextResponse.json(
        { error: "Company name, contact name, and email are required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const repo = db.getRepository(Application);

    const application = await repo.save({
      companyName,
      companyNumber,
      contactName,
      contactEmail,
      phone,
      accountsName,
      accountsEmail,
      licenseFileKey,
      shopPhotoKeys,
      additionalInfo,
      billingAddress,
      shippingAddress,
      status: ApplicationStatus.PENDING,
    });

    // Notify admins
    try {
      const adminUsers = await db.getRepository(User).find({
        where: { role: UserRole.ADMIN },
        select: ["email"],
      });
      const adminEmails = adminUsers.map((u) => u.email);
      if (adminEmails.length > 0) {
        await sendApplicationNotification(adminEmails, companyName, application.id);
      }
    } catch (emailErr) {
      log.error("Failed to send application notification email", emailErr, {
        route: "/api/applications",
        method: "POST",
      });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    log.error("Application submission failed", e, {
      route: "/api/applications",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Failed to submit application" },
      { status: 500 }
    );
  }
}
