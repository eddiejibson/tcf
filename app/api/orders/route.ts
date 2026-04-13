import { NextRequest, NextResponse } from "next/server";
import { requireAuth, hasPermission } from "@/server/middleware/auth";
import { getUserOrders, getCompanyOrders, createOrder, createCatalogOrder, calculateOrderTotals } from "@/server/services/order.service";
import { Permission } from "@/server/lib/permissions";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // If user has VIEW_ORDERS + belongs to a company, show all company orders
  const orders = user.companyId && hasPermission(user, Permission.VIEW_ORDERS)
    ? await getCompanyOrders(user.companyId)
    : await getUserOrders(user.userId);

  return NextResponse.json(
    orders.map((o) => {
      const totals = calculateOrderTotals(o.items, o.includeShipping, o.freightCharge, o.creditApplied);
      return {
        id: o.id,
        status: o.status,
        shipmentName: o.shipment?.name || null,
        itemCount: o.items?.length || 0,
        total: totals.total,
        createdAt: o.createdAt,
        userEmail: o.user?.email || null,
      };
    })
  );
}

export async function POST(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shipmentId, items } = await request.json();
  if (!items?.length) {
    return NextResponse.json({ error: "Items are required" }, { status: 400 });
  }

  if (!shipmentId) {
    // Catalog order — require CREATE_CATALOG_ORDER
    if (!hasPermission(user, Permission.CREATE_CATALOG_ORDER)) {
      return NextResponse.json({ error: "You don't have permission to create catalog orders" }, { status: 403 });
    }
    const order = await createCatalogOrder(user.userId, items.map((i: { catalogProductId: string; quantity: number }) => ({
      catalogProductId: i.catalogProductId,
      quantity: i.quantity,
    })));
    return NextResponse.json(order);
  }

  // Shipment order — require CREATE_ORDER
  if (!hasPermission(user, Permission.CREATE_ORDER)) {
    return NextResponse.json({ error: "You don't have permission to create orders" }, { status: 403 });
  }

  try {
    const order = await createOrder(user.userId, shipmentId, items.map((i: { productId: string; name: string; quantity: number; unitPrice: number; substituteProductId?: string; substituteName?: string }) => ({
      productId: i.productId,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      substituteProductId: i.substituteProductId || null,
      substituteName: i.substituteName || null,
    })));
    return NextResponse.json(order);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to create order" }, { status: 400 });
  }
}
