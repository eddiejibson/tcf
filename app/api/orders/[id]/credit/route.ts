import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getOrderById, calculateOrderTotals, markOrderPaid } from "@/server/services/order.service";
import { applyCredit, removeAppliedCredit, getCreditBalance } from "@/server/services/credit.service";
import { OrderStatus } from "@/server/entities/Order";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (order.status !== OrderStatus.ACCEPTED) {
    return NextResponse.json({ error: "Credit can only be applied to accepted orders" }, { status: 400 });
  }

  const { action } = await request.json();

  if (action === "remove") {
    await removeAppliedCredit(id, user.userId);
    const updated = await getOrderById(id);
    if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const totals = calculateOrderTotals(updated.items, updated.includeShipping, updated.freightCharge, updated.creditApplied);
    const balance = await getCreditBalance(user.userId);
    return NextResponse.json({ ...updated, totals, creditBalance: balance });
  }

  // Apply credit
  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge);
  const balance = await getCreditBalance(user.userId);
  const toApply = Math.min(balance, totals.total);

  if (toApply <= 0) {
    return NextResponse.json({ error: "No credit available to apply" }, { status: 400 });
  }

  const result = await applyCredit(id, user.userId, toApply);

  // Check if credit covers the full amount
  const updatedOrder = await getOrderById(id);
  if (!updatedOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const newTotals = calculateOrderTotals(updatedOrder.items, updatedOrder.includeShipping, updatedOrder.freightCharge, updatedOrder.creditApplied);

  if (newTotals.total <= 0) {
    await markOrderPaid(id, "CREDIT");
    const paidOrder = await getOrderById(id);
    if (!paidOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const paidTotals = calculateOrderTotals(paidOrder.items, paidOrder.includeShipping, paidOrder.freightCharge, paidOrder.creditApplied);
    return NextResponse.json({ ...paidOrder, totals: paidTotals, creditBalance: result.newBalance });
  }

  return NextResponse.json({ ...updatedOrder, totals: newTotals, creditBalance: result.newBalance });
}
