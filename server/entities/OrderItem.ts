import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
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
}

export type OrderItemType = Omit<OrderItem, "order" | "product" | "substituteProduct" | "catalogProduct">;
