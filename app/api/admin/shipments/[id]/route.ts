import { NextRequest, NextResponse } from "next/server";
import { In } from "typeorm";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Shipment } from "@/server/entities/Shipment";
import { Product } from "@/server/entities/Product";
import { Order } from "@/server/entities/Order";
import { OrderPayment } from "@/server/entities/OrderPayment";
import { DoaClaim } from "@/server/entities/DoaClaim";
import { DoaReport } from "@/server/entities/DoaReport";
import { calculateOrderTotals } from "@/server/services/order.service";
import { audit } from "@/server/services/audit.service";
import { isUuid } from "@/server/utils";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await getDb();

  const shipment = await db.getRepository(Shipment).findOneBy({ id });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  // Soft delete the shipment and everything that hangs off it. Order items and
  // credit transactions are preserved — they're only reachable through their
  // soft-deleted parents.
  let orderCount = 0;
  await db.transaction(async (manager) => {
    const orders = await manager.getRepository(Order).find({ where: { shipmentId: id }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    orderCount = orderIds.length;
    if (orderIds.length > 0) {
      await manager.getRepository(DoaClaim).softDelete({ orderId: In(orderIds) });
      await manager.getRepository(OrderPayment).softDelete({ orderId: In(orderIds) });
      await manager.getRepository(Order).softDelete({ shipmentId: id });
    }
    await manager.getRepository(Product).softDelete({ shipmentId: id });
    await manager.getRepository(DoaReport).softDelete({ shipmentId: id });
    await manager.getRepository(Shipment).softDelete(id);
  });
  await audit(admin, "shipment.delete", "shipment", id, {
    name: shipment.name,
    status: shipment.status,
    orderCount,
  });

  return NextResponse.json({ success: true });
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    fractionalBagsEnabled: shipment.fractionalBagsEnabled,
    deliveryOptions: shipment.deliveryOptions,
    sourceFilename: shipment.sourceFilename,
    createdAt: shipment.createdAt,
    products: shipment.products.map((p) => ({
      id: p.id,
      name: p.name,
      latinName: p.latinName,
      variant: p.variant,
      price: p.price,
      size: p.size,
      qtyPerBox: p.qtyPerBox,
      availableQty: p.availableQty,
      featured: p.featured || false,
      originalRow: p.originalRow || null,
    })),
    orders: shipment.orders.map((o) => {
      const totals = calculateOrderTotals(o.items, o.includeShipping, o.freightCharge, o.creditApplied, o.discountPercent, o.deliveryCharge);
      return {
        id: o.id,
        status: o.status,
        userEmail: o.user?.email || null,
        userCompanyName: o.user?.companyName || null,
        itemCount: o.items.length,
        total: totals.total,
        createdAt: o.createdAt,
        maxBoxes: o.maxBoxes ?? null,
        minBoxes: o.minBoxes ?? null,
        freightCharge: o.freightCharge != null ? Number(o.freightCharge) : null,
        includeShipping: o.includeShipping,
        items: o.items.map((i) => ({
          id: i.id,
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          packFraction: i.packFraction ?? null,
          bagCount: i.bagCount ?? null,
        })),
      };
    }),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();

  const db = await getDb();
  const repo = db.getRepository(Shipment);

  const shipment = await repo.findOneBy({ id });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const { name, deadline, shipmentDate, freightCost, margin, status, products, fractionalBagsEnabled, deliveryOptions } = body;
  if (name !== undefined) shipment.name = name;
  if (deadline !== undefined) shipment.deadline = new Date(deadline);
  if (shipmentDate !== undefined) shipment.shipmentDate = new Date(shipmentDate);
  if (freightCost !== undefined) shipment.freightCost = freightCost;
  if (margin !== undefined) shipment.margin = margin;
  if (fractionalBagsEnabled !== undefined) shipment.fractionalBagsEnabled = fractionalBagsEnabled;
  if (deliveryOptions !== undefined) shipment.deliveryOptions = deliveryOptions;
  if (status !== undefined) shipment.status = status;

  if (products !== undefined && Array.isArray(products)) {
    await db.transaction(async (manager) => {
      await manager.save(Shipment, shipment);

      const existingProducts = await manager.find(Product, { where: { shipmentId: id } });
      const incomingIds = new Set(
        products.filter((p: { id?: string }) => p.id).map((p: { id: string }) => p.id)
      );

      // Soft-delete products not in incoming list. Order items keep their
      // productId — the soft-deleted product stays around for history.
      const toDelete = existingProducts.filter((p) => !incomingIds.has(p.id));
      for (const p of toDelete) {
        await manager.getRepository(Product).softDelete(p.id);
      }

      // Update existing and create new
      for (const p of products) {
        if (p.id) {
          await manager.update(Product, p.id, {
            name: p.name,
            latinName: p.latinName ?? null,
            variant: p.variant ?? null,
            price: p.price,
            size: p.size ?? null,
            qtyPerBox: p.qtyPerBox || null,
            availableQty: p.availableQty ?? null,
          });
        } else {
          const newProduct = manager.create(Product, {
            shipmentId: id,
            name: p.name,
            latinName: p.latinName ?? null,
            variant: p.variant ?? null,
            price: p.price,
            size: p.size ?? null,
            qtyPerBox: p.qtyPerBox || null,
            availableQty: p.availableQty ?? null,
          });
          await manager.save(Product, newProduct);
        }
      }
    });
  } else {
    await repo.save(shipment);
  }

  await audit(admin, "shipment.update", "shipment", id, {
    name: shipment.name,
    changes: {
      ...(name !== undefined ? { name } : {}),
      ...(deadline !== undefined ? { deadline } : {}),
      ...(shipmentDate !== undefined ? { shipmentDate } : {}),
      ...(freightCost !== undefined ? { freightCost } : {}),
      ...(margin !== undefined ? { margin } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(products !== undefined ? { productsReplaced: true, productCount: Array.isArray(products) ? products.length : 0 } : {}),
    },
  });

  const updated = await repo.findOne({ where: { id }, relations: ["products"] });
  return NextResponse.json({
    ...updated,
    products: updated?.products.map((p) => ({
      id: p.id,
      name: p.name,
      latinName: p.latinName,
      variant: p.variant,
      price: p.price,
      size: p.size,
      qtyPerBox: p.qtyPerBox,
      availableQty: p.availableQty,
      featured: p.featured || false,
      originalRow: p.originalRow || null,
    })),
  });
}
