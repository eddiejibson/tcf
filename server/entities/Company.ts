import { Entity, Column, OneToMany, ManyToMany, JoinTable, Relation, DeleteDateColumn } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Address } from "./Address";
import { User } from "./User";
import { Tag } from "./Tag";

export enum TrafficLight {
  RED = "RED",
  AMBER = "AMBER",
  GREEN = "GREEN",
}

@Entity("companies")
export class Company extends BaseEntityWithUpdate {
  @DeleteDateColumn({ type: "timestamp", nullable: true })
  deletedAt: Date | null;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", nullable: true })
  companyNumber: string | null;

  @Column({ type: "varchar", nullable: true })
  phone: string | null;

  @Column({ type: "enum", enum: TrafficLight, default: TrafficLight.AMBER })
  trafficLight: TrafficLight;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  discount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  creditBalance: number;

  // Admin-only internal sales notes — never exposed to customer-facing endpoints
  @Column({ type: "text", nullable: true })
  salesNotes: string | null;

  @OneToMany(() => Address, (address) => address.company)
  addresses: Relation<Address[]>;

  @OneToMany(() => User, (user) => user.company)
  users: Relation<User[]>;

  @ManyToMany(() => Tag, (tag) => tag.companies)
  @JoinTable({
    name: "company_tags",
    joinColumn: { name: "companyId", referencedColumnName: "id" },
    inverseJoinColumn: { name: "tagId", referencedColumnName: "id" },
  })
  tags: Relation<Tag[]>;
}
