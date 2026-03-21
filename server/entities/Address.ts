import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { Company } from "./Company";

export enum AddressType {
  BILLING = "BILLING",
  SHIPPING = "SHIPPING",
}

@Entity("addresses")
export class Address extends BaseEntityWithUpdate {
  @Column({ type: "uuid" })
  companyId: string;

  @ManyToOne(() => Company, (company) => company.addresses)
  @JoinColumn({ name: "companyId" })
  company: Relation<Company>;

  @Column({ type: "enum", enum: AddressType })
  type: AddressType;

  @Column({ type: "varchar" })
  line1: string;

  @Column({ type: "varchar", nullable: true })
  line2: string | null;

  @Column({ type: "varchar" })
  city: string;

  @Column({ type: "varchar", nullable: true })
  county: string | null;

  @Column({ type: "varchar" })
  postcode: string;

  @Column({ type: "varchar", default: "United Kingdom" })
  country: string;
}
