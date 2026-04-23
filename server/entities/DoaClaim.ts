import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Order } from "./Order";
import { DoaPhotoGroup } from "./DoaPhotoGroup";

export enum DoaClaimStatus {
  PENDING = "PENDING",
  REVIEWED = "REVIEWED",
  REPORTED = "REPORTED",
}

@Entity("doa_claims")
export class DoaClaim extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.doaClaims)
  @JoinColumn({ name: "orderId" })
  order: Relation<Order>;

  @Column({ type: "enum", enum: DoaClaimStatus, default: DoaClaimStatus.PENDING })
  status: DoaClaimStatus;

  @OneToMany(() => DoaPhotoGroup, (group) => group.claim)
  photoGroups: Relation<DoaPhotoGroup[]>;
}

export type DoaClaimType = Omit<DoaClaim, "order" | "photoGroups">;
