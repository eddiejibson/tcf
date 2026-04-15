import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAccessOrder, hasPermission } from "@/server/middleware/auth";
import { getOrderById, addOrderPayment, confirmOrderPayment, markPaymentAwaitingConfirmation, checkOrderFullyPaid, deleteOrderPayment, getOrderRemainingBalance, setPaymentMethod, confirmBankTransferSent } from "@/server/services/order.service";
import { OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { OrderPaymentStatus } from "@/server/entities/OrderPayment";
import { createPaymentLink, isPaymentLinkPaid, BANK_DETAILS } from "@/server/services/payment.service";
import { Permission } from "@/server/lib/permissions";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

function generateIwocaPayUrl(orderId: string, total: number, companyName?: string | null, email?: string) {
  const slug = (companyName || email?.split("@")[0] || "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const ref = `${slug}-order-${orderId.slice(0, 8)}`;
  const amount = total.toFixed(2);
  return `https://iwocapay.me/the-coral-farm-ltd?amount=${amount}&reference=${encodeURIComponent(ref)}&fees_paid_by=buyer`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPermission(user, Permission.MANAGE_PAYMENTS)) return NextResponse.json({ error: "No permission to manage payments" }, { status: 403 });

  const body = await request.json();
  const { method, action, paymentId, amount: rawAmount } = body;

  // Verify a specific card payment
  if (action === "verify_card" && paymentId) {
    const payment = order.payments?.find((p) => p.id === paymentId);
    if (!payment || String(payment.method) !== "CARD" || !payment.reference) {
      return NextResponse.json({ error: "No card payment to verify" }, { status: 400 });
    }
    const paid = await isPaymentLinkPaid(payment.reference);
    if (paid) {
      await confirmOrderPayment(paymentId);
      await checkOrderFullyPaid(id);
      const updated = await getOrderById(id);
      return NextResponse.json({ status: updated?.status || "PAID" });
    }
    return NextResponse.json({ status: order.status });
  }

  // Legacy verify (no paymentId — check order-level ref)
  if (action === "verify_card") {
    if (order.paymentMethod !== PaymentMethod.CARD || !order.paymentReference) {
      return NextResponse.json({ error: "No card payment to verify" }, { status: 400 });
    }
    const paid = await isPaymentLinkPaid(order.paymentReference);
    if (paid) {
      // Find the pending CARD payment and complete it
      const cardPayment = order.payments?.find((p) => String(p.method) === "CARD" && p.status !== OrderPaymentStatus.COMPLETED);
      if (cardPayment) {
        await confirmOrderPayment(cardPayment.id);
        await checkOrderFullyPaid(id);
      }
      const updated = await getOrderById(id);
      return NextResponse.json({ status: updated?.status || "PAID" });
    }
    return NextResponse.json({ status: order.status });
  }

  // User says "I've sent it" — move to AWAITING_CONFIRMATION (admin must confirm)
  if (action === "confirm_bank_sent") {
    if (paymentId) {
      const payment = order.payments?.find((p) => p.id === paymentId);
      if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      await markPaymentAwaitingConfirmation(paymentId);
      await checkOrderFullyPaid(id);
      return NextResponse.json({ status: "AWAITING_PAYMENT" });
    }
    // Legacy fallback
    await confirmBankTransferSent(id);
    return NextResponse.json({ status: "AWAITING_PAYMENT" });
  }

  // Must be ACCEPTED or AWAITING_PAYMENT to add new payments
  if (order.status !== OrderStatus.ACCEPTED && order.status !== OrderStatus.AWAITING_PAYMENT) {
    return NextResponse.json({ error: "Order must be accepted before payment" }, { status: 400 });
  }

  const remaining = getOrderRemainingBalance(order);
  const amount = rawAmount ? Math.min(Number(rawAmount), remaining) : remaining;
  if (amount <= 0) return NextResponse.json({ error: "Nothing left to pay" }, { status: 400 });

  if (method === "BANK_TRANSFER") {
    const payment = await addOrderPayment(id, PaymentMethod.BANK_TRANSFER, amount);
    await setPaymentMethod(id, PaymentMethod.BANK_TRANSFER);
    await checkOrderFullyPaid(id);
    return NextResponse.json({ method: "BANK_TRANSFER", bankDetails: BANK_DETAILS, paymentId: payment.id, amount });
  }

  if (method === "CARD") {
    const totalPence = Math.round(amount * 100);
    const redirectUrl = `${process.env.MAGIC_LINK_BASE_URL}/orders/${id}?payment=success`;

    try {
      const link = await createPaymentLink(
        id,
        totalPence,
        `The Coral Farm - Order #${id.slice(0, 8).toUpperCase()}`,
        redirectUrl
      );
      const payment = await addOrderPayment(id, PaymentMethod.CARD, amount, link.paymentLinkId);
      await setPaymentMethod(id, PaymentMethod.CARD, link.paymentLinkId);
      await checkOrderFullyPaid(id);
      return NextResponse.json({ method: "CARD", paymentUrl: link.url, paymentId: payment.id, amount });
    } catch (e) {
      log.error("Square payment link creation failed", e, { route: "/api/orders/[id]/payment", method: "POST", meta: { orderId: id } });
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
    }
  }

  if (method === "FINANCE") {
    const paymentUrl = generateIwocaPayUrl(id, amount, order.user?.companyName, order.user?.email);
    const payment = await addOrderPayment(id, PaymentMethod.FINANCE, amount, paymentUrl);
    await setPaymentMethod(id, PaymentMethod.FINANCE, paymentUrl);
    await checkOrderFullyPaid(id);
    return NextResponse.json({ method: "FINANCE", paymentUrl, paymentId: payment.id, amount });
  }

  return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPermission(user, Permission.MANAGE_PAYMENTS)) return NextResponse.json({ error: "No permission" }, { status: 403 });

  const url = new URL(request.url);
  const paymentId = url.searchParams.get("paymentId");
  if (paymentId) {
    await deleteOrderPayment(paymentId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "paymentId required" }, { status: 400 });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    payments: order.payments || [],
    remainingBalance: getOrderRemainingBalance(order),
    status: order.status,
  });
}
