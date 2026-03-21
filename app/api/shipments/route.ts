import { NextResponse } from "next/server";
import { requirePermission } from "@/server/middleware/auth";
import { getActiveShipments } from "@/server/services/order.service";
import { Permission } from "@/server/lib/permissions";

export async function GET() {
  const user = await requirePermission(Permission.VIEW_SHIPMENTS);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const shipments = await getActiveShipments();

  return NextResponse.json(
    shipments.map((s) => ({
      id: s.id,
      name: s.name,
      deadline: s.deadline,
      shipmentDate: s.shipmentDate,
      freightCost: s.freightCost,
      productCount: s.products?.length || 0,
    }))
  );
}
