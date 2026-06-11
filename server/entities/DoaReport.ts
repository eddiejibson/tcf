import { Entity, Column, ManyToOne, JoinColumn, Relation, DeleteDateColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { Shipment } from "./Shipment";

@Entity("doa_reports")
export class DoaReport extends BaseEntity {
  @DeleteDateColumn({ type: "timestamp", nullable: true })
  deletedAt: Date | null;

  @Column({ type: "uuid" })
  shipmentId: string;

  @ManyToOne(() => Shipment)
  @JoinColumn({ name: "shipmentId" })
  shipment: Relation<Shipment>;

  @Column({ type: "text" })
  reportText: string;

  @Column({ type: "varchar", nullable: true })
  zipKey: string | null;
}

export type DoaReportType = Omit<DoaReport, "shipment">;
