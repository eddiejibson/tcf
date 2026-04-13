import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";

export enum OrderPaymentStatus {
  PENDING = "PENDING",
  AWAITING_CONFIRMATION = "AWAITING_CONFIRMATION",
  COMPLETED = "COMPLETED",
}

export enum OrderPaymentMethod {
  BANK_TRANSFER = "BANK_TRANSFER",
  CARD = "CARD",
  FINANCE = "FINANCE",
}

@Entity("order_payments")
export class OrderPayment extends BaseEntity {
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne("Order", "payments")
  @JoinColumn({ name: "orderId" })
  order: unknown;

  @Column({ type: "enum", enum: OrderPaymentMethod, enumName: "orders_paymentmethod_enum" })
  method: OrderPaymentMethod;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar", nullable: true })
  reference: string | null;

  @Column({ type: "enum", enum: OrderPaymentStatus, default: OrderPaymentStatus.PENDING })
  status: OrderPaymentStatus;
}

export type OrderPaymentType = Omit<OrderPayment, "order">;
