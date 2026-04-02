import { NextRequest, NextResponse } from "next/server";
import { getOrderById, calculateOrderTotals } from "@/server/services/order.service";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Only expose accepted/awaiting_payment/paid orders publicly
  if (!["ACCEPTED", "AWAITING_PAYMENT", "PAID"].includes(order.status)) {
    return NextResponse.json({ error: "Order not available" }, { status: 404 });
  }

  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);

  return NextResponse.json({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    includeShipping: order.includeShipping,
    shipmentName: order.shipment?.name || "Direct Order",
    customerCompanyName: order.user?.companyName || null,
    items: order.items.map((i) => ({
      id: i.id,
      name: i.name,
      latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
      categoryName: i.catalogProduct?.category?.name || null,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      surcharge: Number(i.surcharge) || 0,
    })),
    totals,
  });
}
