import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getAllOrders, calculateOrderTotals, createAdminOrder, createAdminDraftOrder } from "@/server/services/order.service";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const orders = await getAllOrders();

  return NextResponse.json(
    orders.map((o) => {
      const totals = calculateOrderTotals(o.items, o.includeShipping, o.freightCharge, o.creditApplied);
      return {
        id: o.id,
        status: o.status,
        userEmail: o.user?.email,
        userCompanyName: o.user?.companyName || null,
        shipmentName: o.shipment?.name || null,
        itemCount: o.items?.length || 0,
        total: totals.total,
        includeShipping: o.includeShipping,
        createdAt: o.createdAt,
      };
    })
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { userId, items, notes, asDraft, includeShipping } = body;

  if (!asDraft && !userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items are required" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.catalogProductId || !item.quantity || item.quantity < 1) {
      return NextResponse.json({ error: "Each item must have catalogProductId and quantity >= 1" }, { status: 400 });
    }
  }

  const mappedItems = items.map((i: { catalogProductId: string; quantity: number; surcharge?: number }) => ({
    catalogProductId: i.catalogProductId,
    quantity: i.quantity,
    surcharge: i.surcharge,
  }));

  try {
    const order = asDraft
      ? await createAdminDraftOrder(admin.userId, userId || null, mappedItems, notes, includeShipping)
      : await createAdminOrder(admin.userId, userId, mappedItems, notes, includeShipping);
    if (!order) return NextResponse.json({ error: "Failed to create order" }, { status: 500 });

    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    return NextResponse.json({
      id: order.id,
      status: order.status,
      total: totals.total,
    }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 400 });
  }
}
