import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { Shipment } from "./Shipment";

@Entity("products")
export class Product extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  shipmentId: string;

  @ManyToOne("Shipment", "products")
  @JoinColumn({ name: "shipmentId" })
  shipment: Shipment;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "int", default: 1 })
  qtyPerBox: number;

  @Column({ type: "jsonb", nullable: true })
  originalRow: Record<string, unknown>;
}

export type ProductType = Omit<Product, "shipment">;
