import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { Order } from "./Order";
import type { DoaItem } from "./DoaItem";

export enum DoaClaimStatus {
  PENDING = "PENDING",
  REVIEWED = "REVIEWED",
  REPORTED = "REPORTED",
}

@Entity("doa_claims")
export class DoaClaim extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne("Order", (order: Order) => order.doaClaims)
  @JoinColumn({ name: "orderId" })
  order: Order;

  @Column({ type: "enum", enum: DoaClaimStatus, default: DoaClaimStatus.PENDING })
  status: DoaClaimStatus;

  @OneToMany("DoaItem", (item: DoaItem) => item.claim, { cascade: true })
  items: DoaItem[];
}

export type DoaClaimType = Omit<DoaClaim, "order" | "items">;
