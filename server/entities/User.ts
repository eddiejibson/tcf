import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Order } from "./Order";
import { Shipment } from "./Shipment";
import { MagicLink } from "./MagicLink";
import { CreditTransaction } from "./CreditTransaction";
import { Company } from "./Company";

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
}

export enum CompanyRole {
  OWNER = "OWNER",
  MEMBER = "MEMBER",
}

@Entity("users")
export class User extends BaseEntityWithUpdate {
  @Column({ type: "varchar", unique: true })
  email: string;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: "varchar", nullable: true })
  companyName: string | null;

  @Column({ type: "uuid", nullable: true })
  companyId: string | null;

  @ManyToOne(() => Company, (company) => company.users, { nullable: true })
  @JoinColumn({ name: "companyId" })
  company: Relation<Company> | null;

  @Column({ type: "enum", enum: CompanyRole, nullable: true })
  companyRole: CompanyRole | null;

  @Column({ type: "jsonb", nullable: true })
  permissions: string[] | null;

  @Column({ type: "uuid", nullable: true })
  invitedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "invitedById" })
  invitedBy: Relation<User> | null;

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

export type UserType = Omit<User, "orders" | "createdShipments" | "magicLinks" | "creditTransactions" | "company" | "invitedBy">;
