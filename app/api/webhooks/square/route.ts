import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getDb } from "@/server/db/data-source";
import { Order, OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { User, UserRole } from "@/server/entities/User";
import { log } from "@/server/logger";
import { sendOrderPaidNotification } from "@/server/services/email.service";
import { calculateOrderTotals, formatPrice, getOrderById } from "@/server/services/order.service";

const OK = NextResponse.json({ ok: true });

function verifySignature(body: string, signature: string, url: string): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return false;
  const hmac = createHmac("sha256", key)
    .update(url + body)
    .digest("base64");
  return hmac === signature;
}

async function findOrder(paymentId: string, referenceId?: string): Promise<Order | null> {
  const db = await getDb();
  const repo = db.getRepository(Order);

  if (referenceId) {
    const order = await repo.findOne({ where: { id: referenceId } });
    if (order) return order;
  }

  return repo.findOne({ where: { paymentReference: paymentId } });
}

async function handlePaymentCompleted(payment: Record<string, unknown>) {
  const paymentId = payment.id as string;
  const referenceId = payment.reference_id as string | undefined;

  const order = await findOrder(paymentId, referenceId);
  if (!order) {
    log.info("Square webhook: no matching order for payment", { route: "/api/webhooks/square", meta: { paymentId, referenceId } });
    return;
  }

  if (order.status === OrderStatus.PAID) return;

  const db = await getDb();
  order.status = OrderStatus.PAID;
  order.paymentMethod = PaymentMethod.CARD;
  order.paymentReference = paymentId;
  await db.getRepository(Order).save(order);

  log.info("Square webhook: order marked as paid", { route: "/api/webhooks/square", meta: { orderId: order.id, paymentId } });

  // Notify admins
  try {
    const fullOrder = await getOrderById(order.id);
    if (fullOrder) {
      const totals = calculateOrderTotals(fullOrder.items, fullOrder.includeShipping, fullOrder.freightCharge, fullOrder.creditApplied);
      const adminUsers = await db.getRepository(User).find({ where: { role: UserRole.ADMIN } });
      const adminEmails = adminUsers.map((u) => u.email);
      await sendOrderPaidNotification(
        adminEmails,
        fullOrder.user!.email,
        fullOrder.id.slice(0, 8).toUpperCase(),
        formatPrice(totals.total),
        "CARD",
        fullOrder.id,
      );
    }
  } catch (e) {
    log.error("Square webhook: failed to send paid notification", e, { route: "/api/webhooks/square", meta: { orderId: order.id } });
  }
}

async function handlePaymentFailed(payment: Record<string, unknown>) {
  const paymentId = payment.id as string;
  const referenceId = payment.reference_id as string | undefined;

  const order = await findOrder(paymentId, referenceId);
  if (!order) return;

  // Don't revert if already paid
  if (order.status === OrderStatus.PAID) return;

  log.warn("Square webhook: payment failed", { route: "/api/webhooks/square", meta: { orderId: order.id, paymentId } });
}

async function handleRefund(refund: Record<string, unknown>) {
  const paymentId = refund.payment_id as string;
  if (!paymentId) return;

  const db = await getDb();
  const order = await db.getRepository(Order).findOne({ where: { paymentReference: paymentId } });
  if (!order) return;

  log.warn("Square webhook: refund received", {
    route: "/api/webhooks/square",
    meta: { orderId: order.id, paymentId, refundId: refund.id as string, status: refund.status as string },
  });
}

export async function POST(request: NextRequest) {
  const R = "/api/webhooks/square";
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  const hasSignatureKey = !!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL
    || `${process.env.MAGIC_LINK_BASE_URL}/api/webhooks/square`;
  const requestUrl = request.url.replace(/\?.*$/, "");

  log.info("Square webhook: incoming request", { route: R, meta: {
    hasSignature: !!signature,
    hasSignatureKey,
    notificationUrl,
    requestUrl,
    bodyLength: body.length,
    urlsMatch: notificationUrl === requestUrl,
  } });

  if (!hasSignatureKey) {
    log.warn("Square webhook: SQUARE_WEBHOOK_SIGNATURE_KEY not set, skipping signature verification", { route: R });
  } else if (!signature) {
    log.warn("Square webhook: no x-square-hmacsha256-signature header present, rejecting", { route: R });
    return NextResponse.json({ error: "Missing signature" }, { status: 403 });
  } else if (!verifySignature(body, signature, notificationUrl)) {
    // Retry with the incoming request URL in case the configured base URL doesn't match
    if (verifySignature(body, signature, requestUrl)) {
      log.warn("Square webhook: signature failed with configured URL but matched request URL — update SQUARE_WEBHOOK_URL or MAGIC_LINK_BASE_URL", { route: R, meta: {
        configuredUrl: notificationUrl,
        requestUrl,
      } });
    } else {
      log.error("Square webhook: signature verification failed", new Error("Invalid HMAC signature"), { route: R, meta: {
        reason: "HMAC mismatch on both configured and request URLs",
        configuredUrl: notificationUrl,
        requestUrl,
        signatureReceived: signature.slice(0, 10) + "...",
        bodyPreview: body.slice(0, 200),
      } });
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  } else {
    log.info("Square webhook: signature verified OK", { route: R });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    log.warn("Square webhook: invalid JSON body", { route: R, meta: { bodyPreview: body.slice(0, 200) } });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type as string | undefined;
  log.info("Square webhook: processing event", { route: R, meta: { eventType, eventId: event.event_id as string | undefined } });

  const data = (event.data as Record<string, unknown>)?.object as Record<string, unknown> | undefined;

  try {
    switch (eventType) {
      case "payment.updated": {
        const payment = data?.payment as Record<string, unknown> | undefined;
        if (!payment) {
          log.warn("Square webhook: payment.updated event has no payment data", { route: R, meta: { dataKeys: data ? Object.keys(data) : [] } });
          break;
        }

        log.info("Square webhook: payment status", { route: R, meta: {
          paymentId: payment.id,
          status: payment.status,
          referenceId: payment.reference_id,
        } });

        if (payment.status === "COMPLETED") {
          await handlePaymentCompleted(payment);
        } else if (payment.status === "FAILED" || payment.status === "CANCELED") {
          await handlePaymentFailed(payment);
        }
        break;
      }

      case "refund.created":
      case "refund.updated": {
        const refund = data?.refund as Record<string, unknown> | undefined;
        if (refund) await handleRefund(refund);
        break;
      }

      default:
        log.info("Square webhook: unhandled event type, ignoring", { route: R, meta: { eventType } });
        break;
    }
  } catch (e) {
    log.error("Square webhook processing failed", e, { route: R, meta: { eventType } });
  }

  return OK;
}
