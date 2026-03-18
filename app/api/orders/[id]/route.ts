import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getOrderById, updateOrderItems, submitOrder, calculateOrderTotals } from "@/server/services/order.service";
import { getDb } from "@/server/db/data-source";
import { Order } from "@/server/entities/Order";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== user.userId && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
  return NextResponse.json({ ...order, totals });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.userId !== user.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();

  if (body.items) {
    await updateOrderItems(id, body.items);
  }

  if (body.includeShipping !== undefined || body.useCredit !== undefined) {
    const db = await getDb();
    const update: Record<string, unknown> = {};
    if (body.includeShipping !== undefined) update.includeShipping = body.includeShipping;
    if (body.useCredit !== undefined) update.useCredit = body.useCredit;
    await db.getRepository(Order).update(id, update);
  }

  if (body.action === "submit") {
    await submitOrder(id);
  }

  const updated = await getOrderById(id);
  if (!updated) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const totals = calculateOrderTotals(updated.items, updated.includeShipping, updated.freightCharge, updated.creditApplied);
  return NextResponse.json({ ...updated, totals });
}
