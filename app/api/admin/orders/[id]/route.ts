import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getOrderById, updateOrderStatus, updateOrderItems, updateAcceptedOrderItems, calculateOrderTotals, markOrderPaid, updateAdminDraftOrder, assignDraftOrderCustomer, createAdminOrder, formatPrice, getOrderRemainingBalance } from "@/server/services/order.service";
import { getUserDiscount } from "@/server/lib/discount";
import { Order, OrderStatus } from "@/server/entities/Order";
import { OrderPayment } from "@/server/entities/OrderPayment";
import { DoaClaim } from "@/server/entities/DoaClaim";
import { Address } from "@/server/entities/Address";
import { audit } from "@/server/services/audit.service";
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

  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied, order.discountPercent);
  const items = order.items.map((i) => ({
    ...i,
    latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
    categoryName: i.catalogProduct?.category?.name || null,
    size: i.product?.size || null,
    variant: i.product?.variant || null,
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

  // Soft delete the order and its claims/payments. Items and credit
  // transactions are preserved — they're only reachable through the order.
  await db.transaction(async (manager) => {
    await manager.getRepository(DoaClaim).softDelete({ orderId: id });
    await manager.getRepository(OrderPayment).softDelete({ orderId: id });
    await manager.getRepository(Order).softDelete(id);
  });
  await audit(admin, "order.delete", "order", id, {
    status: order.status,
    userId: order.userId,
    shipmentId: order.shipmentId,
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

    // Save freight/adminNotes/boxLimits/discount FIRST so the invoice gets the correct values
    if (body.freightCharge !== undefined || body.adminNotes !== undefined || body.maxBoxes !== undefined || body.minBoxes !== undefined || body.includeShipping !== undefined || body.discountPercent !== undefined || body.boxCount !== undefined || body.freightPerBox !== undefined) {
      const db = await getDb();
      const update: Record<string, unknown> = {};
      if (body.freightCharge !== undefined) update.freightCharge = body.freightCharge;
      if (body.adminNotes !== undefined) update.adminNotes = body.adminNotes;
      if (body.maxBoxes !== undefined) update.maxBoxes = body.maxBoxes;
      if (body.minBoxes !== undefined) update.minBoxes = body.minBoxes;
      if (body.includeShipping !== undefined) update.includeShipping = body.includeShipping;
      if (body.discountPercent !== undefined) update.discountPercent = body.discountPercent;
      if (body.boxCount !== undefined) update.boxCount = body.boxCount;
      if (body.freightPerBox !== undefined) update.freightPerBox = body.freightPerBox;
      await db.getRepository(Order).update(id, update);
    }

    // Handle DRAFT order updates
    if (currentOrder.status === OrderStatus.DRAFT) {
      if (body.draftItems) {
        await updateAdminDraftOrder(id, body.draftItems, body.notes, body.userId !== undefined ? (body.userId || null) : undefined);
      } else if (body.userId !== undefined) {
        // Shipment / duplicated drafts assign a customer from the detail page, which sends
        // `items`+`userId` (not the catalog `draftItems` payload). Syncs the order discount.
        await assignDraftOrderCustomer(id, body.userId || null);
      }
      // Shipment DRAFTs are edited from the order detail page (which sends `items`),
      // not the catalog OrderBuilder. Persist their item edits when not transitioning status.
      if (currentOrder.shipmentId && body.items && body.status !== OrderStatus.ACCEPTED) {
        await updateOrderItems(id, body.items);
      }
      // DRAFT shipment orders can also be moved to AWAITING_FULFILLMENT or REJECTED
      // directly from the detail page, since the admin builds these on the customer's behalf.
      if (currentOrder.shipmentId && body.status && body.status !== OrderStatus.ACCEPTED && body.status !== OrderStatus.DRAFT) {
        await updateOrderStatus(id, body.status, body.includeShipping, body.skipEmail);
      }
      // DRAFT → ACCEPTED transition: run the full createAdminOrder flow
      if (body.status === OrderStatus.ACCEPTED) {
        // Get the current items to pass to createAdminOrder
        const draftOrder = await getOrderById(id);
        if (!draftOrder?.userId) {
          return NextResponse.json({ error: "A customer must be assigned before accepting the order" }, { status: 400 });
        }
        if (draftOrder) {
          // Shipment DRAFTs use productId (not catalogProductId) — the catalog-order recreation
          // path below would drop all their items. For shipment DRAFTs we simply replace the
          // items with body.items (if provided) and transition the existing order to ACCEPTED.
          if (draftOrder.shipmentId) {
            if (body.items) {
              await updateOrderItems(id, body.items);
            }
            await updateOrderStatus(id, OrderStatus.ACCEPTED, body.includeShipping, body.skipEmail);
            await audit(admin, "order.accept", "order", id, { from: "DRAFT", userId: draftOrder.userId });
            const accepted = await getOrderById(id);
            if (accepted) {
              const totals = calculateOrderTotals(accepted.items, accepted.includeShipping, accepted.freightCharge, accepted.creditApplied, accepted.discountPercent);
              const resultItems = accepted.items.map((i) => ({
                ...i,
                latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
                categoryName: i.catalogProduct?.category?.name || null,
                size: i.product?.size || null,
                variant: i.product?.variant || null,
              }));
              return NextResponse.json({ ...accepted, items: resultItems, totals });
            }
          } else {
            const draftItems = draftOrder.items.map((i) => ({
              catalogProductId: i.catalogProductId!,
              quantity: i.quantity,
              surcharge: Number(i.surcharge) || 0,
            })).filter((i) => i.catalogProductId);
            // Soft-delete the superseded draft (items stay attached to it), then create as ACCEPTED
            const db2 = await getDb();
            await db2.getRepository(Order).softDelete(id);
            const accepted = await createAdminOrder("admin", draftOrder.userId, draftItems, draftOrder.notes || undefined, body.includeShipping ?? draftOrder.includeShipping, body.skipEmail);
            if (accepted) {
              await audit(admin, "order.accept", "order", accepted.id, { from: "DRAFT", supersededDraftId: id, userId: draftOrder.userId });
              const totals = calculateOrderTotals(accepted.items, accepted.includeShipping, accepted.freightCharge, accepted.creditApplied, accepted.discountPercent);
              const resultItems = accepted.items.map((i) => ({
                ...i,
                latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
                categoryName: i.catalogProduct?.category?.name || null,
                size: i.product?.size || null,
                variant: i.product?.variant || null,
              }));
              return NextResponse.json({ ...accepted, items: resultItems, totals });
            }
          }
        }
      }
    } else if (body.items && (currentOrder.status === OrderStatus.ACCEPTED || currentOrder.status === OrderStatus.AWAITING_FULFILLMENT || currentOrder.status === OrderStatus.AWAITING_PAYMENT)) {
      await updateAcceptedOrderItems(id, body.items, body.includeShipping, body.skipEmail);
      if (body.status && body.status !== currentOrder.status) {
        await updateOrderStatus(id, body.status, body.includeShipping, body.skipEmail);
      }
    } else {
      if (body.items) {
        await updateOrderItems(id, body.items);
      }

      if (body.status || body.includeShipping !== undefined) {
        await updateOrderStatus(id, body.status, body.includeShipping, body.skipEmail);
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
        const totals = calculateOrderTotals(resendOrder.items, resendOrder.includeShipping, resendOrder.freightCharge, resendOrder.creditApplied, resendOrder.discountPercent);
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

    // One audit entry per PATCH, capturing what changed and the pre-edit item
    // list so replaced items are always recoverable from the audit trail.
    await audit(admin, "order.update", "order", id, {
      beforeStatus: currentOrder.status,
      ...(body.status ? { status: body.status } : {}),
      ...(body.items || body.draftItems
        ? {
            itemsChanged: true,
            beforeItems: currentOrder.items.map((i) => ({
              name: i.name,
              quantity: i.quantity,
              unitPrice: Number(i.unitPrice),
              surcharge: Number(i.surcharge) || 0,
            })),
          }
        : {}),
      ...(body.markPaid ? { markPaid: true } : {}),
      ...(body.confirmPaymentId ? { confirmPaymentId: body.confirmPaymentId } : {}),
      ...(body.resendEmail ? { resendEmail: true } : {}),
      ...(body.freightCharge !== undefined ? { freightCharge: body.freightCharge } : {}),
      ...(body.discountPercent !== undefined ? { discountPercent: body.discountPercent } : {}),
    });

    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied, order.discountPercent);
    const patchItems = order.items.map((i) => ({
      ...i,
      latinName: i.catalogProduct?.latinName || i.product?.latinName || null,
      categoryName: i.catalogProduct?.category?.name || null,
      size: i.product?.size || null,
      variant: i.product?.variant || null,
    }));
    return NextResponse.json({ ...order, items: patchItems, payments: order.payments || [], totals, remainingBalance: getOrderRemainingBalance(order) });
  } catch (e) {
    log.error("Admin order PATCH failed", e, { route: "/api/admin/orders/[id]", method: "PATCH", meta: { orderId: id } });
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal server error" }, { status: 500 });
  }
}
