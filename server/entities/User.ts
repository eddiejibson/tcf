import { Entity, Column, OneToMany, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Order } from "./Order";
import { Shipment } from "./Shipment";
import { MagicLink } from "./MagicLink";
import { CreditTransaction } from "./CreditTransaction";

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

@Entity("users")
export class User extends BaseEntityWithUpdate {
  @Column({ type: "varchar", unique: true })
  email: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: "varchar", nullable: true })
  companyName: string | null;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  creditBalance: number;

  @Column({ type: "timestamp", nullable: true })
  lastLogin: Date | null;

  @OneToMany(() => Order, (order) => order.user)
  orders: Relation<Order[]>;

  @OneToMany(() => CreditTransaction, (ct) => ct.user)
  creditTransactions: Relation<CreditTransaction[]>;

  @OneToMany(() => Shipment, (s) => s.createdBy)
  createdShipments: Relation<Shipment[]>;

  @OneToMany(() => MagicLink, (ml) => ml.user)
  magicLinks: Relation<MagicLink[]>;
}

export type UserType = Omit<User, "orders" | "createdShipments" | "magicLinks" | "creditTransactions">;
