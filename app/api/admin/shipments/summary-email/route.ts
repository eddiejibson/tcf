import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { audit } from "@/server/services/audit.service";
import { getSummaryEmailData, renderSummaryEmail, sendSummaryEmail } from "@/server/services/shipment-email.service";
import { getDb } from "@/server/db/data-source";
import { User, UserRole } from "@/server/entities/User";
import { log } from "@/server/logger";

const DEFAULT_INTRO =
  "Hi guys,\n\nHere's a quick roundup of everything we've got open for order right now 🐠 tap any shipment below to view the stock and get your orders in before the deadlines.\n\nAny problems let me know via WhatsApp.\n\nCheers!\nGav";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const data = await getSummaryEmailData();
    const db = await getDb();
    const recipientCount = await db.getRepository(User).count({ where: { role: UserRole.USER } });
    return NextResponse.json({ ...data, recipientCount });
  } catch (e) {
    log.error("Failed to get summary email data", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await request.json();
    const { subject, intro, testEmails, preview, imageUrls } = body;

    const introText = intro || DEFAULT_INTRO;
    const images: string[] = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];

    const data = await getSummaryEmailData();

    if (preview) {
      const { html, subject: defaultSubject } = renderSummaryEmail(data, introText, subject || undefined, images);
      const db = await getDb();
      const recipientCount = await db.getRepository(User).count({ where: { role: UserRole.USER } });
      return NextResponse.json({ html, subject: subject || defaultSubject, recipientCount, count: data.count });
    }

    if (data.count === 0) {
      return NextResponse.json({ error: "No active shipments to summarise" }, { status: 400 });
    }

    const result = await sendSummaryEmail(introText, subject || undefined, testEmails, images);
    await audit(admin, "shipment.summary_email_send", "shipment", null, {
      subject: subject || null,
      test: !!testEmails?.length,
      shipmentCount: data.count,
    });
    return NextResponse.json(result);
  } catch (e) {
    log.error("Summary email error", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}
