import { Entity, Column, OneToMany } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { Order } from "./Order";
import type { Shipment } from "./Shipment";
import type { MagicLink } from "./MagicLink";
import type { CreditTransaction } from "./CreditTransaction";

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

  @OneToMany("Order", (order: Order) => order.user)
  orders: Order[];

  @OneToMany("CreditTransaction", (ct: CreditTransaction) => ct.user)
  creditTransactions: CreditTransaction[];

  @OneToMany("Shipment", (s: Shipment) => s.createdBy)
  createdShipments: Shipment[];

  @OneToMany("MagicLink", (ml: MagicLink) => ml.user)
  magicLinks: MagicLink[];
}

export type UserType = Omit<User, "orders" | "createdShipments" | "magicLinks" | "creditTransactions">;
