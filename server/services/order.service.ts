import { getDb } from "../db/data-source";
import { Order, OrderStatus, PaymentMethod } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { Product } from "../entities/Product";
import { User, UserRole } from "../entities/User";
import { log } from "../logger";
import { MoreThan } from "typeorm";
import { Shipment } from "../entities/Shipment";
import { sendOrderNotification, sendOrderStatusUpdate, sendOrderAcceptedWithInvoice, sendOrderChanges, sendAdminOrderCreated, sendOrderPaidNotification } from "./email.service";
import { generateInvoiceBuffer } from "./invoice.service";
import type { InvoiceData } from "../../app/lib/generate-invoice";
import { refundCredit } from "./credit.service";
import { CatalogProduct } from "../entities/CatalogProduct";
import { deductCatalogStock, restoreCatalogStock } from "./catalog.service";

const SHIPPING_COST = 25;
const VAT_RATE = 0.2;

export function calculateOrderTotals(items: { unitPrice: number; quantity: number }[], includeShipping: boolean, freightCharge?: number | null, creditApplied?: number) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
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

export async function getActiveShipments() {
  const db = await getDb();
  return db.getRepository(Shipment).find({
    where: { status: "ACTIVE" as never, deadline: MoreThan(new Date()) },
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

export async function getOrderById(id: string, relations = ["items", "items.product", "shipment", "user"]) {
  const db = await getDb();
  return db.getRepository(Order).findOne({ where: { id }, relations });
}

export async function createOrder(userId: string, shipmentId: string, items: { productId: string; name: string; quantity: number; unitPrice: number; substituteProductId?: string | null; substituteName?: string | null }[]) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const productRepo = db.getRepository(Product);

  for (const item of items) {
    const product = await productRepo.findOneBy({ id: item.productId });
    if (product && product.availableQty !== null && product.availableQty < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}: ${product.availableQty} available`);
    }
  }

  const order = orderRepo.create({
    userId,
    shipmentId,
    status: OrderStatus.DRAFT,
    items: items.map((item) => ({
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
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

  const orderItems: { catalogProductId: string; name: string; quantity: number; unitPrice: number }[] = [];
  for (const item of items) {
    const product = await catalogRepo.findOneBy({ id: item.catalogProductId });
    if (!product) throw new Error(`Catalog product not found: ${item.catalogProductId}`);
    if (!product.active) throw new Error(`Product is inactive: ${product.name}`);
    orderItems.push({
      catalogProductId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: Number(product.price),
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

  sendOrderNotification(adminEmails, order.user.email, order.shipment?.name || "Catalog Order", formatPrice(totals.total))
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

export async function updateOrderStatus(orderId: string, status: OrderStatus, includeShipping?: boolean) {
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
  }

  if (prevStatus === OrderStatus.ACCEPTED && status === OrderStatus.REJECTED) {
    await restoreStock(order.items);
    for (const item of order.items) {
      if (item.catalogProductId) {
        await restoreCatalogStock(item.catalogProductId, item.quantity);
      }
    }
    if (Number(order.creditApplied) > 0) {
      await refundCredit(orderId, order.userId);
    }
  }

  if (status === OrderStatus.ACCEPTED || status === OrderStatus.REJECTED || status === OrderStatus.AWAITING_FULFILLMENT) {
    const totals = calculateOrderTotals(order.items, order.includeShipping, order.freightCharge, order.creditApplied);
    // Fire and forget — don't block the API response on email/PDF
    if (status === OrderStatus.ACCEPTED) {
      const invoiceData: InvoiceData = {
        orderRef: order.id.slice(0, 8).toUpperCase(),
        date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
        status: "ACCEPTED",
        customerEmail: order.user.email,
        customerCompanyName: order.user.companyName,
        shipmentName: order.shipment?.name || "Catalog Order",
        items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
        subtotal: totals.subtotal,
        vat: totals.vat,
        shipping: totals.shipping,
        freight: totals.freight,
        credit: totals.credit,
        total: totals.total,
        includeShipping: order.includeShipping,
        paymentMethod: order.paymentMethod,
        paymentReference: order.paymentReference,
      };
      generateInvoiceBuffer(invoiceData)
        .then((pdfBuffer) => sendOrderAcceptedWithInvoice(order.user.email, order.shipment?.name || "Catalog Order", formatPrice(totals.total), order.id, invoiceData.orderRef, pdfBuffer))
        .catch((e) => log.error("Failed to send accepted email with invoice", e));
    } else {
      sendOrderStatusUpdate(order.user.email, order.shipment?.name || "Catalog Order", status, formatPrice(totals.total))
        .catch((e) => log.error("Failed to send status update email", e));
    }
  }

  return order;
}

export async function updateAcceptedOrderItems(
  orderId: string,
  newItems: { productId?: string | null; name: string; quantity: number; unitPrice: number }[],
  includeShipping?: boolean
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

  if (changes.length > 0) {
    const updated = await getOrderById(orderId);
    if (updated) {
      const totals = calculateOrderTotals(updated.items, updated.includeShipping, updated.freightCharge, updated.creditApplied);
      sendOrderChanges(updated.user.email, updated.shipment?.name || "Catalog Order", changes, formatPrice(totals.total))
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
    const adminUsers = await db.getRepository(User).find({ where: { role: UserRole.ADMIN } });
    const adminEmails = adminUsers.map((u) => u.email);
    try {
      await sendOrderPaidNotification(
        adminEmails,
        order.user.email,
        order.id.slice(0, 8).toUpperCase(),
        formatPrice(totals.total),
        order.paymentMethod || "Unknown",
      );
    } catch (e) {
      log.error("Failed to send order paid notification", e);
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
  items: { catalogProductId: string; quantity: number }[],
  notes?: string
) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);
  const itemRepo = db.getRepository(OrderItem);
  const catalogRepo = db.getRepository(CatalogProduct);

  // Look up each catalog product
  const orderItems: { catalogProductId: string; name: string; quantity: number; unitPrice: number }[] = [];
  for (const item of items) {
    const product = await catalogRepo.findOneBy({ id: item.catalogProductId });
    if (!product) throw new Error(`Catalog product not found: ${item.catalogProductId}`);
    if (!product.active) throw new Error(`Product is inactive: ${product.name}`);
    orderItems.push({
      catalogProductId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: Number(product.price),
    });
  }

  // Create order with no shipment
  const order = orderRepo.create({
    userId: targetUserId,
    shipmentId: null,
    status: OrderStatus.ACCEPTED,
    notes: notes || null,
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
      })
    )
  );

  // Deduct catalog stock for EXACT mode items
  for (const item of savedItems) {
    if (item.catalogProductId) {
      await deductCatalogStock(item.catalogProductId, item.quantity);
    }
  }

  // Send email to customer with invoice PDF (awaited so serverless doesn't kill the connection)
  const fullOrder = await getOrderById(savedOrder.id);
  if (fullOrder) {
    const totals = calculateOrderTotals(fullOrder.items, false, null, 0);
    const orderRef = fullOrder.id.slice(0, 8).toUpperCase();
    const invoiceData: InvoiceData = {
      orderRef,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      status: "ACCEPTED",
      customerEmail: fullOrder.user.email,
      customerCompanyName: fullOrder.user.companyName,
      shipmentName: "Direct Order",
      items: fullOrder.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
      subtotal: totals.subtotal,
      vat: totals.vat,
      shipping: totals.shipping,
      freight: totals.freight,
      credit: totals.credit,
      total: totals.total,
      includeShipping: false,
      paymentMethod: null,
      paymentReference: null,
    };
    try {
      const pdfBuffer = await generateInvoiceBuffer(invoiceData);
      await sendAdminOrderCreated(
        fullOrder.user.email,
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
