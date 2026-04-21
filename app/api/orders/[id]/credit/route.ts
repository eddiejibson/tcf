import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAccessOrder, hasPermission } from "@/server/middleware/auth";
import { getOrderById, calculateOrderTotals, markOrderPaid } from "@/server/services/order.service";
import { applyCredit, removeAppliedCredit, getCreditBalance, getCompanyIdForUser } from "@/server/services/credit.service";
import { OrderStatus } from "@/server/entities/Order";
import { Permission } from "@/server/lib/permissions";
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
    return NextResponse.json({ error: "Credit can only be applied to accepted orders" }, { status: 400 });
  }

  const companyId = await getCompanyIdForUser(order.userId!);
  if (!companyId) return NextResponse.json({ error: "No company linked — credit unavailable" }, { status: 400 });

  const { action } = await request.json();

  if (action === "remove") {
    await removeAppliedCredit(id, companyId);
    const updated = await getOrderById(id);
    if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const totals = calculateOrderTotals(updated.items, updated.includeShipping, updated.freightCharge, updated.creditApplied, updated.discountPercent);
    const balance = await getCreditBalance(companyId);
    return NextResponse.json({ ...updated, totals, creditBalance: balance });
  }

  // Apply credit
  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, 0, order.discountPercent);
  const balance = await getCreditBalance(companyId);
  const toApply = Math.min(balance, totals.total);

  if (toApply <= 0) {
    return NextResponse.json({ error: "No credit available to apply" }, { status: 400 });
  }

  const result = await applyCredit(id, companyId, toApply);

  const updatedOrder = await getOrderById(id);
  if (!updatedOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const newTotals = calculateOrderTotals(updatedOrder.items, updatedOrder.includeShipping, updatedOrder.freightCharge, updatedOrder.creditApplied, updatedOrder.discountPercent);

  if (newTotals.total <= 0) {
    await markOrderPaid(id, "CREDIT");
    const paidOrder = await getOrderById(id);
    if (!paidOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const paidTotals = calculateOrderTotals(paidOrder.items, paidOrder.includeShipping, paidOrder.freightCharge, paidOrder.creditApplied, paidOrder.discountPercent);
    return NextResponse.json({ ...paidOrder, totals: paidTotals, creditBalance: result.newBalance });
  }

  return NextResponse.json({ ...updatedOrder, totals: newTotals, creditBalance: result.newBalance });
}
