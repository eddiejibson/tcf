import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Shipment, ShipmentStatus } from "@/server/entities/Shipment";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 10;
  const skip = (page - 1) * limit;

  const db = await getDb();
  const repo = db.getRepository(Shipment);

  const [shipments, total] = await repo
    .createQueryBuilder("s")
    .loadRelationCountAndMap("s.productCount", "s.products")
    .loadRelationCountAndMap("s.orderCount", "s.orders")
    .orderBy("s.createdAt", "DESC")
    .skip(skip)
    .take(limit)
    .getManyAndCount();

  return NextResponse.json({
    shipments: shipments.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      deadline: s.deadline,
      shipmentDate: s.shipmentDate,
      freightCost: s.freightCost,
      margin: s.margin,
      productCount: (s as unknown as { productCount: number }).productCount,
      orderCount: (s as unknown as { orderCount: number }).orderCount,
      createdAt: s.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, deadline, shipmentDate, freightCost, margin, status, products, sourceFilename } = body;

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
    margin: margin || 0,
    status: status || ShipmentStatus.DRAFT,
    sourceFilename,
    createdById: admin.userId,
    products: products?.map((p: { name: string; latinName?: string | null; price: number; size?: string | null; qtyPerBox: number; availableQty?: number | null }) => ({
      name: p.name,
      latinName: p.latinName || null,
      price: p.price,
      size: p.size || null,
      qtyPerBox: p.qtyPerBox || 1,
      availableQty: p.availableQty ?? null,
    })),
  });

  const saved = await repo.save(shipment);
  return NextResponse.json({ id: saved.id, name: saved.name, status: saved.status });
}
