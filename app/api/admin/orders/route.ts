import { NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getAllOrders, calculateOrderTotals } from "@/server/services/order.service";

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
        shipmentName: o.shipment?.name,
        itemCount: o.items?.length || 0,
        total: totals.total,
        includeShipping: o.includeShipping,
        createdAt: o.createdAt,
      };
    })
  );
}
