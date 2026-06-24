import { Entity, Column, ManyToOne, JoinColumn, Relation, DeleteDateColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { Order } from "./Order";
import { Product } from "./Product";
import { CatalogProduct } from "./CatalogProduct";

@Entity("order_items")
export class OrderItem extends BaseEntity {
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items)
  @JoinColumn({ name: "orderId" })
  order: Relation<Order>;

  @Column({ type: "uuid", nullable: true })
  productId: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: "productId" })
  product: Relation<Product> | null;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "int" })
  quantity: number;

  // Fractional-bag ordering: the bag size (e.g. "1/12") and how many bags. `quantity` stays
  // the total headcount (bagCount × per-bag headcount) so all existing totals math is unchanged.
  @Column({ type: "varchar", nullable: true })
  packFraction: string | null;

  @Column({ type: "int", nullable: true })
  bagCount: number | null;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: "uuid", nullable: true })
  substituteProductId: string | null;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: "substituteProductId" })
  substituteProduct: Relation<Product> | null;

  @Column({ type: "varchar", nullable: true })
  substituteName: string | null;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  surcharge: number;

  @Column({ type: "uuid", nullable: true })
  catalogProductId: string | null;

  @ManyToOne(() => CatalogProduct, { nullable: true })
  @JoinColumn({ name: "catalogProductId" })
  catalogProduct: Relation<CatalogProduct> | null;

  @DeleteDateColumn({ type: "timestamp", nullable: true })
  deletedAt: Date | null;
}

export type OrderItemType = Omit<OrderItem, "order" | "product" | "substituteProduct" | "catalogProduct">;
