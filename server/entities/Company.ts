import { Entity, Column, OneToMany, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Address } from "./Address";
import { User } from "./User";

export enum TrafficLight {
  RED = "RED",
  AMBER = "AMBER",
  GREEN = "GREEN",
}

@Entity("companies")
export class Company extends BaseEntityWithUpdate {
  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", nullable: true })
  companyNumber: string | null;

  @Column({ type: "enum", enum: TrafficLight, default: TrafficLight.AMBER })
  trafficLight: TrafficLight;

  @Column({ type: "decimal", precision: 5, scale: 2, default: 0 })
  discount: number;

  @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
  creditBalance: number;

  @OneToMany(() => Address, (address) => address.company)
  addresses: Relation<Address[]>;

  @OneToMany(() => User, (user) => user.company)
  users: Relation<User[]>;
}
