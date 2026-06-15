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
