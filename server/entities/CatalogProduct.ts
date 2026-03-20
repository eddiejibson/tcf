import { Entity, Column, ManyToOne, JoinColumn, Relation, OneToMany } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Category } from "./Category";
import { CatalogProductImage } from "./CatalogProductImage";

export enum CatalogProductType {
  COLONY = "COLONY",
  FRAG = "FRAG",
  PER_HEAD = "PER_HEAD",
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
  PRE_ORDER = "PRE_ORDER",
}

@Entity("catalog_products")
export class CatalogProduct extends BaseEntityWithUpdate {
  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", nullable: true })
  latinName: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  price: number;

  @Column({ type: "enum", enum: CatalogProductType })
  type: CatalogProductType;

  @Column({ type: "uuid" })
  categoryId: string;

  @ManyToOne(() => Category)
  @JoinColumn({ name: "categoryId" })
  category: Relation<Category>;

  @OneToMany(() => CatalogProductImage, (img) => img.catalogProduct, { cascade: true })
  images: Relation<CatalogProductImage[]>;

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

export type CatalogProductRecord = Omit<CatalogProduct, "category" | "images">;
