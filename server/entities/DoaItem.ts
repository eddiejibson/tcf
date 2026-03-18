import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { DoaClaim } from "./DoaClaim";
import type { OrderItem } from "./OrderItem";

@Entity("doa_items")
export class DoaItem extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  claimId: string;

  @ManyToOne("DoaClaim", (claim: DoaClaim) => claim.items)
  @JoinColumn({ name: "claimId" })
  claim: DoaClaim;

  @Column({ type: "uuid" })
  orderItemId: string;

  @ManyToOne("OrderItem")
  @JoinColumn({ name: "orderItemId" })
  orderItem: OrderItem;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "simple-array" })
  imageKeys: string[];

  @Column({ type: "boolean", default: false })
  approved: boolean;
}

export type DoaItemType = Omit<DoaItem, "claim" | "orderItem">;
