import { NextRequest, NextResponse } from "next/server";
import { getOrderById, addOrderPayment, checkOrderFullyPaid, getOrderRemainingBalance } from "@/server/services/order.service";
import { OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { OrderPaymentStatus } from "@/server/entities/OrderPayment";
import { processCardPayment, SquareApiError, squareErrorMessage } from "@/server/services/payment.service";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== OrderStatus.ACCEPTED && order.status !== OrderStatus.AWAITING_PAYMENT) {
    return NextResponse.json({ error: "Order must be accepted before payment" }, { status: 400 });
  }

  const { sourceId, verificationToken, amount: rawAmount } = await request.json();
  if (!sourceId) return NextResponse.json({ error: "Missing sourceId" }, { status: 400 });

  const remaining = getOrderRemainingBalance(order);
  const amount = rawAmount ? Math.min(Number(rawAmount), remaining) : remaining;
  const totalPence = Math.round(amount * 100);

  try {
    const result = await processCardPayment(sourceId, totalPence, id, verificationToken);

    if (result.status === "COMPLETED") {
      const payment = await addOrderPayment(id, PaymentMethod.CARD, amount, result.paymentId, OrderPaymentStatus.COMPLETED);
      await checkOrderFullyPaid(id);
      return NextResponse.json({ status: "PAID", paymentId: payment.id });
    }

    const payment = await addOrderPayment(id, PaymentMethod.CARD, amount, result.paymentId);
    await checkOrderFullyPaid(id);
    return NextResponse.json({ status: result.status, paymentId: payment.id });
  } catch (e) {
    log.error("Square card payment failed (pay page)", e, { meta: { orderId: id, code: e instanceof SquareApiError ? e.code : null } });
    if (e instanceof SquareApiError) {
      return NextResponse.json({
        error: squareErrorMessage(e),
        code: e.code,
        verificationRequired: e.code === "CARD_DECLINED_VERIFICATION_REQUIRED",
      }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
