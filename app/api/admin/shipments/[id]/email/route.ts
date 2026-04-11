import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getShipmentEmailData, renderShipmentEmail, sendShipmentEmail } from "@/server/services/shipment-email.service";
import { getDb } from "@/server/db/data-source";
import { User, UserRole } from "@/server/entities/User";
import { isUuid } from "@/server/utils";
import { log } from "@/server/logger";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const data = await getShipmentEmailData(id);
    const db = await getDb();
    const recipientCount = await db.getRepository(User).count({ where: { role: UserRole.USER } });
    return NextResponse.json({ ...data, recipientCount });
  } catch (e) {
    log.error("Failed to get shipment email data", e, { meta: { shipmentId: id } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to load shipment" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const { type, subject, intro, testEmails, preview, imageUrls } = body;

    if (!type || !["announcement", "deadline_reminder"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    const introText = intro || (type === "announcement"
      ? "Hi guys,\n\nWe've got a new shipment landing soon with some great stock \uD83D\uDC20 head over to the portal via the button below to check it out and get your orders in before the deadline.\n\nAny problems let me know via WhatsApp.\n\nCheers!\nGav"
      : "Hi guys,\n\nJust a quick heads up. The deadline for this shipment is coming up fast \u23F0 so make sure you've got your orders in if you haven't already.\n\nAny problems let me know via WhatsApp.\n\nCheers!\nGav");

    const images: string[] = Array.isArray(imageUrls) ? imageUrls.filter(Boolean) : [];

    if (preview) {
      const data = await getShipmentEmailData(id);
      const { html, subject: defaultSubject } = renderShipmentEmail(type, data, introText, id, images);
      const db = await getDb();
      const recipientCount = await db.getRepository(User).count({ where: { role: UserRole.USER } });
      return NextResponse.json({ html, subject: subject || defaultSubject, recipientCount });
    }

    const result = await sendShipmentEmail(id, type, introText, subject || undefined, testEmails, images);
    return NextResponse.json(result);
  } catch (e) {
    log.error("Shipment email error", e, { meta: { shipmentId: id } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 500 });
  }
}
