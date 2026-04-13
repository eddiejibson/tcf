import { NextRequest, NextResponse } from "next/server";
import { requireAuth, canAccessOrder } from "@/server/middleware/auth";
import { getOrderById, updateOrderItems, submitOrder, calculateOrderTotals, getOrderRemainingBalance } from "@/server/services/order.service";
import { getDb } from "@/server/db/data-source";
import { Order } from "@/server/entities/Order";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!canAccessOrder(user, order)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
  const items = order.items.map((i) => ({
    ...i,
    latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
    categoryName: i.catalogProduct?.category?.name || null,
  }));
  return NextResponse.json({ ...order, items, payments: order.payments || [], totals, remainingBalance: getOrderRemainingBalance(order) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  // PATCH keeps strict ownership — only the creator can modify drafts
  if (order.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();

  if (body.items) {
    await updateOrderItems(id, body.items);
  }

  if (body.includeShipping !== undefined || body.useCredit !== undefined || body.maxBoxes !== undefined || body.minBoxes !== undefined) {
    const db = await getDb();
    const update: Record<string, unknown> = {};
    if (body.includeShipping !== undefined) update.includeShipping = body.includeShipping;
    if (body.useCredit !== undefined) update.useCredit = body.useCredit;
    if (body.maxBoxes !== undefined) update.maxBoxes = body.maxBoxes;
    if (body.minBoxes !== undefined) update.minBoxes = body.minBoxes;
    await db.getRepository(Order).update(id, update);
  }

  if (body.action === "submit") {
    await submitOrder(id);
  }

  const updated = await getOrderById(id);
  if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const totals = calculateOrderTotals(updated.items, updated.includeShipping, updated.freightCharge, updated.creditApplied);
  const updatedItems = updated.items.map((i) => ({
    ...i,
    latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
    categoryName: i.catalogProduct?.category?.name || null,
  }));
  return NextResponse.json({ ...updated, items: updatedItems, payments: updated.payments || [], totals, remainingBalance: getOrderRemainingBalance(updated) });
}
