import type { UserType } from "@/server/entities/User";
import type { ShipmentType } from "@/server/entities/Shipment";
import type { ProductType } from "@/server/entities/Product";
import type { OrderType } from "@/server/entities/Order";
import type { OrderItemType } from "@/server/entities/OrderItem";

type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};

export type SerializedUser = Serialized<UserType>;
export type SerializedShipment = Serialized<ShipmentType>;
export type SerializedProduct = Serialized<ProductType>;
export type SerializedOrder = Serialized<OrderType>;
export type SerializedOrderItem = Serialized<OrderItemType>;

export interface OrderTotals {
  subtotal: number;
  vat: number;
  shipping: number;
  total: number;
}

export type UserListItem = Pick<SerializedUser, "id" | "email" | "role" | "createdAt"> & {
  orderCount: number;
};

export type AdminShipmentListItem = Pick<SerializedShipment, "id" | "name" | "status" | "deadline" | "shipmentDate" | "freightCost" | "createdAt"> & {
  productCount: number;
  orderCount: number;
};

export type AdminOrderListItem = Pick<SerializedOrder, "id" | "status" | "createdAt"> & {
  userEmail: string;
  shipmentName: string;
  itemCount: number;
  total: number;
};

export type EditableOrderItem = Pick<SerializedOrderItem, "id" | "productId" | "name" | "quantity" | "unitPrice">;

export type AdminOrderDetail = SerializedOrder & {
  user: { email: string };
  shipment: { name: string };
  items: SerializedOrderItem[];
  totals: OrderTotals;
};

export type ShipmentListItem = Pick<SerializedShipment, "id" | "name" | "deadline" | "shipmentDate" | "freightCost"> & {
  productCount: number;
};

export type ShipmentDetail = Pick<SerializedShipment, "id" | "name" | "deadline" | "shipmentDate" | "freightCost"> & {
  products: SerializedProduct[];
};

export type UserOrderListItem = Pick<SerializedOrder, "id" | "status" | "createdAt"> & {
  shipmentName: string;
  itemCount: number;
  total: number;
};

export type UserOrderDetail = SerializedOrder & {
  shipment: { name: string };
  items: SerializedOrderItem[];
  totals: OrderTotals;
};

export interface ParsedProduct {
  name: string;
  price: number | null;
  qtyPerBox: number | null;
  originalRow?: Record<string, unknown>;
  warnings: string[];
}

export interface ParsedShipment {
  name: string | null;
  shipmentDate: string | null;
  deadline: string | null;
  freightCost: number | null;
  items: ParsedProduct[];
  warnings: string[];
}
