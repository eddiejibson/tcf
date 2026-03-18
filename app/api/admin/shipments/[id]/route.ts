import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Shipment } from "@/server/entities/Shipment";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const db = await getDb();
  const repo = db.getRepository(Shipment);

  const shipment = await repo.findOneBy({ id });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const { name, deadline, shipmentDate, freightCost, status } = body;
  if (name !== undefined) shipment.name = name;
  if (deadline !== undefined) shipment.deadline = new Date(deadline);
  if (shipmentDate !== undefined) shipment.shipmentDate = new Date(shipmentDate);
  if (freightCost !== undefined) shipment.freightCost = freightCost;
  if (status !== undefined) shipment.status = status;

  await repo.save(shipment);
  return NextResponse.json(shipment);
}
