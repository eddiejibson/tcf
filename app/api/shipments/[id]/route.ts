import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/server/middleware/auth";
import { getShipmentWithProducts } from "@/server/services/order.service";
import { Permission } from "@/server/lib/permissions";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission(Permission.VIEW_SHIPMENTS);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const shipment = await getShipmentWithProducts(id);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  // Only send the product fields the order UI actually uses. The full entity
  // (timestamps, shipmentId, originalRow, …) roughly doubled the payload.
  return NextResponse.json({
    ...shipment,
    products: shipment.products.map((p) => ({
      id: p.id,
      name: p.name,
      latinName: p.latinName,
      price: p.price,
      variant: p.variant,
      size: p.size,
      qtyPerBox: p.qtyPerBox,
      availableQty: p.availableQty,
      surcharge: p.surcharge,
      featured: p.featured,
      packOptions: p.packOptions,
      category: p.category,
    })),
  });
}
