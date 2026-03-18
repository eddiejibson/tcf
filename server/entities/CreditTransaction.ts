import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import type { User } from "./User";
import type { Order } from "./Order";
import type { DoaClaim } from "./DoaClaim";

export enum CreditType {
  DOA_CREDIT = "DOA_CREDIT",
  MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT",
  CREDIT_APPLIED = "CREDIT_APPLIED",
  CREDIT_REFUND = "CREDIT_REFUND",
}

@Entity("credit_transactions")
export class CreditTransaction extends BaseEntity {
  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne("users", (user: User) => user.creditTransactions)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "enum", enum: CreditType })
  type: CreditType;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar" })
  description: string;

  @Column({ type: "uuid", nullable: true })
  orderId: string | null;

  @ManyToOne("orders", { nullable: true })
  @JoinColumn({ name: "orderId" })
  order: Order | null;

  @Column({ type: "uuid", nullable: true })
  doaClaimId: string | null;

  @ManyToOne("doa_claims", { nullable: true })
  @JoinColumn({ name: "doaClaimId" })
  doaClaim: DoaClaim | null;
}

export type CreditTransactionType = Omit<CreditTransaction, "user" | "order" | "doaClaim">;
