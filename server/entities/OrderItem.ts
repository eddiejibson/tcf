import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import type { Order } from "./Order";
import type { Product } from "./Product";

@Entity("order_items")
export class OrderItem extends BaseEntity {
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne("orders", (order: Order) => order.items)
  @JoinColumn({ name: "orderId" })
  order: Order;

  @Column({ type: "uuid", nullable: true })
  productId: string | null;

  @ManyToOne("products", { nullable: true })
  @JoinColumn({ name: "productId" })
  product: Product | null;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: "uuid", nullable: true })
  substituteProductId: string | null;

  @ManyToOne("products", { nullable: true })
  @JoinColumn({ name: "substituteProductId" })
  substituteProduct: Product | null;

  @Column({ type: "varchar", nullable: true })
  substituteName: string | null;
}

export type OrderItemType = Omit<OrderItem, "order" | "product" | "substituteProduct">;
