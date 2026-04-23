import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { DoaClaim } from "./DoaClaim";
import { DoaItem } from "./DoaItem";

@Entity("doa_photo_groups")
export class DoaPhotoGroup extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  claimId: string;

  @ManyToOne(() => DoaClaim, (claim) => claim.photoGroups)
  @JoinColumn({ name: "claimId" })
  claim: Relation<DoaClaim>;

  @Column({ type: "simple-array" })
  imageKeys: string[];

  @OneToMany(() => DoaItem, (item) => item.photoGroup, { cascade: true })
  items: Relation<DoaItem[]>;
}

export type DoaPhotoGroupType = Omit<DoaPhotoGroup, "claim" | "items">;
