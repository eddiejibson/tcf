import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { User } from "./User";
import { Shipment } from "./Shipment";
import { OrderItem } from "./OrderItem";
import { OrderPayment } from "./OrderPayment";
import { DoaClaim } from "./DoaClaim";

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
  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.orders, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: Relation<User> | null;

  @Column({ type: "uuid", nullable: true })
  shipmentId: string | null;

  @ManyToOne(() => Shipment, (shipment) => shipment.orders, { nullable: true })
  @JoinColumn({ name: "shipmentId" })
  shipment: Relation<Shipment> | null;

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

  @Column({ type: "int", nullable: true })
  maxBoxes: number | null;

  @Column({ type: "int", nullable: true })
  minBoxes: number | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: Relation<OrderItem[]>;

  @OneToMany(() => OrderPayment, (p) => p.order, { cascade: true })
  payments: Relation<OrderPayment[]>;

  @OneToMany(() => DoaClaim, (claim) => claim.order)
  doaClaims: Relation<DoaClaim[]>;
}

export type OrderType = Omit<Order, "user" | "shipment" | "items" | "payments" | "doaClaims">;
