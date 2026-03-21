export enum Permission {
  CREATE_ORDER = "create_order",
  CREATE_CATALOG_ORDER = "create_catalog_order",
  VIEW_ORDERS = "view_orders",
  VIEW_SHIPMENTS = "view_shipments",
  VIEW_PAYMENTS = "view_payments",
  MANAGE_PAYMENTS = "manage_payments",
  VIEW_DOA = "view_doa",
  CREATE_DOA = "create_doa",
}

export const ALL_PERMISSIONS = Object.values(Permission);

export const PERMISSION_LABELS: Record<Permission, { label: string; description: string }> = {
  [Permission.CREATE_ORDER]: { label: "Create Shipment Orders", description: "Create orders from available shipments" },
  [Permission.CREATE_CATALOG_ORDER]: { label: "Create Catalog Orders", description: "Create orders from the stock catalog" },
  [Permission.VIEW_ORDERS]: { label: "View All Orders", description: "View all company orders" },
  [Permission.VIEW_SHIPMENTS]: { label: "View Shipments", description: "Browse available shipments" },
  [Permission.VIEW_PAYMENTS]: { label: "View Payments", description: "View payment details and invoices" },
  [Permission.MANAGE_PAYMENTS]: { label: "Manage Payments", description: "Choose payment methods and apply credit" },
  [Permission.VIEW_DOA]: { label: "View DOA Claims", description: "View dead-on-arrival claims" },
  [Permission.CREATE_DOA]: { label: "Submit DOA Claims", description: "Submit new DOA claims" },
};
