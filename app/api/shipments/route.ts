import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getActiveShipments } from "@/server/services/order.service";

export async function GET() {
  const user = await requireAuth();
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
