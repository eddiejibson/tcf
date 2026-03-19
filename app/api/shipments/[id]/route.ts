import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getShipmentWithProducts } from "@/server/services/order.service";
import { isUuid } from "@/server/utils";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const shipment = await getShipmentWithProducts(id);
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  return NextResponse.json(shipment);
}
