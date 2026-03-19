import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { getDb } from "@/server/db/data-source";
import { Order, OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { log } from "@/server/logger";

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
  const body = await request.text();
  const signature = request.headers.get("x-square-hmacsha256-signature") || "";
  const url = `${process.env.MAGIC_LINK_BASE_URL}/api/webhooks/square`;

  if (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY && !verifySignature(body, signature, url)) {
    log.warn("Square webhook signature verification failed", { route: "/api/webhooks/square" });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data = (event.data as Record<string, unknown>)?.object as Record<string, unknown> | undefined;

  try {
    switch (event.type) {
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

      default:
        break;
    }
  } catch (e) {
    log.error("Square webhook processing failed", e, { route: "/api/webhooks/square", meta: { type: event.type } });
  }

  return OK;
}
