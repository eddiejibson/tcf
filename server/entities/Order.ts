import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { User } from "./User";
import { Shipment } from "./Shipment";
import { OrderItem } from "./OrderItem";
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

  // Captured at packing-list review time. Used by the order breakdown to show
  // "N boxes × £X" — the actual boxes shipped, not a heuristic from item qtyPerBox.
  @Column({ type: "int", nullable: true })
  boxCount: number | null;

  @Column({ type: "decimal", precision: 10, scale: 2, nullable: true })
  freightPerBox: number | null;

  @Column({ type: "text", nullable: true })
  adminNotes: string | null;

  @Column({ type: "enum", enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ type: "varchar", nullable: true })
  paymentReference: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  creditApplied: number;

  // Discount applied to this specific order (percentage 0-100). Populated when admin
  // enables "Apply customer discount" in flows like the packing-list review. Lets the order
  // detail view and invoice show the discount as a visible line instead of silently baking
  // it into unit prices.
  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ type: "boolean", default: false })
  useCredit: boolean;

  @Column({ type: "int", nullable: true })
  maxBoxes: number | null;

  @Column({ type: "int", nullable: true })
  minBoxes: number | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: Relation<OrderItem[]>;

  // Payments loaded manually via getOrderById to avoid circular dependency
  payments?: { id: string; orderId: string; method: string; amount: number; reference: string | null; status: string; createdAt: Date }[];

  @OneToMany(() => DoaClaim, (claim) => claim.order)
  doaClaims: Relation<DoaClaim[]>;
}

export type OrderType = Omit<Order, "user" | "shipment" | "items" | "doaClaims">;
