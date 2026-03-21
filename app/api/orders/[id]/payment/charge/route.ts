import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAccessOrder, hasPermission } from "@/server/middleware/auth";
import { getOrderById, setPaymentMethod, markOrderPaid, calculateOrderTotals } from "@/server/services/order.service";
import { OrderStatus, PaymentMethod } from "@/server/entities/Order";
import { processCardPayment } from "@/server/services/payment.service";
import { Permission } from "@/server/lib/permissions";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!hasPermission(user, Permission.MANAGE_PAYMENTS)) return NextResponse.json({ error: "No permission to manage payments" }, { status: 403 });
  if (order.status !== OrderStatus.ACCEPTED) {
    return NextResponse.json({ error: "Order must be accepted before payment" }, { status: 400 });
  }

  const { sourceId } = await request.json();
  if (!sourceId) return NextResponse.json({ error: "Missing sourceId" }, { status: 400 });

  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
  const totalPence = Math.round(totals.total * 100);

  try {
    const result = await processCardPayment(sourceId, totalPence, id);

    if (result.status === "COMPLETED") {
      await setPaymentMethod(id, PaymentMethod.CARD, result.paymentId);
      await markOrderPaid(id, result.paymentId);
      return NextResponse.json({ status: "PAID", paymentId: result.paymentId });
    }

    await setPaymentMethod(id, PaymentMethod.CARD, result.paymentId);
    return NextResponse.json({ status: result.status, paymentId: result.paymentId });
  } catch (e) {
    log.error("Square card payment failed", e, { route: "/api/orders/[id]/payment/charge", method: "POST", meta: { orderId: id } });
    const message = e instanceof Error ? e.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
