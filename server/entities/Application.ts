import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntityWithUpdate } from "./BaseEntity";
import { User } from "./User";

export enum ApplicationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

@Entity("applications")
export class Application extends BaseEntityWithUpdate {
  @Column({ type: "varchar" })
  companyName: string;

  @Column({ type: "varchar", nullable: true })
  companyNumber: string | null;

  @Column({ type: "varchar" })
  contactName: string;

  @Column({ type: "varchar" })
  contactEmail: string;

  @Column({ type: "varchar", nullable: true })
  phone: string | null;

  @Column({ type: "varchar", nullable: true })
  accountsName: string | null;

  @Column({ type: "varchar", nullable: true })
  accountsEmail: string | null;

  @Column({ type: "varchar", nullable: true })
  licenseFileKey: string | null;

  @Column({ type: "jsonb", default: [] })
  shopPhotoKeys: string[];

  @Column({ type: "text", nullable: true })
  additionalInfo: string | null;

  @Column({ type: "jsonb", nullable: true })
  billingAddress: {
    line1: string;
    line2?: string;
    city: string;
    county?: string;
    postcode: string;
    country: string;
  } | null;

  @Column({ type: "jsonb", nullable: true })
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    county?: string;
    postcode: string;
    country: string;
  } | null;

  @Column({ type: "enum", enum: ApplicationStatus, default: ApplicationStatus.PENDING })
  status: ApplicationStatus;

  @Column({ type: "text", nullable: true })
  rejectionReason: string | null;

  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "userId" })
  user: Relation<User> | null;
}

export type ApplicationType = Omit<Application, "user">;
