import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Shipment, ShipmentStatus } from "@/server/entities/Shipment";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const shipments = await db.getRepository(Shipment).find({
    relations: ["products", "orders"],
    order: { createdAt: "DESC" },
  });

  return NextResponse.json(
    shipments.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      deadline: s.deadline,
      shipmentDate: s.shipmentDate,
      freightCost: s.freightCost,
      productCount: s.products?.length || 0,
      orderCount: s.orders?.length || 0,
      createdAt: s.createdAt,
    }))
  );
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, deadline, shipmentDate, freightCost, status, products, sourceFilename } = body;

  if (!name || !deadline || !shipmentDate) {
    return NextResponse.json({ error: "Name, deadline, and shipment date are required" }, { status: 400 });
  }

  const db = await getDb();
  const repo = db.getRepository(Shipment);

  const shipment = repo.create({
    name,
    deadline: new Date(deadline),
    shipmentDate: new Date(shipmentDate),
    freightCost: freightCost || 0,
    status: status || ShipmentStatus.DRAFT,
    sourceFilename,
    createdById: admin.userId,
    products: products?.map((p: { name: string; price: number; qtyPerBox: number; originalRow?: Record<string, unknown> }) => ({
      name: p.name,
      price: p.price,
      qtyPerBox: p.qtyPerBox || 1,
      originalRow: p.originalRow,
    })),
  });

  const saved = await repo.save(shipment);
  return NextResponse.json(saved);
}
