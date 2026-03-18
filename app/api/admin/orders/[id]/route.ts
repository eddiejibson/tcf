import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getOrderById, updateOrderStatus, updateOrderItems, calculateOrderTotals } from "@/server/services/order.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const totals = calculateOrderTotals(order.items, order.includeShipping);
  return NextResponse.json({ ...order, totals });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (body.items) {
    await updateOrderItems(id, body.items);
  }

  if (body.status || body.includeShipping !== undefined) {
    await updateOrderStatus(id, body.status, body.includeShipping);
  }

  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const totals = calculateOrderTotals(order.items, order.includeShipping);
  return NextResponse.json({ ...order, totals });
}
