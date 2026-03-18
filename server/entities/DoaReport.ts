import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import type { Shipment } from "./Shipment";

@Entity("doa_reports")
export class DoaReport extends BaseEntity {
  @Column({ type: "uuid" })
  shipmentId: string;

  @ManyToOne("shipments")
  @JoinColumn({ name: "shipmentId" })
  shipment: Shipment;

  @Column({ type: "text" })
  reportText: string;

  @Column({ type: "varchar", nullable: true })
  zipKey: string | null;
}

export type DoaReportType = Omit<DoaReport, "shipment">;
