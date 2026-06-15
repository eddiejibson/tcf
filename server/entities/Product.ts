import { Entity, Column, ManyToOne, JoinColumn, Relation, DeleteDateColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Shipment } from "./Shipment";

@Entity("products")
export class Product extends BaseEntityWithUpdate {
  @DeleteDateColumn({ type: "timestamp", nullable: true })
  deletedAt: Date | null;

  @Column({ type: "uuid" })
  shipmentId: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.products)
  @JoinColumn({ name: "shipmentId" })
  shipment: Relation<Shipment>;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", nullable: true })
  latinName: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "varchar", nullable: true })
  variant: string | null;

  @Column({ type: "varchar", nullable: true })
  size: string | null;

  @Column({ type: "int", nullable: true })
  qtyPerBox: number | null;

  @Column({ type: "int", nullable: true })
  availableQty: number | null;

  // Fractional-bag pack sizes parsed from the list, e.g. [{fraction:"1/6",headcount:100},
  // {fraction:"1/12",headcount:50}]. Drives bag-based ordering when the shipment has it enabled.
  @Column({ type: "jsonb", nullable: true })
  packOptions: { fraction: string; headcount: number }[] | null;

  // Section/genus heading the product was listed under, for grouping the catalogue.
  @Column({ type: "varchar", nullable: true })
  category: string | null;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  surcharge: number;

  @Column({ type: "boolean", default: false })
  featured: boolean;

  @Column({ type: "jsonb", nullable: true })
  originalRow: Record<string, unknown>;
}

export type ProductType = Omit<Product, "shipment">;
