import { Entity, Column, OneToMany } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import type { Order } from "./Order";
import type { Shipment } from "./Shipment";
import type { MagicLink } from "./MagicLink";

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

  @OneToMany("Order", "user")
  orders: Order[];

  @OneToMany("Shipment", "createdBy")
  createdShipments: Shipment[];

  @OneToMany("MagicLink", "user")
  magicLinks: MagicLink[];
}

export type UserType = Omit<User, "orders" | "createdShipments" | "magicLinks">;
