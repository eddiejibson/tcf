import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Relation, DeleteDateColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { User } from "./User";
import { Product } from "./Product";
import { Order } from "./Order";

export enum ShipmentStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

@Entity("shipments")
export class Shipment extends BaseEntityWithUpdate {
  @DeleteDateColumn({ type: "timestamp", nullable: true })
  deletedAt: Date | null;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "timestamp" })
  deadline: Date;

  @Column({ type: "timestamp" })
  shipmentDate: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  freightCost: number;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  margin: number;

  @Column({ type: "enum", enum: ShipmentStatus, default: ShipmentStatus.DRAFT })
  status: ShipmentStatus;

  @Column({ type: "varchar", nullable: true })
  sourceFilename: string;

  // Public, customer-facing notes shown at the top of the shipment (pricing notes, delivery
  // info, deadlines etc.). Admin-editable on create/edit. NOT the same as per-product supplier
  // notes parsed from Excel, which stay admin-only.
  @Column({ type: "text", nullable: true })
  notes: string | null;

  // Free-text currency label for how ITEM prices display on this shipment (e.g. "£", "$", "GBP",
  // "USD"). Null = fall back to "£" (unchanged default). Display-only; amounts stay raw numbers.
  @Column({ type: "varchar", nullable: true })
  currency: string | null;

  // Free-text currency label for FREIGHT/logistics (freight per box, delivery, shipping). Null =
  // fall back to the item `currency`. When it differs from `currency`, order totals split into
  // an items block (item currency) and a logistics block (freight currency) with a nominal total.
  @Column({ type: "varchar", nullable: true })
  freightCurrency: string | null;

  // When true, customers order this shipment by fractional bags (1/12, 1/6, …) rather than
  // by raw headcount. Defaulted on at import when products carry packOptions; admin can toggle.
  @Column({ type: "boolean", default: false })
  fractionalBagsEnabled: boolean;

  // Delivery methods this shipment offers + their rates (per box / per mile / flat). Admin sets
  // these on create/edit; the per-order packing review uses them. Null = use system defaults.
  @Column({ type: "jsonb", nullable: true })
  deliveryOptions: { id: string; label: string; basis: string; rate: number; enabled: boolean }[] | null;

  @Column({ type: "uuid" })
  createdById: string;

  @ManyToOne(() => User, (user) => user.createdShipments)
  @JoinColumn({ name: "createdById" })
  createdBy: Relation<User>;

  @OneToMany(() => Product, (product) => product.shipment, { cascade: true })
  products: Relation<Product[]>;

  @OneToMany(() => Order, (order) => order.shipment)
  orders: Relation<Order[]>;
}

export type ShipmentType = Omit<Shipment, "createdBy" | "products" | "orders">;
