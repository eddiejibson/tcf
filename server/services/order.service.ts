import { getDb } from "../db/data-source";
import { Order, OrderStatus } from "../entities/Order";
import { OrderItem } from "../entities/OrderItem";
import { User, UserRole } from "../entities/User";
import { MoreThan } from "typeorm";
import { Shipment } from "../entities/Shipment";
import { sendOrderNotification, sendOrderStatusUpdate } from "./email.service";

const SHIPPING_COST = 25;
const VAT_RATE = 0.2;

export function calculateOrderTotals(items: { unitPrice: number; quantity: number }[], includeShipping: boolean) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);
  const vat = subtotal * VAT_RATE;
  const shipping = includeShipping ? SHIPPING_COST : 0;
  const total = subtotal + vat + shipping;
  return { subtotal, vat, shipping, total };
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

export async function createOrder(userId: string, shipmentId: string, items: { productId: string; name: string; quantity: number; unitPrice: number }[]) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const order = orderRepo.create({
    userId,
    shipmentId,
    status: OrderStatus.DRAFT,
    items: items.map((item) => ({
      productId: item.productId,
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
  const totals = calculateOrderTotals(order.items, order.includeShipping);

  try {
    await sendOrderNotification(adminEmails, order.user.email, order.shipment.name, formatPrice(totals.total));
  } catch (e) {
    console.error("Failed to send order notification:", e);
  }

  return order;
}

export async function updateOrderStatus(orderId: string, status: OrderStatus, includeShipping?: boolean) {
  const db = await getDb();
  const orderRepo = db.getRepository(Order);

  const existing = await orderRepo.findOneByOrFail({ id: orderId });
  if (status) existing.status = status;
  if (includeShipping !== undefined) existing.includeShipping = includeShipping;
  await orderRepo.save(existing);

  if (status === OrderStatus.APPROVED || status === OrderStatus.REJECTED) {
    const order = await getOrderById(orderId);
    if (order) {
      const totals = calculateOrderTotals(order.items, order.includeShipping);
      try {
        await sendOrderStatusUpdate(order.user.email, order.shipment.name, status, formatPrice(totals.total));
      } catch (e) {
        console.error("Failed to send status update email:", e);
      }
    }
  }

  return getOrderById(orderId);
}

export async function getAllOrders() {
  const db = await getDb();
  return db.getRepository(Order).find({
    relations: ["items", "shipment", "user"],
    order: { createdAt: "DESC" },
  });
}
