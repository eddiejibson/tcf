import { NextRequest, NextResponse } from "next/server";
import { getOrderById, addOrderPayment, confirmOrderPayment, markPaymentAwaitingConfirmation, checkOrderFullyPaid, getOrderRemainingBalance, setPaymentMethod, confirmBankTransferSent } from "@/server/services/order.service";
import { OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { OrderPaymentStatus } from "@/server/entities/OrderPayment";
import { createPaymentLink, isPaymentLinkPaid, BANK_DETAILS } from "@/server/services/payment.service";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

function generateIwocaPayUrl(orderId: string, total: number, companyName?: string | null) {
  const slug = (companyName || "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const ref = `${slug}-order-${orderId.slice(0, 8)}`;
  const amount = total.toFixed(2);
  return `https://iwocapay.me/the-coral-farm-ltd?amount=${amount}&reference=${encodeURIComponent(ref)}`;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const body = await request.json();
  const { method, action, paymentId, amount: rawAmount } = body;

  if (action === "verify_card") {
    if (paymentId) {
      const payment = order.payments?.find((p) => p.id === paymentId);
      if (!payment || !payment.reference) return NextResponse.json({ error: "No card payment to verify" }, { status: 400 });
      const paid = await isPaymentLinkPaid(payment.reference);
      if (paid) {
        await confirmOrderPayment(paymentId);
        await checkOrderFullyPaid(id);
      }
      const updated = await getOrderById(id);
      return NextResponse.json({ status: updated?.status || order.status });
    }
    // Legacy
    if (order.paymentMethod === PaymentMethod.CARD && order.paymentReference) {
      const paid = await isPaymentLinkPaid(order.paymentReference);
      if (paid) {
        const cardPayment = order.payments?.find((p) => p.method === PaymentMethod.CARD && p.status !== OrderPaymentStatus.COMPLETED);
        if (cardPayment) { await confirmOrderPayment(cardPayment.id); await checkOrderFullyPaid(id); }
      }
    }
    const updated = await getOrderById(id);
    return NextResponse.json({ status: updated?.status || order.status });
  }

  if (action === "confirm_bank_sent") {
    if (paymentId) {
      await markPaymentAwaitingConfirmation(paymentId);
      await checkOrderFullyPaid(id);
    } else {
      await confirmBankTransferSent(id);
    }
    return NextResponse.json({ status: "AWAITING_PAYMENT" });
  }

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
    const redirectUrl = `${process.env.MAGIC_LINK_BASE_URL}/pay/${id}?payment=success`;
    try {
      const link = await createPaymentLink(id, totalPence, `The Coral Farm - Order #${id.slice(0, 8).toUpperCase()}`, redirectUrl);
      const payment = await addOrderPayment(id, PaymentMethod.CARD, amount, link.paymentLinkId);
      await setPaymentMethod(id, PaymentMethod.CARD, link.paymentLinkId);
      await checkOrderFullyPaid(id);
      return NextResponse.json({ method: "CARD", paymentUrl: link.url, paymentId: payment.id, amount });
    } catch (e) {
      log.error("Square payment link creation failed (pay page)", e, { meta: { orderId: id } });
      return NextResponse.json({ error: "Failed to create payment link" }, { status: 500 });
    }
  }

  if (method === "FINANCE") {
    const paymentUrl = generateIwocaPayUrl(id, amount, order.user?.companyName);
    const payment = await addOrderPayment(id, PaymentMethod.FINANCE, amount, paymentUrl);
    await setPaymentMethod(id, PaymentMethod.FINANCE, paymentUrl);
    await checkOrderFullyPaid(id);
    return NextResponse.json({ method: "FINANCE", paymentUrl, paymentId: payment.id, amount });
  }

  return NextResponse.json({ error: "Invalid payment method" }, { status: 400 });
}
