import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import type { Order } from "./Order";
import type { Product } from "./Product";

@Entity("order_items")
export class OrderItem extends BaseEntity {
  @Column({ type: "uuid" })
  orderId: string;

  @ManyToOne("Order", "items")
  @JoinColumn({ name: "orderId" })
  order: Order;

  @Column({ type: "uuid", nullable: true })
  productId: string | null;

  @ManyToOne("Product", { nullable: true })
  @JoinColumn({ name: "productId" })
  product: Product | null;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "decimal", precision: 10, scale: 2 })
  unitPrice: number;
}

export type OrderItemType = Omit<OrderItem, "order" | "product">;
