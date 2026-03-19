import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { User } from "./User";
import type { Shipment } from "./Shipment";
import type { OrderItem } from "./OrderItem";
import type { DoaClaim } from "./DoaClaim";

export enum OrderStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  AWAITING_FULFILLMENT = "AWAITING_FULFILLMENT",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
  AWAITING_PAYMENT = "AWAITING_PAYMENT",
  PAID = "PAID",
  EXPIRED = "EXPIRED",
}

export enum PaymentMethod {
  BANK_TRANSFER = "BANK_TRANSFER",
  CARD = "CARD",
  FINANCE = "FINANCE",
}

@Entity("orders")
export class Order extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne("users", (user: User) => user.orders)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "uuid" })
  shipmentId: string;

  @ManyToOne("shipments", (shipment: Shipment) => shipment.orders)
  @JoinColumn({ name: "shipmentId" })
  shipment: Shipment;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.DRAFT })
  status: OrderStatus;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ type: "boolean", default: false })
  includeShipping: boolean;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  freightCharge: number | null;

  @Column({ type: "text", nullable: true })
  adminNotes: string | null;

  @Column({ type: "enum", enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ type: "varchar", nullable: true })
  paymentReference: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  creditApplied: number;

  @Column({ type: "boolean", default: false })
  useCredit: boolean;

  @OneToMany("order_items", (item: OrderItem) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany("doa_claims", (claim: DoaClaim) => claim.order)
  doaClaims: DoaClaim[];
}

export type OrderType = Omit<Order, "user" | "shipment" | "items" | "doaClaims">;
