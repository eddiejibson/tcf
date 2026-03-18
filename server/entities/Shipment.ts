import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { User } from "./User";
import type { Product } from "./Product";
import type { Order } from "./Order";

export enum ShipmentStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

@Entity("shipments")
export class Shipment extends BaseEntityWithUpdate {
  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "timestamp" })
  deadline: Date;

  @Column({ type: "timestamp" })
  shipmentDate: Date;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  freightCost: number;

  @Column({ type: "enum", enum: ShipmentStatus, default: ShipmentStatus.DRAFT })
  status: ShipmentStatus;

  @Column({ type: "varchar", nullable: true })
  sourceFilename: string;

  @Column({ type: "uuid" })
  createdById: string;

  @ManyToOne("User", "createdShipments")
  @JoinColumn({ name: "createdById" })
  createdBy: User;

  @OneToMany("Product", "shipment", { cascade: true })
  products: Product[];

  @OneToMany("Order", "shipment")
  orders: Order[];
}

export type ShipmentType = Omit<Shipment, "createdBy" | "products" | "orders">;
