import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getDb } from "@/server/db/data-source";
import { Order, OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { OrderPayment, OrderPaymentStatus } from "@/server/entities/OrderPayment";
import { User, UserRole } from "@/server/entities/User";
import { WebhookEvent } from "@/server/entities/WebhookEvent";
import { log } from "@/server/logger";
import { sendOrderPaidNotification } from "@/server/services/email.service";
import { calculateOrderTotals, formatPrice, getOrderById, confirmOrderPayment, checkOrderFullyPaid } from "@/server/services/order.service";

const OK = NextResponse.json({ ok: true });
const PROVIDER = "square";

function verifySignature(body: string, signature: string, url: string): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return false;
  const expected = createHmac("sha256", key)
    .update(url + body)
    .digest("base64");
  // Constant-time compare to avoid leaking timing info on signature checks.
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/**
 * Returns true on first observation of this event ID; false if it's a replay.
 * Square is allowed to retry webhooks (per their docs) — we must not double-apply.
 */
async function recordEventIfNew(eventId: string, eventType: string | null): Promise<boolean> {
  if (!eventId) return true;
  const db = await getDb();
  try {
    await db.getRepository(WebhookEvent).insert({
      provider: PROVIDER,
      eventId,
      eventType,
    });
    return true;
  } catch (e) {
    // Unique constraint violation = already processed
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UQ_webhook_events_provider_eventId") || msg.includes("duplicate key")) {
      return false;
    }
    throw e;
  }
}

async function findOrderPayment(paymentId: string): Promise<OrderPayment | null> {
  const db = await getDb();
  // Find by OrderPayment reference (the Square payment link ID)
  return db.getRepository(OrderPayment).findOne({ where: { reference: paymentId } });
}

async function findOrderLegacy(paymentId: string, referenceId?: string): Promise<Order | null> {
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

  // First try to match against an OrderPayment record (split payments)
  const orderPayment = await findOrderPayment(paymentId);
  if (orderPayment) {
    if (orderPayment.status === OrderPaymentStatus.COMPLETED) return;

    await confirmOrderPayment(orderPayment.id);
    const fullyPaid = await checkOrderFullyPaid(orderPayment.orderId);

    log.info("Square webhook: order payment completed", { route: "/api/webhooks/square", meta: { orderId: orderPayment.orderId, paymentId, fullyPaid } });

    if (fullyPaid) {
      await sendPaidNotification(orderPayment.orderId);
    }
    return;
  }

  // Legacy fallback — match on Order.paymentReference
  const order = await findOrderLegacy(paymentId, referenceId);
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

  log.info("Square webhook: order marked as paid (legacy)", { route: "/api/webhooks/square", meta: { orderId: order.id, paymentId } });

  await sendPaidNotification(order.id);
}

async function sendPaidNotification(orderId: string) {
  try {
    const db = await getDb();
    const fullOrder = await getOrderById(orderId);
    if (fullOrder) {
      const totals = calculateOrderTotals(fullOrder.items, fullOrder.includeShipping, fullOrder.freightCharge, fullOrder.creditApplied, fullOrder.discountPercent);
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
    log.error("Square webhook: failed to send paid notification", e, { route: "/api/webhooks/square", meta: { orderId } });
  }
}

async function handlePaymentFailed(payment: Record<string, unknown>) {
  const paymentId = payment.id as string;
  const referenceId = payment.reference_id as string | undefined;

  const orderPayment = await findOrderPayment(paymentId);
  if (orderPayment) {
    log.warn("Square webhook: payment failed for order payment", { route: "/api/webhooks/square", meta: { orderPaymentId: orderPayment.id, paymentId } });
    return;
  }

  const order = await findOrderLegacy(paymentId, referenceId);
  if (!order) return;
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
    if (verifySignature(body, signature, requestUrl)) {
      log.warn("Square webhook: signature failed with configured URL but matched request URL", { route: R });
    } else {
      log.error("Square webhook: signature verification failed", new Error("Invalid HMAC signature"), { route: R });
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type as string | undefined;
  const eventId = event.event_id as string | undefined;
  const data = (event.data as Record<string, unknown>)?.object as Record<string, unknown> | undefined;

  // Idempotency: short-circuit replays before doing any work.
  if (eventId) {
    const isNew = await recordEventIfNew(eventId, eventType || null);
    if (!isNew) {
      log.info("Square webhook: replay ignored", { route: R, meta: { eventId, eventType } });
      return OK;
    }
  }

  try {
    switch (eventType) {
      // payment.created fires when a payment is first created; payment.updated
      // fires on each state transition. Either can arrive first depending on
      // network timing — handle both with the same status-based dispatch.
      case "payment.created":
      case "payment.updated": {
        const payment = data?.payment as Record<string, unknown> | undefined;
        if (!payment) break;

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

      case "dispute.created":
      case "dispute.state.updated":
      case "dispute.evidence.created":
      case "dispute.evidence.updated": {
        // Surface chargeback events so the team is notified — handled via logs
        // (and Logtail alerts), no automatic state changes.
        log.warn("Square webhook: dispute event", {
          route: R,
          meta: { eventType, eventId, dispute: data?.dispute as Record<string, unknown> | undefined },
        });
        break;
      }

      default:
        log.info("Square webhook: ignored event type", { route: R, meta: { eventType } });
        break;
    }
  } catch (e) {
    log.error("Square webhook processing failed", e, { route: R, meta: { eventType, eventId } });
    // Returning 500 lets Square retry — but only when our processing failed,
    // not on parse/signature problems (those return early above).
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return OK;
}
