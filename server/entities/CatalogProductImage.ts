import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { CatalogProduct } from "./CatalogProduct";

@Entity("catalog_product_images")
export class CatalogProductImage extends BaseEntity {
  @Column({ type: "uuid" })
  catalogProductId: string;

  @ManyToOne(() => CatalogProduct, (p) => p.images, { onDelete: "CASCADE" })
  @JoinColumn({ name: "catalogProductId" })
  catalogProduct: Relation<CatalogProduct>;

  @Column({ type: "varchar" })
  imageKey: string;

  @Column({ type: "varchar", nullable: true })
  label: string | null;

  @Column({ type: "int", default: 0 })
  sortOrder: number;
}
