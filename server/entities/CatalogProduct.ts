import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Category } from "./Category";

export enum CatalogProductType {
  COLONY = "COLONY",
  FRAG = "FRAG",
}

export enum StockMode {
  EXACT = "EXACT",
  ROUGH = "ROUGH",
}

export enum StockLevel {
  LOW = "LOW",
  AVERAGE = "AVERAGE",
  HIGH = "HIGH",
  OUT_OF_STOCK = "OUT_OF_STOCK",
}

@Entity("catalog_products")
export class CatalogProduct extends BaseEntityWithUpdate {
  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "enum", enum: CatalogProductType })
  type: CatalogProductType;

  @Column({ type: "uuid" })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: "categoryId" })
  category: Relation<Category>;

  @Column({ type: "varchar", nullable: true })
  imageKey: string | null;

  @Column({ type: "enum", enum: StockMode })
  stockMode: StockMode;

  @Column({ type: "int", nullable: true })
  stockQty: number | null;

  @Column({ type: "enum", enum: StockLevel, nullable: true })
  stockLevel: StockLevel | null;

  @Column({ type: "boolean", default: true })
  active: boolean;

  @Column({ type: "boolean", default: false })
  wysiwyg: boolean;
}

export type CatalogProductRecord = Omit<CatalogProduct, "category">;
