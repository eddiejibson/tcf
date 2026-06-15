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
    notes: shipment.notes,
    currency: shipment.currency,
    freightCurrency: shipment.freightCurrency,
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
      category: p.category,
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

  const { name, deadline, shipmentDate, freightCost, margin, status, products, fractionalBagsEnabled, deliveryOptions, notes, currency, freightCurrency } = body;
  if (name !== undefined) shipment.name = name;
  if (deadline !== undefined) shipment.deadline = new Date(deadline);
  if (shipmentDate !== undefined) shipment.shipmentDate = new Date(shipmentDate);
  if (freightCost !== undefined) shipment.freightCost = freightCost;
  if (margin !== undefined) shipment.margin = margin;
  if (fractionalBagsEnabled !== undefined) shipment.fractionalBagsEnabled = fractionalBagsEnabled;
  if (deliveryOptions !== undefined) shipment.deliveryOptions = deliveryOptions;
  if (notes !== undefined) shipment.notes = notes?.trim() ? notes.trim() : null;
  if (currency !== undefined) shipment.currency = currency?.trim() ? currency.trim() : null;
  if (freightCurrency !== undefined) shipment.freightCurrency = freightCurrency?.trim() ? freightCurrency.trim() : null;
  if (status !== undefined) shipment.status = status;

  if (products !== undefined && Array.isArray(products)) {
    type IncomingProduct = {
      id?: string;
      name: string;
      latinName?: string | null;
      variant?: string | null;
      price: number;
      size?: string | null;
      qtyPerBox?: number | null;
      availableQty?: number | null;
    };
    const incoming = products as IncomingProduct[];
    const toUpdate = incoming.filter((p) => p.id);
    const toInsert = incoming.filter((p) => !p.id);
    const keepIds = toUpdate.map((p) => p.id as string);

    // Large shipments carry thousands of products; doing one query per product
    // made this take ~30s. Batch into three set-based statements instead.
    await db.transaction(async (manager) => {
      await manager.save(Shipment, shipment);

      // Soft-delete products not in the incoming list. Order items keep their
      // productId — the soft-deleted row stays around for history.
      await manager.query(
        `UPDATE products SET "deletedAt" = now()
         WHERE "shipmentId" = $1 AND "deletedAt" IS NULL AND id <> ALL($2::uuid[])`,
        [id, keepIds]
      );

      // Bulk-update existing products in a single round-trip via unnest().
      if (toUpdate.length > 0) {
        await manager.query(
          `UPDATE products AS p SET
             name = v.name,
             "latinName" = v.latin_name,
             variant = v.variant,
             price = v.price,
             size = v.size,
             "qtyPerBox" = v.qty_per_box,
             "availableQty" = v.available_qty,
             "updatedAt" = now()
           FROM unnest(
             $2::uuid[], $3::text[], $4::text[], $5::text[],
             $6::numeric[], $7::text[], $8::int[], $9::int[]
           ) AS v(id, name, latin_name, variant, price, size, qty_per_box, available_qty)
           WHERE p.id = v.id AND p."shipmentId" = $1`,
          [
            id,
            toUpdate.map((p) => p.id),
            toUpdate.map((p) => p.name),
            toUpdate.map((p) => p.latinName ?? null),
            toUpdate.map((p) => p.variant ?? null),
            toUpdate.map((p) => p.price),
            toUpdate.map((p) => p.size ?? null),
            toUpdate.map((p) => p.qtyPerBox || null),
            toUpdate.map((p) => p.availableQty ?? null),
          ]
        );
      }

      // Bulk-insert new products — TypeORM emits a multi-row INSERT.
      if (toInsert.length > 0) {
        await manager.insert(
          Product,
          toInsert.map((p) => ({
            shipmentId: id,
            name: p.name,
            latinName: p.latinName ?? null,
            variant: p.variant ?? null,
            price: p.price,
            size: p.size ?? null,
            qtyPerBox: p.qtyPerBox || null,
            availableQty: p.availableQty ?? null,
          }))
        );
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
      ...(notes !== undefined ? { notesUpdated: true } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(products !== undefined ? { productsReplaced: true, productCount: Array.isArray(products) ? products.length : 0 } : {}),
    },
  });

  // Return only the shipment's scalar fields. Callers (notes save, edit save,
  // status change) don't read the product list back, so reloading + serialising
  // thousands of products here was pure waste.
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
    notes: shipment.notes,
    currency: shipment.currency,
    freightCurrency: shipment.freightCurrency,
  });
}
