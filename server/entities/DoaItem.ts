import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { DoaPhotoGroup } from "./DoaPhotoGroup";
import { OrderItem } from "./OrderItem";

@Entity("doa_items")
export class DoaItem extends BaseEntityWithUpdate {
  // Kept as a plain column (no relation decorator) so queries can filter by
  // claim without forming a metadata cycle DoaClaim<->DoaItem<->DoaPhotoGroup.
  // The "real" path from item to claim is via photoGroup.
  @Column({ type: "uuid" })
  claimId: string;

  @Column({ type: "uuid" })
  photoGroupId: string;

  @ManyToOne(() => DoaPhotoGroup, (group) => group.items)
  @JoinColumn({ name: "photoGroupId" })
  photoGroup: Relation<DoaPhotoGroup>;

  @Column({ type: "uuid" })
  orderItemId: string;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: "orderItemId" })
  orderItem: Relation<OrderItem>;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "boolean", default: false })
  approved: boolean;

  @Column({ type: "boolean", default: false })
  denied: boolean;
}

export type DoaItemType = Omit<DoaItem, "orderItem" | "photoGroup">;
