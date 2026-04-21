import { getDb } from "../db/data-source";
import { Order, OrderStatus, PaymentMethod } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { Product } from "../entities/Product";
import { User, UserRole } from "../entities/User";
import { log } from "../logger";
import { MoreThanOrEqual } from "typeorm";
import { Shipment } from "../entities/Shipment";
import { sendOrderNotification, sendOrderStatusUpdate, sendOrderAcceptedWithInvoice, sendOrderChanges, sendAdminOrderCreated, sendOrderPaidNotification, sendOrderPaidCustomerNotification } from "./email.service";
import { generateInvoiceBuffer } from "./invoice.service";
import type { InvoiceData } from "../../app/lib/generate-invoice";
import { applyCredit, refundCredit, getCompanyIdForUser } from "./credit.service";
import { CatalogProduct } from "../entities/CatalogProduct";
import { deductCatalogStock, restoreCatalogStock } from "./catalog.service";
import { getUserDiscount, applyDiscount } from "../lib/discount";
import { OrderPayment, OrderPaymentStatus, OrderPaymentMethod } from "../entities/OrderPayment";

const SHIPPING_COST = 30;
const VAT_RATE = 0.2;

export function calculateOrderTotals(items: { unitPrice: number; quantity: number; surcharge?: number }[], includeShipping: boolean, freightCharge?: number | null, creditApplied?: number) {
  const subtotal = items.reduce((sum, item) => {
    const base = Number(item.unitPrice) * item.quantity;
    return sum + base + base * ((Number(item.surcharge) || 0) / 100);
  }, 0);
  const shipping = includeShipping ? SHIPPING_COST : 0;
  const freight = Number(freightCharge) || 0;
  const vat = (subtotal + shipping + freight) * VAT_RATE;
  const credit = Number(creditApplied) || 0;
  const total = subtotal + shipping + freight + vat - credit;
  return { subtotal, vat, shipping, freight, credit, total };
}

export function formatPrice(price: number): string {
  return `£${price.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Returns every email that should receive a customer-facing notification about this order.
// If the order's user belongs to a company, all company members are included (shared access
// model — orders are company-visible via getCompanyOrders). Otherwise just the user's email.
// Returns [] if neither is available so callers can skip emailing safely.
export async function getOrderCustomerEmails(userId: string | null | undefined): Promise<string[]> {
  if (!userId) return [];
  const db = await getDb();
  const user = await db.getRepository(User).findOne({ where: { id: userId } });
  if (!user) return [];
  if (!user.companyId) return [user.email];
  const members = await db.getRepository(User).find({ where: { companyId: user.companyId } });
  const emails = members.map((m) => m.email).filter((e): e is string => !!e);
  // De-dupe and ensure the order's primary user email is always in the list
  const set = new Set(emails);
  set.add(user.email);
  return Array.from(set);
}

export async function getActiveShipments() {
  const db = await getDb();
  return db.getRepository(Shipment).find({
    where: { status: "ACTIVE" as never, deadline: MoreThanOrEqual(new Date(new Date().toISOString().split("T")[0])) },
    relations: ["products"],
    order: { deadline: "ASC" },
  });
}

export async function getShipmentWithProducts(id: string) {
  const db = await getDb();
  return db.getRepository(Shipment).findOne({
    where: { id },
    relations: ["products"],
  });
}

export async function getUserOrders(userId: string) {
  const db = await getDb();
  return db.getRepository(Order).find({
    where: { userId },
    relations: ["items", "shipment"],
    order: { createdAt: "DESC" },
  });
}

export async function getCompanyOrders(companyId: string) {
  const db = await getDb();
  return db.getRepository(Order)
    .createQueryBuilder("order")
    .leftJoinAndSelect("order.items", "items")
    .leftJoinAndSelect("order.shipment", "shipment")
    .leftJoinAndSelect("order.user", "user")
    .where("user.companyId = :companyId", { companyId })
    .orderBy("order.createdAt", "DESC")
    .getMany();
}

export async function getOrderById(id: string, relations = ["items", "items.product", "items.catalogProduct", "items.catalogProduct.category", "shipment", "user"]) {
  const db = await getDb();
  const order = await db.getRepository(Order).findOne({ where: { id }, relations });
  if (order) {
    order.payments = await db.getRepository(OrderPayment).find({ where: { orderId: id }, order: { createdAt: "ASC" } });
  }
  return order;
}

export async function createOrder(userId: string, shipmentId: string, items: { productId: string; name: string; quantity: number; unitPrice: number; substituteProductId?: string | null; substituteName?: string | null }[], opts?: { skipDiscount?: boolean }) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const productRepo = db.getRepository(Product);

  // Stock is checked as a warning only — orders are still created as drafts
  // Admin will adjust quantities if needed before accepting

  // skipDiscount lets callers (like the packing-list import) provide final admin-set prices
  // without the backend layering another discount on top.
  const discountPct = opts?.skipDiscount ? 0 : await getUserDiscount(userId);

  const order = orderRepo.create({
    userId,
    shipmentId,
    status: OrderStatus.DRAFT,
    items: items.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: applyDiscount(item.unitPrice, discountPct),
      substituteProductId: item.substituteProductId || null,
      substituteName: item.substituteName || null,
    })),
  });

  return orderRepo.save(order);
}

export async function createCatalogOrder(userId: string, items: { catalogProductId: string; quantity: number }[]) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const catalogRepo = db.getRepository(CatalogProduct);

  const discountPct = await getUserDiscount(userId);

  const orderItems: { catalogProductId: string; name: string; quantity: number; unitPrice: number }[] = [];
  for (const item of items) {
    const product = await catalogRepo.findOneBy({ id: item.catalogProductId });
    if (!product) throw new Error(`Catalog product not found: ${item.catalogProductId}`);
    if (!product.active) throw new Error(`Product is inactive: ${product.name}`);
    orderItems.push({
      catalogProductId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: applyDiscount(Number(product.price), discountPct),
    });
  }

  const order = orderRepo.create({
    userId,
    shipmentId: null,
    status: OrderStatus.DRAFT,
    items: orderItems.map((item) => ({
      productId: null,
      catalogProductId: item.catalogProductId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  });

  return orderRepo.save(order);
}

export async function updateOrderItems(orderId: string, items: { productId?: string | null; name: string; quantity: number; unitPrice: number }[]) {
  const db = await getDb();
  const itemRepo = db.getRepository(OrderItem);

  await itemRepo.delete({ orderId });

  const newItems = items.map((item) =>
    itemRepo.create({
      orderId,
      productId: item.productId || null,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })
  );

  return itemRepo.save(newItems);
}

export async function submitOrder(orderId: string) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const existing = await orderRepo.findOneByOrFail({ id: orderId });
  existing.status = OrderStatus.SUBMITTED;
  await orderRepo.save(existing);

  const order = await getOrderById(orderId);
  if (!order) return null;

  const adminUsers = await db.getRepository(User).find({ where: { role: UserRole.ADMIN } });
  const adminEmails = adminUsers.map((u) => u.email);
  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);

  sendOrderNotification(adminEmails, order.user!.email, order.shipment?.name || "Catalog Order", formatPrice(totals.total), order.id)
    .catch((e) => log.error("Failed to send order notification", e));

  return order;
}

async function deductStock(items: OrderItem[]) {
  const db = await getDb();
  const productRepo = db.getRepository(Product);

  for (const item of items) {
    if (!item.productId) continue;
    const product = await productRepo.findOneBy({ id: item.productId });
    if (product && product.availableQty !== null) {
      product.availableQty = Math.max(0, product.availableQty - item.quantity);
      await productRepo.save(product);
    }
  }
}

async function restoreStock(items: OrderItem[]) {
  const db = await getDb();
  const productRepo = db.getRepository(Product);

  for (const item of items) {
    if (!item.productId) continue;
    const product = await productRepo.findOneBy({ id: item.productId });
    if (product && product.availableQty !== null) {
      product.availableQty = product.availableQty + item.quantity;
      await productRepo.save(product);
    }
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, includeShipping?: boolean, skipEmail?: boolean) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const existing = await orderRepo.findOneByOrFail({ id: orderId });
  const prevStatus = existing.status;

  if (status) existing.status = status;
  if (includeShipping !== undefined) existing.includeShipping = includeShipping;
  await orderRepo.save(existing);

  const order = await getOrderById(orderId);
  if (!order) return null;

  if (status === OrderStatus.ACCEPTED && prevStatus !== OrderStatus.ACCEPTED) {
    await deductStock(order.items);
    for (const item of order.items) {
      if (item.catalogProductId) {
        await deductCatalogStock(item.catalogProductId, item.quantity);
      }
    }

    // Auto-apply credit if user opted in at submission
    if (order.useCredit && !Number(order.creditApplied) && order.userId) {
      const companyId = await getCompanyIdForUser(order.userId);
      if (companyId) {
        const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, 0);
        const grandTotal = totals.total;
        if (grandTotal > 0) {
          const result = await applyCredit(orderId, companyId, grandTotal);
          if (result.creditApplied > 0) {
            const refreshed = await getOrderById(orderId);
            if (refreshed) Object.assign(order, refreshed);

            const newTotals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
            if (newTotals.total <= 0) {
              await markOrderPaid(orderId, "CREDIT");
              const paidOrder = await getOrderById(orderId);
              if (paidOrder) Object.assign(order, paidOrder);
            }
          }
        }
      }
    }
  }

  if (prevStatus === OrderStatus.ACCEPTED && status === OrderStatus.REJECTED) {
    await restoreStock(order.items);
    for (const item of order.items) {
      if (item.catalogProductId) {
        await restoreCatalogStock(item.catalogProductId, item.quantity);
      }
    }
    if (Number(order.creditApplied) > 0 && order.userId) {
      const companyId = await getCompanyIdForUser(order.userId);
      if (companyId) await refundCredit(orderId, companyId);
    }
  }

  if (!skipEmail && (status === OrderStatus.ACCEPTED || status === OrderStatus.REJECTED || status === OrderStatus.AWAITING_FULFILLMENT)) {
    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    // Fire and forget — don't block the API response on email/PDF
    if (status === OrderStatus.ACCEPTED) {
      const orderDiscountPct = order.userId ? await getUserDiscount(order.userId) : 0;
      const invoiceData: InvoiceData = {
        orderRef: order.id.slice(0, 8).toUpperCase(),
        date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        status: "ACCEPTED",
        customerEmail: order.user!.email,
        customerCompanyName: order.user!.companyName,
        shipmentName: order.shipment?.name || "Catalog Order",
        items: order.items.map((i) => ({
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
        includeShipping: order.includeShipping,
        paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference,
        discountPercent: orderDiscountPct,
      };
      const recipients = await getOrderCustomerEmails(order.userId);
      generateInvoiceBuffer(invoiceData)
        .then((pdfBuffer) => sendOrderAcceptedWithInvoice(recipients.length ? recipients : order.user!.email, order.shipment?.name || "Catalog Order", formatPrice(totals.total), order.id, invoiceData.orderRef, pdfBuffer))
        .catch((e) => log.error("Failed to send accepted email with invoice", e));
    } else {
      const recipients = await getOrderCustomerEmails(order.userId);
      sendOrderStatusUpdate(recipients.length ? recipients : order.user!.email, order.shipment?.name || "Catalog Order", status, formatPrice(totals.total), order.id)
        .catch((e) => log.error("Failed to send status update email", e));
    }
  }

  return order;
}

export async function updateAcceptedOrderItems(
  orderId: string,
  newItems: { productId?: string | null; name: string; quantity: number; unitPrice: number; surcharge?: number }[],
  includeShipping?: boolean,
  skipEmail?: boolean,
) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const itemRepo = db.getRepository(OrderItem);

  const order = await getOrderById(orderId);
  if (!order || (order.status !== OrderStatus.ACCEPTED && order.status !== OrderStatus.AWAITING_FULFILLMENT)) return null;

  const oldItems = order.items;
  const changes: string[] = [];

  const oldMap = new Map(oldItems.map((i) => [i.name, i]));
  const newMap = new Map(newItems.map((i) => [i.name, i]));

  for (const [name, oldItem] of oldMap) {
    const newItem = newMap.get(name);
    if (!newItem) {
      changes.push(`Removed: ${name}`);
    } else {
      if (newItem.quantity !== oldItem.quantity) {
        changes.push(`${name}: qty ${oldItem.quantity} → ${newItem.quantity}`);
      }
      if (Number(newItem.unitPrice) !== Number(oldItem.unitPrice)) {
        changes.push(`${name}: price ${formatPrice(Number(oldItem.unitPrice))} → ${formatPrice(Number(newItem.unitPrice))}`);
      }
    }
  }

  for (const [name] of newMap) {
    if (!oldMap.has(name)) {
      changes.push(`Added: ${name}`);
    }
  }

  await restoreStock(oldItems);
  for (const item of oldItems) {
    if (item.catalogProductId) {
      await restoreCatalogStock(item.catalogProductId, item.quantity);
    }
  }

  await itemRepo.delete({ orderId });
  const savedItems = await itemRepo.save(
    newItems.map((item) =>
      itemRepo.create({
        orderId,
        productId: item.productId || null,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        surcharge: item.surcharge ?? 0,
      })
    )
  );

  if (includeShipping !== undefined) {
    const existing = await orderRepo.findOneByOrFail({ id: orderId });
    existing.includeShipping = includeShipping;
    await orderRepo.save(existing);
  }

  await deductStock(savedItems);
  for (const item of savedItems) {
    if (item.catalogProductId) {
      await deductCatalogStock(item.catalogProductId, item.quantity);
    }
  }

  if (changes.length > 0 && !skipEmail) {
    const updated = await getOrderById(orderId);
    if (updated) {
      const totals = calculateOrderTotals(updated.items, updated.includeShipping, updated.freightCharge, updated.creditApplied);
      const recipients = await getOrderCustomerEmails(updated.userId);
      sendOrderChanges(recipients.length ? recipients : updated.user!.email, updated.shipment?.name || "Catalog Order", changes, formatPrice(totals.total), updated.id)
        .catch((e) => log.error("Failed to send order changes email", e));
    }
  }

  return getOrderById(orderId);
}

export async function setPaymentMethod(orderId: string, method: PaymentMethod, reference?: string) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const existing = await orderRepo.findOneByOrFail({ id: orderId });
  existing.paymentMethod = method;
  if (reference) existing.paymentReference = reference;
  await orderRepo.save(existing);

  return getOrderById(orderId);
}

export async function clearPaymentMethod(orderId: string) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const existing = await orderRepo.findOneByOrFail({ id: orderId });
  existing.paymentMethod = null;
  existing.paymentReference = null;
  await orderRepo.save(existing);

  return getOrderById(orderId);
}

export async function confirmBankTransferSent(orderId: string) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const existing = await orderRepo.findOneByOrFail({ id: orderId });
  if (existing.status !== OrderStatus.ACCEPTED) return null;
  existing.status = OrderStatus.AWAITING_PAYMENT;
  await orderRepo.save(existing);

  return getOrderById(orderId);
}

export async function markOrderPaid(orderId: string, reference?: string) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const existing = await orderRepo.findOneByOrFail({ id: orderId });
  existing.status = OrderStatus.PAID;
  if (reference) existing.paymentReference = reference;
  await orderRepo.save(existing);

  const order = await getOrderById(orderId);
  if (order) {
    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    // Notify the customer (all company members). Admins are not emailed here — in the
    // admin-marks-paid path they triggered the action so don't need a self-notification,
    // and in the webhook path the webhook separately sends its own admin-facing email.
    const recipients = await getOrderCustomerEmails(order.userId);
    if (recipients.length) {
      try {
        await sendOrderPaidCustomerNotification(
          recipients,
          order.id.slice(0, 8).toUpperCase(),
          formatPrice(totals.total),
          order.paymentMethod || "Unknown",
          order.id,
        );
      } catch (e) {
        log.error("Failed to send customer paid notification", e);
      }
    }
  }

  return order;
}

export async function getAllOrders() {
  const db = await getDb();
  return db.getRepository(Order).find({
    relations: ["items", "shipment", "user"],
    order: { createdAt: "DESC" },
  });
}

export async function getAvailableStock(productId: string): Promise<number | null> {
  const db = await getDb();
  const product = await db.getRepository(Product).findOneBy({ id: productId });
  return product?.availableQty ?? null;
}

export async function createAdminOrder(
  adminUserId: string,
  targetUserId: string,
  items: { catalogProductId: string; quantity: number; surcharge?: number }[],
  notes?: string,
  includeShipping?: boolean,
  skipEmail?: boolean,
) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const itemRepo = db.getRepository(OrderItem);
  const catalogRepo = db.getRepository(CatalogProduct);

  // Look up each catalog product
  const discountPct = await getUserDiscount(targetUserId);
  const orderItems: { catalogProductId: string; name: string; latinName: string | null; categoryName: string | null; quantity: number; unitPrice: number; surcharge: number }[] = [];
  for (const item of items) {
    const product = await catalogRepo.findOne({ where: { id: item.catalogProductId }, relations: ["category"] });
    if (!product) throw new Error(`Catalog product not found: ${item.catalogProductId}`);
    if (!product.active) throw new Error(`Product is inactive: ${product.name}`);
    orderItems.push({
      catalogProductId: product.id,
      name: product.name,
      latinName: product.latinName || null,
      categoryName: product.category?.name || null,
      quantity: item.quantity,
      unitPrice: applyDiscount(Number(product.price), discountPct),
      surcharge: item.surcharge ?? (Number(product.surcharge) || 0),
    });
  }

  // Create order with no shipment
  const order = orderRepo.create({
    userId: targetUserId,
    shipmentId: null,
    status: OrderStatus.ACCEPTED,
    notes: notes || null,
    includeShipping: includeShipping || false,
  });
  const savedOrder = await orderRepo.save(order);

  // Create order items
  const savedItems = await itemRepo.save(
    orderItems.map((item) =>
      itemRepo.create({
        orderId: savedOrder.id,
        productId: null,
        catalogProductId: item.catalogProductId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        surcharge: item.surcharge,
      })
    )
  );

  // Deduct catalog stock for EXACT mode items
  for (const item of savedItems) {
    if (item.catalogProductId) {
      await deductCatalogStock(item.catalogProductId, item.quantity);
    }
  }

  const fullOrder = await getOrderById(savedOrder.id);

  // Send email to customer with invoice PDF unless skipped
  if (fullOrder && !skipEmail) {
    const totals = calculateOrderTotals(fullOrder.items, fullOrder.includeShipping, null, 0);
    const orderRef = fullOrder.id.slice(0, 8).toUpperCase();
    const invoiceData: InvoiceData = {
      orderRef,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      status: "ACCEPTED",
      customerEmail: fullOrder.user!.email,
      customerCompanyName: fullOrder.user!.companyName,
      shipmentName: "Direct Order",
      items: fullOrder.items.map((i) => ({
        name: i.name,
        latinName: i.catalogProduct?.latinName || null,
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
      includeShipping: fullOrder.includeShipping,
      paymentMethod: null,
      paymentReference: null,
      discountPercent: discountPct,
    };
    try {
      const pdfBuffer = await generateInvoiceBuffer(invoiceData);
      const recipients = await getOrderCustomerEmails(fullOrder.userId);
      await sendAdminOrderCreated(
        recipients.length ? recipients : fullOrder.user!.email,
        orderRef,
        formatPrice(totals.total),
        fullOrder.id,
        pdfBuffer
      );
    } catch (e) {
      log.error("Failed to send admin order created email", e);
    }
  }

  return fullOrder;
}

export async function createAdminDraftOrder(
  adminUserId: string,
  targetUserId: string | null,
  items: { catalogProductId: string; quantity: number; surcharge?: number }[],
  notes?: string,
  includeShipping?: boolean,
) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const itemRepo = db.getRepository(OrderItem);
  const catalogRepo = db.getRepository(CatalogProduct);

  const discountPct = targetUserId ? await getUserDiscount(targetUserId) : 0;

  const orderItems: { catalogProductId: string; name: string; quantity: number; unitPrice: number; surcharge: number }[] = [];
  for (const item of items) {
    const product = await catalogRepo.findOneBy({ id: item.catalogProductId });
    if (!product) throw new Error(`Catalog product not found: ${item.catalogProductId}`);
    orderItems.push({
      catalogProductId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: applyDiscount(Number(product.price), discountPct),
      surcharge: item.surcharge ?? (Number(product.surcharge) || 0),
    });
  }

  const order = orderRepo.create({
    userId: targetUserId || null,
    shipmentId: null,
    status: OrderStatus.DRAFT,
    notes: notes || null,
    includeShipping: includeShipping || false,
  } as Partial<Order>);
  const savedOrder = await orderRepo.save(order);

  await itemRepo.save(
    orderItems.map((item) =>
      itemRepo.create({
        orderId: savedOrder.id,
        productId: null,
        catalogProductId: item.catalogProductId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        surcharge: item.surcharge,
      })
    )
  );

  return getOrderById(savedOrder.id);
}

export async function updateAdminDraftOrder(
  orderId: string,
  items: { catalogProductId: string; quantity: number; surcharge?: number }[],
  notes?: string,
  userId?: string | null
) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const itemRepo = db.getRepository(OrderItem);
  const catalogRepo = db.getRepository(CatalogProduct);

  const order = await orderRepo.findOneBy({ id: orderId });
  if (!order) throw new Error("Order not found");
  if (order.status !== OrderStatus.DRAFT) throw new Error("Can only update DRAFT orders");

  // Update notes and userId
  let changed = false;
  if (notes !== undefined) {
    order.notes = notes || null;
    changed = true;
  }
  if (userId !== undefined) {
    order.userId = userId || null;
    changed = true;
  }
  if (changed) await orderRepo.save(order);

  // Replace items
  await itemRepo.delete({ orderId });

  const effectiveUserId = (userId !== undefined ? userId : order.userId) || null;
  const discountPct = effectiveUserId ? await getUserDiscount(effectiveUserId) : 0;

  const orderItems: { catalogProductId: string; name: string; quantity: number; unitPrice: number; surcharge: number }[] = [];
  for (const item of items) {
    const product = await catalogRepo.findOneBy({ id: item.catalogProductId });
    if (!product) continue;
    orderItems.push({
      catalogProductId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: applyDiscount(Number(product.price), discountPct),
      surcharge: item.surcharge ?? (Number(product.surcharge) || 0),
    });
  }

  await itemRepo.save(
    orderItems.map((item) =>
      itemRepo.create({
        orderId,
        productId: null,
        catalogProductId: item.catalogProductId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        surcharge: item.surcharge,
      })
    )
  );

  return getOrderById(orderId);
}

// ─── SPLIT PAYMENT HELPERS ────────────────────────────────────────────

export function getOrderPaidAmount(order: { payments?: { status: string; amount: number }[] }): number {
  if (!order.payments) return 0;
  return order.payments
    .filter((p) => p.status === OrderPaymentStatus.COMPLETED)
    .reduce((sum, p) => sum + Number(p.amount), 0);
}

export function getOrderRemainingBalance(order: { items: { unitPrice: number; quantity: number; surcharge?: number }[]; includeShipping: boolean; freightCharge?: number | null; creditApplied?: number; payments?: { status: string; amount: number }[] }): number {
  const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
  const paid = getOrderPaidAmount(order);
  return Math.max(0, Math.round((totals.total - paid) * 100) / 100);
}

export async function addOrderPayment(orderId: string, method: PaymentMethod, amount: number, reference?: string | null, status?: OrderPaymentStatus): Promise<OrderPayment> {
  const db = await getDb();
  const repo = db.getRepository(OrderPayment);
  const payment = repo.create({
    orderId,
    method: method as unknown as OrderPaymentMethod,
    amount,
    reference: reference || null,
    status: status || OrderPaymentStatus.PENDING,
  });
  return repo.save(payment);
}

export async function markPaymentAwaitingConfirmation(paymentId: string): Promise<void> {
  const db = await getDb();
  await db.getRepository(OrderPayment).update(paymentId, { status: OrderPaymentStatus.AWAITING_CONFIRMATION });
}

export async function confirmOrderPayment(paymentId: string): Promise<void> {
  const db = await getDb();
  await db.getRepository(OrderPayment).update(paymentId, { status: OrderPaymentStatus.COMPLETED });
}

export async function checkOrderFullyPaid(orderId: string): Promise<boolean> {
  const order = await getOrderById(orderId);
  if (!order) return false;

  const remaining = getOrderRemainingBalance(order);

  if (remaining <= 0 && order.status !== OrderStatus.PAID) {
    await markOrderPaid(orderId, "SPLIT");
    return true;
  }

  // If there are any payments but not fully paid, move to AWAITING_PAYMENT
  const hasPayments = (order.payments?.length || 0) > 0;
  if (hasPayments && order.status === OrderStatus.ACCEPTED) {
    const db = await getDb();
    await db.getRepository(Order).update(orderId, { status: OrderStatus.AWAITING_PAYMENT });
  }

  return false;
}

export async function deleteOrderPayment(paymentId: string): Promise<void> {
  const db = await getDb();
  const payment = await db.getRepository(OrderPayment).findOneByOrFail({ id: paymentId });
  if (payment.status === OrderPaymentStatus.COMPLETED) throw new Error("Cannot delete a completed payment");
  await db.getRepository(OrderPayment).delete(paymentId);
}
