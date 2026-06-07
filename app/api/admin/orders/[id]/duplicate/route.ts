import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { duplicateOrder, calculateOrderTotals } from "@/server/services/order.service";
import { isUuid } from "@/server/utils";
import { log } from "@/server/logger";

// Duplicates an order into a fresh DRAFT with no customer assigned. The admin can then
// reassign a customer and re-accept the copy. Works for shipment orders too (the copy keeps
// the shipmentId so it stays editable as a shipment draft on the detail page).
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const order = await duplicateOrder(id);
    if (!order) return NextResponse.json({ error: "Failed to duplicate order" }, { status: 500 });

    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied, order.discountPercent);
    return NextResponse.json(
      { id: order.id, status: order.status, shipmentId: order.shipmentId, total: totals.total },
      { status: 201 },
    );
  } catch (e) {
    log.error("Admin order duplicate failed", e, { route: "/api/admin/orders/[id]/duplicate", method: "POST", meta: { orderId: id } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 400 });
  }
}
