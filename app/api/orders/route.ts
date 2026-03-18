import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getUserOrders, createOrder, calculateOrderTotals } from "@/server/services/order.service";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await getUserOrders(user.userId);

  return NextResponse.json(
    orders.map((o) => {
      const totals = calculateOrderTotals(o.items, o.includeShipping);
      return {
        id: o.id,
        status: o.status,
        shipmentName: o.shipment?.name,
        itemCount: o.items?.length || 0,
        total: totals.total,
        createdAt: o.createdAt,
      };
    })
  );
}

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shipmentId, items } = await request.json();
  if (!shipmentId || !items?.length) {
    return NextResponse.json({ error: "Shipment ID and items are required" }, { status: 400 });
  }

  const order = await createOrder(user.userId, shipmentId, items);
  return NextResponse.json(order);
}
