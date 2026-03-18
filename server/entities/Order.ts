import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { User } from "./User";
import type { Shipment } from "./Shipment";
import type { OrderItem } from "./OrderItem";

export enum OrderStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

@Entity("orders")
export class Order extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne("User", "orders")
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  shipmentId: string;

  @ManyToOne("Shipment", "orders")
  @JoinColumn({ name: "shipmentId" })
  shipment: Shipment;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "boolean", default: false })
  includeShipping: boolean;

  @OneToMany("OrderItem", "order", { cascade: true })
  items: OrderItem[];
}

export type OrderType = Omit<Order, "user" | "shipment" | "items">;
