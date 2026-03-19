import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { DoaClaim } from "./DoaClaim";
import { OrderItem } from "./OrderItem";

@Entity("doa_items")
export class DoaItem extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  claimId: string;

  @ManyToOne(() => DoaClaim, (claim) => claim.items)
  @JoinColumn({ name: "claimId" })
  claim: Relation<DoaClaim>;

  @Column({ type: "uuid" })
  orderItemId: string;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: "orderItemId" })
  orderItem: Relation<OrderItem>;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "simple-array" })
  imageKeys: string[];

  @Column({ type: "boolean", default: false })
  approved: boolean;
}

export type DoaItemType = Omit<DoaItem, "claim" | "orderItem">;
