import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { User } from "./User";
import { Company } from "./Company";
import { Order } from "./Order";
import { DoaClaim } from "./DoaClaim";

export enum CreditType {
  DOA_CREDIT = "DOA_CREDIT",
  MANUAL_ADJUSTMENT = "MANUAL_ADJUSTMENT",
  CREDIT_APPLIED = "CREDIT_APPLIED",
  CREDIT_REFUND = "CREDIT_REFUND",
}

@Entity("credit_transactions")
export class CreditTransaction extends BaseEntity {
  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.creditTransactions, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: Relation<User> | null;

  @Column({ type: "uuid" })
  companyId: string;

  @ManyToOne(() => Company, { nullable: false })
  @JoinColumn({ name: "companyId" })
  company: Relation<Company>;

  @Column({ type: "enum", enum: CreditType })
  type: CreditType;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  amount: number;

  @Column({ type: "varchar" })
  description: string;

  @Column({ type: "uuid", nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: "orderId" })
  order: Relation<Order> | null;

  @Column({ type: "uuid", nullable: true })
  doaClaimId: string | null;

  @ManyToOne(() => DoaClaim, { nullable: true })
  @JoinColumn({ name: "doaClaimId" })
  doaClaim: Relation<DoaClaim> | null;
}

export type CreditTransactionType = Omit<CreditTransaction, "user" | "order" | "doaClaim">;
