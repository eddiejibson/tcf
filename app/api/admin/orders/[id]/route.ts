import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getOrderById, updateOrderStatus, updateOrderItems, updateAcceptedOrderItems, calculateOrderTotals, markOrderPaid, updateAdminDraftOrder, createAdminOrder, formatPrice, getOrderRemainingBalance } from "@/server/services/order.service";
import { getUserDiscount } from "@/server/lib/discount";
import { Order, OrderStatus } from "@/server/entities/Order";
import { OrderItem } from "@/server/entities/OrderItem";
import { Address } from "@/server/entities/Address";
import { Application } from "@/server/entities/Application";
import { User } from "@/server/entities/User";
import { getDb } from "@/server/db/data-source";
import { log } from "@/server/logger";
import { isUuid } from "@/server/utils";
import { sendOrderAcceptedWithInvoice } from "@/server/services/email.service";
import { generateInvoiceBuffer } from "@/server/services/invoice.service";
import type { InvoiceData } from "@/app/lib/generate-invoice";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const order = await getOrderById(id);
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
  const items = order.items.map((i) => ({
    ...i,
    latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
    categoryName: i.catalogProduct?.category?.name || null,
  }));

  // Fetch shipping/billing address from company addresses or application
  let shippingAddress: { line1: string; line2: string | null; city: string; county: string | null; postcode: string; country: string } | null = null;
  let billingAddress: { line1: string; line2: string | null; city: string; county: string | null; postcode: string; country: string } | null = null;
  if (order.userId) {
    const db = await getDb();
    // First try: company addresses
    const user = await db.getRepository(User).findOneBy({ id: order.userId });
    if (user?.companyId) {
      const addresses = await db.getRepository(Address).find({ where: { companyId: user.companyId } });
      const shipping = addresses.find((a) => a.type === "SHIPPING");
      const billing = addresses.find((a) => a.type === "BILLING");
      if (shipping) shippingAddress = { line1: shipping.line1, line2: shipping.line2, city: shipping.city, county: shipping.county, postcode: shipping.postcode, country: shipping.country };
      if (billing) billingAddress = { line1: billing.line1, line2: billing.line2, city: billing.city, county: billing.county, postcode: billing.postcode, country: billing.country };
    }
    // Fallback: application addresses (stored as JSON)
    if (!shippingAddress || !billingAddress) {
      const app = await db.getRepository(Application).findOne({
        where: [{ userId: order.userId }, ...(user?.email ? [{ contactEmail: user.email }] : [])],
        order: { createdAt: "DESC" },
      });
      if (app) {
        if (!shippingAddress && app.shippingAddress) {
          shippingAddress = { line1: app.shippingAddress.line1, line2: app.shippingAddress.line2 || null, city: app.shippingAddress.city, county: app.shippingAddress.county || null, postcode: app.shippingAddress.postcode, country: app.shippingAddress.country || "United Kingdom" };
        }
        if (!billingAddress && app.billingAddress) {
          billingAddress = { line1: app.billingAddress.line1, line2: app.billingAddress.line2 || null, city: app.billingAddress.city, county: app.billingAddress.county || null, postcode: app.billingAddress.postcode, country: app.billingAddress.country || "United Kingdom" };
        }
      }
    }
  }

  return NextResponse.json({ ...order, items, payments: order.payments || [], totals, remainingBalance: getOrderRemainingBalance(order), shippingAddress, billingAddress });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = await getDb();
  const order = await db.getRepository(Order).findOneBy({ id });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  await db.transaction(async (manager) => {
    await manager.query(
      `DELETE FROM credit_transactions WHERE "doaClaimId" IN (SELECT id FROM doa_claims WHERE "orderId" = $1)`,
      [id]
    );
    await manager.query(
      `DELETE FROM doa_items WHERE "claimId" IN (SELECT id FROM doa_claims WHERE "orderId" = $1)`,
      [id]
    );
    await manager.query(`DELETE FROM doa_claims WHERE "orderId" = $1`, [id]);
    await manager.query(`DELETE FROM credit_transactions WHERE "orderId" = $1`, [id]);
    await manager.query(`DELETE FROM order_payments WHERE "orderId" = $1`, [id]);
    await manager.query(`DELETE FROM order_items WHERE "orderId" = $1`, [id]);
    await manager.query(`DELETE FROM orders WHERE id = $1`, [id]);
  });

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();

    const currentOrder = await getOrderById(id);
    if (!currentOrder) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    // Save freight/adminNotes/boxLimits FIRST so the invoice gets the correct values
    if (body.freightCharge !== undefined || body.adminNotes !== undefined || body.maxBoxes !== undefined || body.minBoxes !== undefined || body.includeShipping !== undefined) {
      const db = await getDb();
      const update: Record<string, unknown> = {};
      if (body.freightCharge !== undefined) update.freightCharge = body.freightCharge;
      if (body.adminNotes !== undefined) update.adminNotes = body.adminNotes;
      if (body.maxBoxes !== undefined) update.maxBoxes = body.maxBoxes;
      if (body.minBoxes !== undefined) update.minBoxes = body.minBoxes;
      if (body.includeShipping !== undefined) update.includeShipping = body.includeShipping;
      await db.getRepository(Order).update(id, update);
    }

    // Handle DRAFT order updates
    if (currentOrder.status === OrderStatus.DRAFT) {
      if (body.draftItems) {
        await updateAdminDraftOrder(id, body.draftItems, body.notes, body.userId !== undefined ? (body.userId || null) : undefined);
      }
      // DRAFT → ACCEPTED transition: run the full createAdminOrder flow
      if (body.status === OrderStatus.ACCEPTED) {
        // Get the current items to pass to createAdminOrder
        const draftOrder = await getOrderById(id);
        if (!draftOrder?.userId) {
          return NextResponse.json({ error: "A customer must be assigned before accepting the order" }, { status: 400 });
        }
        if (draftOrder) {
          const draftItems = draftOrder.items.map((i) => ({
            catalogProductId: i.catalogProductId!,
            quantity: i.quantity,
            surcharge: Number(i.surcharge) || 0,
          })).filter((i) => i.catalogProductId);
          // Delete the draft items then the draft order, then create as ACCEPTED
          const db2 = await getDb();
          await db2.getRepository(OrderItem).delete({ orderId: id });
          await db2.getRepository(Order).delete(id);
          const accepted = await createAdminOrder("admin", draftOrder.userId, draftItems, draftOrder.notes || undefined, body.includeShipping ?? draftOrder.includeShipping, body.skipEmail);
          if (accepted) {
            const totals = calculateOrderTotals(accepted.items, accepted.includeShipping, accepted.freightCharge, accepted.creditApplied);
            const resultItems = accepted.items.map((i) => ({
              ...i,
              latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
              categoryName: i.catalogProduct?.category?.name || null,
            }));
            return NextResponse.json({ ...accepted, items: resultItems, totals });
          }
        }
      }
    } else if (body.items && (currentOrder.status === OrderStatus.ACCEPTED || currentOrder.status === OrderStatus.AWAITING_FULFILLMENT)) {
      await updateAcceptedOrderItems(id, body.items, body.includeShipping);
      if (body.status && body.status !== currentOrder.status) {
        await updateOrderStatus(id, body.status, body.includeShipping);
      }
    } else {
      if (body.items) {
        await updateOrderItems(id, body.items);
      }

      if (body.status || body.includeShipping !== undefined) {
        await updateOrderStatus(id, body.status, body.includeShipping);
      }
    }

    if (body.confirmPaymentId) {
      const { confirmOrderPayment, checkOrderFullyPaid } = await import("@/server/services/order.service");
      await confirmOrderPayment(body.confirmPaymentId);
      await checkOrderFullyPaid(id);
    }

    if (body.markPaid) {
      await markOrderPaid(id, body.paymentReference);
    }

    // Resend invoice email
    if (body.resendEmail) {
      const resendOrder = await getOrderById(id);
      if (resendOrder && resendOrder.user) {
        const totals = calculateOrderTotals(resendOrder.items, resendOrder.includeShipping, resendOrder.freightCharge, resendOrder.creditApplied);
        const orderRef = resendOrder.id.slice(0, 8).toUpperCase();
        const discountPct = resendOrder.userId ? await getUserDiscount(resendOrder.userId) : 0;
        const invoiceData: InvoiceData = {
          orderRef,
          date: new Date(resendOrder.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
          status: resendOrder.status,
          customerEmail: resendOrder.user.email,
          customerCompanyName: resendOrder.user.companyName,
          shipmentName: resendOrder.shipment?.name || "Direct Order",
          items: resendOrder.items.map((i) => ({
            name: i.name,
            latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
            categoryName: i.catalogProduct?.category?.name || null,
            quantity: i.quantity,
            unitPrice: Number(i.unitPrice),
            surcharge: Number(i.surcharge) || 0,
          })),
          subtotal: totals.subtotal,
          vat: totals.vat,
          shipping: totals.shipping,
          freight: totals.freight,
          credit: totals.credit,
          total: totals.total,
          includeShipping: resendOrder.includeShipping,
          paymentMethod: resendOrder.paymentMethod,
          paymentReference: resendOrder.paymentReference,
          discountPercent: discountPct,
        };
        const pdfBuffer = await generateInvoiceBuffer(invoiceData);
        await sendOrderAcceptedWithInvoice(
          resendOrder.user.email,
          resendOrder.shipment?.name || "Direct Order",
          formatPrice(totals.total),
          resendOrder.id,
          orderRef,
          pdfBuffer,
        );
      }
    }

    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    const patchItems = order.items.map((i) => ({
      ...i,
      latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
      categoryName: i.catalogProduct?.category?.name || null,
    }));
    return NextResponse.json({ ...order, items: patchItems, payments: order.payments || [], totals, remainingBalance: getOrderRemainingBalance(order) });
  } catch (e) {
    log.error("Admin order PATCH failed", e, { route: "/api/admin/orders/[id]", method: "PATCH", meta: { orderId: id } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
