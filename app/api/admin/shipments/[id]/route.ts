import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Shipment } from "@/server/entities/Shipment";
import { Product } from "@/server/entities/Product";
import { calculateOrderTotals } from "@/server/services/order.service";
import { isUuid } from "@/server/utils";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const db = await getDb();

  const shipment = await db.getRepository(Shipment).findOneBy({ id });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  await db.transaction(async (manager) => {
    await manager.query(
      `DELETE FROM credit_transactions WHERE "doaClaimId" IN (SELECT id FROM doa_claims WHERE "orderId" IN (SELECT id FROM orders WHERE "shipmentId" = $1))`,
      [id]
    );
    await manager.query(
      `DELETE FROM doa_items WHERE "claimId" IN (SELECT id FROM doa_claims WHERE "orderId" IN (SELECT id FROM orders WHERE "shipmentId" = $1))`,
      [id]
    );
    await manager.query(
      `DELETE FROM doa_claims WHERE "orderId" IN (SELECT id FROM orders WHERE "shipmentId" = $1)`,
      [id]
    );
    await manager.query(
      `DELETE FROM credit_transactions WHERE "orderId" IN (SELECT id FROM orders WHERE "shipmentId" = $1)`,
      [id]
    );
    await manager.query(
      `DELETE FROM order_items WHERE "orderId" IN (SELECT id FROM orders WHERE "shipmentId" = $1)`,
      [id]
    );
    await manager.query(`DELETE FROM orders WHERE "shipmentId" = $1`, [id]);
    await manager.query(`DELETE FROM products WHERE "shipmentId" = $1`, [id]);
    await manager.query(`DELETE FROM doa_reports WHERE "shipmentId" = $1`, [id]);
    await manager.query(`DELETE FROM shipments WHERE id = $1`, [id]);
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
      const totals = calculateOrderTotals(o.items, o.includeShipping, o.freightCharge, o.creditApplied);
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
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();

  const db = await getDb();
  const repo = db.getRepository(Shipment);

  const shipment = await repo.findOneBy({ id });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const { name, deadline, shipmentDate, freightCost, margin, status, products } = body;
  if (name !== undefined) shipment.name = name;
  if (deadline !== undefined) shipment.deadline = new Date(deadline);
  if (shipmentDate !== undefined) shipment.shipmentDate = new Date(shipmentDate);
  if (freightCost !== undefined) shipment.freightCost = freightCost;
  if (margin !== undefined) shipment.margin = margin;
  if (status !== undefined) shipment.status = status;

  if (products !== undefined && Array.isArray(products)) {
    await db.transaction(async (manager) => {
      await manager.save(Shipment, shipment);

      const existingProducts = await manager.find(Product, { where: { shipmentId: id } });
      const incomingIds = new Set(
        products.filter((p: { id?: string }) => p.id).map((p: { id: string }) => p.id)
      );

      // Delete products not in incoming list
      const toDelete = existingProducts.filter((p) => !incomingIds.has(p.id));
      for (const p of toDelete) {
        await manager.query(`UPDATE order_items SET "productId" = NULL WHERE "productId" = $1`, [p.id]);
        await manager.remove(Product, p);
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
