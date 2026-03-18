import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { Shipment } from "./Shipment";

@Entity("products")
export class Product extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  shipmentId: string;

  @ManyToOne("shipments", (shipment: Shipment) => shipment.products)
  @JoinColumn({ name: "shipmentId" })
  shipment: Shipment;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "varchar", nullable: true })
  size: string | null;

  @Column({ type: "int", default: 1 })
  qtyPerBox: number;

  @Column({ type: "int", nullable: true })
  availableQty: number | null;

  @Column({ type: "jsonb", nullable: true })
  originalRow: Record<string, unknown>;
}

export type ProductType = Omit<Product, "shipment">;
