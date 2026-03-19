import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getOrderById, setPaymentMethod, clearPaymentMethod, confirmBankTransferSent, markOrderPaid, calculateOrderTotals } from "@/server/services/order.service";
import { OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { createPaymentLink, isPaymentLinkPaid, BANK_DETAILS } from "@/server/services/payment.service";
import { log } from "@/server/logger";

function generateIwocaPayUrl(orderId: string, total: number, companyName?: string | null, email?: string) {
  const slug = (companyName || email?.split("@")[0] || "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const ref = `${slug}-order-${orderId.slice(0, 8)}`;
  const amount = total.toFixed(2);
  return `https://iwocapay.me/the-coral-farm-ltd?amount=${amount}&reference=${encodeURIComponent(ref)}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { method, action } = body;

  if (action === "verify_card") {
    if (order.paymentMethod !== PaymentMethod.CARD || !order.paymentReference) {
      return NextResponse.json({ error: "No card payment to verify" }, { status: 400 });
    }
    const paid = await isPaymentLinkPaid(order.paymentReference);
    if (paid) {
      await markOrderPaid(id, order.paymentReference);
      return NextResponse.json({ status: "PAID" });
    }
    return NextResponse.json({ status: order.status });
  }

  if (action === "confirm_bank_sent") {
    if (order.status !== OrderStatus.ACCEPTED || (order.paymentMethod !== PaymentMethod.BANK_TRANSFER && order.paymentMethod !== PaymentMethod.FINANCE)) {
      return NextResponse.json({ error: "Invalid state for payment confirmation" }, { status: 400 });
    }
    await confirmBankTransferSent(id);
    return NextResponse.json({ status: "AWAITING_PAYMENT" });
  }

  if (order.status !== OrderStatus.ACCEPTED) {
    return NextResponse.json({ error: "Order must be accepted before payment" }, { status: 400 });
  }

  if (method === "BANK_TRANSFER") {
    await setPaymentMethod(id, PaymentMethod.BANK_TRANSFER);
    return NextResponse.json({ method: "BANK_TRANSFER", bankDetails: BANK_DETAILS });
  }

  if (method === "CARD") {
    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    const totalPence = Math.round(totals.total * 100);
    const redirectUrl = `${process.env.MAGIC_LINK_BASE_URL}/orders/${id}?payment=success`;

    try {
      const link = await createPaymentLink(
        id,
        totalPence,
        `The Coral Farm - Order #${id.slice(0, 8).toUpperCase()}`,
        redirectUrl
      );

      await setPaymentMethod(id, PaymentMethod.CARD, link.paymentLinkId);
      return NextResponse.json({ method: "CARD", paymentUrl: link.url });
    } catch (e) {
      log.error("Square payment link creation failed", e, { route: "/api/orders/[id]/payment", method: "POST", meta: { orderId: id } });
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
    }
  }

  if (method === "FINANCE") {
    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    const paymentUrl = generateIwocaPayUrl(id, totals.total, order.user?.companyName, order.user?.email);
    await setPaymentMethod(id, PaymentMethod.FINANCE, paymentUrl);
    return NextResponse.json({ method: "FINANCE", paymentUrl });
  }

  return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== OrderStatus.ACCEPTED) return NextResponse.json({ error: "Cannot change payment method" }, { status: 400 });

  await clearPaymentMethod(id);
  return NextResponse.json({ ok: true });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== user.userId && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    status: order.status,
  });
}
