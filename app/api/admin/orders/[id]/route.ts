import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getOrderById, updateOrderStatus, updateOrderItems, updateAcceptedOrderItems, calculateOrderTotals, markOrderPaid } from "@/server/services/order.service";
import { Order, OrderStatus } from "@/server/entities/Order";
import { getDb } from "@/server/db/data-source";
import { log } from "@/server/logger";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
  return NextResponse.json({ ...order, totals });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  try {
    const body = await request.json();

    const currentOrder = await getOrderById(id);
    if (!currentOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Save freight/adminNotes FIRST so the invoice gets the correct values
    if (body.freightCharge !== undefined || body.adminNotes !== undefined) {
      const db = await getDb();
      const update: Record<string, unknown> = {};
      if (body.freightCharge !== undefined) update.freightCharge = body.freightCharge;
      if (body.adminNotes !== undefined) update.adminNotes = body.adminNotes;
      await db.getRepository(Order).update(id, update);
    }

    if (body.items && (currentOrder.status === OrderStatus.ACCEPTED || currentOrder.status === OrderStatus.AWAITING_FULFILLMENT)) {
      await updateAcceptedOrderItems(id, body.items, body.includeShipping);
      if (body.status && body.status !== currentOrder.status) {
        await updateOrderStatus(id, body.status, body.includeShipping);
      }
    } else {
      if (body.items) {
        await updateOrderItems(id, body.items);
      }

      if (body.status || body.includeShipping !== undefined) {
        await updateOrderStatus(id, body.status, body.includeShipping);
      }
    }

    if (body.markPaid) {
      await markOrderPaid(id, body.paymentReference);
    }

    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    return NextResponse.json({ ...order, totals });
  } catch (e) {
    log.error("Admin order PATCH failed", e, { route: "/api/admin/orders/[id]", method: "PATCH", meta: { orderId: id } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
