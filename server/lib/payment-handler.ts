import { OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { OrderPaymentStatus } from "@/server/entities/OrderPayment";
import { addOrderPayment, confirmOrderPayment, markPaymentAwaitingConfirmation, checkOrderFullyPaid, getOrderById, getOrderRemainingBalance, setPaymentMethod, confirmBankTransferSent } from "@/server/services/order.service";
import { createPaymentLink, isPaymentLinkPaid, BANK_DETAILS } from "@/server/services/payment.service";
import { log } from "@/server/logger";

export function generateIwocaPayUrl(orderId: string, total: number, companyName?: string | null, email?: string) {
  const slug = (companyName || email?.split("@")[0] || "customer")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const ref = `${slug}-order-${orderId.slice(0, 8)}`;
  const amount = total.toFixed(2);
  return `https://iwocapay.me/the-coral-farm-ltd?amount=${amount}&reference=${encodeURIComponent(ref)}`;
}

interface PaymentOrder {
  id: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  items: { unitPrice: number; quantity: number; surcharge?: number }[];
  includeShipping: boolean;
  freightCharge?: number | null;
  creditApplied?: number;
  payments?: { id: string; method: string; amount: number; reference: string | null; status: string }[];
  user?: { companyName?: string | null; email?: string } | null;
}

interface PaymentConfig {
  redirectBasePath: string; // e.g. "/orders/${id}" or "/pay/${id}"
}

type PaymentResult = { status: number; data: Record<string, unknown> };

export async function handlePaymentAction(
  order: PaymentOrder,
  body: { method?: string; action?: string; paymentId?: string; amount?: number },
  config: PaymentConfig,
): Promise<PaymentResult> {
  const { method, action, paymentId, amount: rawAmount } = body;
  const id = order.id;

  // Verify a specific card payment
  if (action === "verify_card" && paymentId) {
    const payment = order.payments?.find((p) => p.id === paymentId);
    if (!payment || String(payment.method) !== "CARD" || !payment.reference) {
      return { status: 400, data: { error: "No card payment to verify" } };
    }
    const paid = await isPaymentLinkPaid(payment.reference);
    if (paid) {
      await confirmOrderPayment(paymentId);
      await checkOrderFullyPaid(id);
    }
    const updated = await getOrderById(id);
    return { status: 200, data: { status: updated?.status || order.status } };
  }

  // Legacy verify (no paymentId — check order-level ref)
  if (action === "verify_card") {
    if (order.paymentMethod === PaymentMethod.CARD && order.paymentReference) {
      const paid = await isPaymentLinkPaid(order.paymentReference);
      if (paid) {
        const cardPayment = order.payments?.find((p) => String(p.method) === "CARD" && p.status !== OrderPaymentStatus.COMPLETED);
        if (cardPayment) {
          await confirmOrderPayment(cardPayment.id);
          await checkOrderFullyPaid(id);
        }
      }
    }
    const updated = await getOrderById(id);
    return { status: 200, data: { status: updated?.status || order.status } };
  }

  // User says "I've sent it" — move to AWAITING_CONFIRMATION
  if (action === "confirm_bank_sent") {
    if (paymentId) {
      await markPaymentAwaitingConfirmation(paymentId);
      await checkOrderFullyPaid(id);
    } else {
      await confirmBankTransferSent(id);
    }
    return { status: 200, data: { status: "AWAITING_PAYMENT" } };
  }

  // Must be ACCEPTED or AWAITING_PAYMENT to add new payments
  if (order.status !== OrderStatus.ACCEPTED && order.status !== OrderStatus.AWAITING_PAYMENT) {
    return { status: 400, data: { error: "Order must be accepted before payment" } };
  }

  const remaining = getOrderRemainingBalance(order);
  const amount = rawAmount ? Math.min(Number(rawAmount), remaining) : remaining;
  if (amount <= 0) return { status: 400, data: { error: "Nothing left to pay" } };

  if (method === "BANK_TRANSFER") {
    const payment = await addOrderPayment(id, PaymentMethod.BANK_TRANSFER, amount);
    await setPaymentMethod(id, PaymentMethod.BANK_TRANSFER);
    await checkOrderFullyPaid(id);
    return { status: 200, data: { method: "BANK_TRANSFER", bankDetails: BANK_DETAILS, paymentId: payment.id, amount } };
  }

  if (method === "CARD") {
    const totalPence = Math.round(amount * 100);
    const redirectUrl = `${process.env.MAGIC_LINK_BASE_URL}${config.redirectBasePath}?payment=success`;
    try {
      const link = await createPaymentLink(
        id,
        totalPence,
        `The Coral Farm - Order #${id.slice(0, 8).toUpperCase()}`,
        redirectUrl,
      );
      const payment = await addOrderPayment(id, PaymentMethod.CARD, amount, link.paymentLinkId);
      await setPaymentMethod(id, PaymentMethod.CARD, link.paymentLinkId);
      await checkOrderFullyPaid(id);
      return { status: 200, data: { method: "CARD", paymentUrl: link.url, paymentId: payment.id, amount } };
    } catch (e) {
      log.error("Square payment link creation failed", e, { meta: { orderId: id } });
      return { status: 500, data: { error: "Failed to create payment link" } };
    }
  }

  if (method === "FINANCE") {
    const paymentUrl = generateIwocaPayUrl(id, amount, order.user?.companyName, order.user?.email);
    const payment = await addOrderPayment(id, PaymentMethod.FINANCE, amount, paymentUrl);
    await setPaymentMethod(id, PaymentMethod.FINANCE, paymentUrl);
    await checkOrderFullyPaid(id);
    return { status: 200, data: { method: "FINANCE", paymentUrl, paymentId: payment.id, amount } };
  }

  return { status: 400, data: { error: "Invalid payment method" } };
}
