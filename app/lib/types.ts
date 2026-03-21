import type { UserType } from "@/server/entities/User";
import type { ShipmentType } from "@/server/entities/Shipment";
import type { ProductType } from "@/server/entities/Product";
import type { OrderType } from "@/server/entities/Order";
import type { OrderItemType } from "@/server/entities/OrderItem";
import type { DoaClaimType } from "@/server/entities/DoaClaim";
import type { DoaItemType } from "@/server/entities/DoaItem";
import type { DoaReportType } from "@/server/entities/DoaReport";
import type { CategoryType } from "@/server/entities/Category";
import type { CatalogProductRecord } from "@/server/entities/CatalogProduct";
import type { ApplicationType } from "@/server/entities/Application";

type Serialized<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K];
};

export type SerializedUser = Serialized<UserType>;
export type SerializedShipment = Serialized<ShipmentType>;
export type SerializedProduct = Serialized<ProductType>;
export type SerializedOrder = Serialized<OrderType>;
export type SerializedOrderItem = Serialized<OrderItemType>;
export type SerializedDoaClaim = Serialized<DoaClaimType>;
export type SerializedDoaItem = Serialized<DoaItemType>;
export type SerializedDoaReport = Serialized<DoaReportType>;
export type SerializedCategory = Serialized<CategoryType>;
export type SerializedCatalogProduct = Serialized<CatalogProductRecord>;
export type SerializedApplication = Serialized<ApplicationType>;

export type ApplicationListItem = Pick<SerializedApplication, "id" | "companyName" | "contactName" | "contactEmail" | "status" | "createdAt">;

export type ApplicationDetail = SerializedApplication & {
  licenseFileUrl: string | null;
  shopPhotoUrls: string[];
};

export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  children: CategoryNode[];
}

export interface CatalogProductImageItem {
  id: string;
  imageKey?: string;
  imageUrl: string;
  label: string | null;
  sortOrder: number;
}

export interface CatalogProductListItem {
  id: string;
  name: string;
  latinName: string | null;
  price: number;
  type: string;
  categoryId: string;
  categoryName: string;
  images: CatalogProductImageItem[];
  stockMode: string;
  stockQty: number | null;
  stockLevel: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderTotals {
  subtotal: number;
  vat: number;
  shipping: number;
  freight: number;
  credit: number;
  total: number;
}

export type UserListItem = Pick<SerializedUser, "id" | "email" | "role" | "createdAt"> & {
  companyName: string | null;
  orderCount: number;
  creditBalance: number;
  lastLogin: string | null;
};

export type AdminShipmentListItem = Pick<SerializedShipment, "id" | "name" | "status" | "deadline" | "shipmentDate" | "freightCost" | "margin" | "createdAt"> & {
  productCount: number;
  orderCount: number;
};

export interface AdminShipmentDetailProduct {
  id: string;
  name: string;
  latinName: string | null;
  price: number;
  size: string | null;
  qtyPerBox: number;
  availableQty: number | null;
}

export interface AdminShipmentDetailOrderItem {
  id: string;
  productId: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface AdminShipmentDetailOrder {
  id: string;
  status: string;
  userEmail: string;
  userCompanyName: string | null;
  itemCount: number;
  total: number;
  createdAt: string;
  items: AdminShipmentDetailOrderItem[];
  maxBoxes?: number | null;
  minBoxes?: number | null;
}

export interface AdminShipmentDetail {
  id: string;
  name: string;
  status: string;
  deadline: string;
  shipmentDate: string;
  freightCost: number;
  margin: number;
  sourceFilename: string | null;
  createdAt: string;
  products: AdminShipmentDetailProduct[];
  orders: AdminShipmentDetailOrder[];
}

export type AdminOrderListItem = Pick<SerializedOrder, "id" | "status" | "createdAt"> & {
  userEmail: string | null;
  userCompanyName: string | null;
  shipmentName: string | null;
  itemCount: number;
  total: number;
};

export type EditableOrderItem = Pick<SerializedOrderItem, "id" | "productId" | "name" | "quantity" | "unitPrice" | "substituteProductId" | "substituteName" | "catalogProductId"> & {
  latinName?: string | null;
  categoryName?: string | null;
};

export type OrderItemWithMeta = SerializedOrderItem & {
  latinName?: string | null;
  categoryName?: string | null;
};

export type AdminOrderDetail = SerializedOrder & {
  user: { email: string; companyName: string | null } | null;
  shipment: { name: string; freightCost: number } | null;
  items: OrderItemWithMeta[];
  totals: OrderTotals;
};

export type ShipmentListItem = Pick<SerializedShipment, "id" | "name" | "deadline" | "shipmentDate" | "freightCost"> & {
  productCount: number;
};

export type ShipmentDetail = Pick<SerializedShipment, "id" | "name" | "deadline" | "shipmentDate" | "freightCost"> & {
  products: SerializedProduct[];
};

export type UserOrderListItem = Pick<SerializedOrder, "id" | "status" | "createdAt"> & {
  shipmentName: string | null;
  itemCount: number;
  total: number;
};

export type UserOrderDetail = SerializedOrder & {
  shipment: { name: string; freightCost: number } | null;
  items: OrderItemWithMeta[];
  totals: OrderTotals;
};

export type DoaItemWithUrl = SerializedDoaItem & {
  imageUrls: string[];
  orderItem: SerializedOrderItem;
};

export type DoaClaimDetail = SerializedDoaClaim & {
  items: DoaItemWithUrl[];
  order: {
    id: string;
    shipmentId: string;
    user: { email: string };
    shipment: { id: string; name: string };
    items: SerializedOrderItem[];
  };
};

export type DoaShipmentGroup = {
  shipment: { id: string; name: string };
  claims: DoaClaimDetail[];
  hasReport: boolean;
};

export type DoaReportDetail = SerializedDoaReport & {
  shipment: { id: string; name: string };
  downloadUrl: string | null;
};

export interface ParsedProduct {
  name: string;
  latinName?: string | null;
  price: number | null;
  size: string | null;
  qtyPerBox: number | null;
  availableQty: number | null;
  originalRow?: Record<string, unknown>;
  warnings: string[];
}

export interface ColumnMapping {
  name: number;
  latinName: number;
  price: number;
  size: number;
  qtyPerBox: number;
  stock: number;
}

export interface ParsedShipment {
  name: string | null;
  shipmentDate: string | null;
  deadline: string | null;
  freightCost: number | null;
  items: ParsedProduct[];
  warnings: string[];
  headers: string[];
  columnMappings: ColumnMapping;
  rawRows?: unknown[][];
}
