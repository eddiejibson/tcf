import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Shipment } from "@/server/entities/Shipment";
import { calculateOrderTotals } from "@/server/services/order.service";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const db = await getDb();
  const shipment = await db.getRepository(Shipment).findOne({
    where: { id },
    relations: ["products", "orders", "orders.items", "orders.user"],
  });

  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  return NextResponse.json({
    id: shipment.id,
    name: shipment.name,
    status: shipment.status,
    deadline: shipment.deadline,
    shipmentDate: shipment.shipmentDate,
    freightCost: shipment.freightCost,
    margin: shipment.margin,
    sourceFilename: shipment.sourceFilename,
    createdAt: shipment.createdAt,
    products: shipment.products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      size: p.size,
      qtyPerBox: p.qtyPerBox,
      availableQty: p.availableQty,
    })),
    orders: shipment.orders.map((o) => {
      const totals = calculateOrderTotals(o.items, o.includeShipping, o.freightCharge, o.creditApplied);
      return {
        id: o.id,
        status: o.status,
        userEmail: o.user.email,
        userCompanyName: o.user.companyName || null,
        itemCount: o.items.length,
        total: totals.total,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      };
    }),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const db = await getDb();
  const repo = db.getRepository(Shipment);

  const shipment = await repo.findOneBy({ id });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const { name, deadline, shipmentDate, freightCost, margin, status } = body;
  if (name !== undefined) shipment.name = name;
  if (deadline !== undefined) shipment.deadline = new Date(deadline);
  if (shipmentDate !== undefined) shipment.shipmentDate = new Date(shipmentDate);
  if (freightCost !== undefined) shipment.freightCost = freightCost;
  if (margin !== undefined) shipment.margin = margin;
  if (status !== undefined) shipment.status = status;

  await repo.save(shipment);
  return NextResponse.json(shipment);
}
