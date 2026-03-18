import { Entity, Column, ManyToOne, JoinColumn } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import type { User } from "./User";

@Entity("magic_links")
export class MagicLink extends BaseEntity {
  @Column({ type: "varchar", unique: true })
  token: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne("users", (user: User) => user.magicLinks)
  @JoinColumn({ name: "userId" })
  user: User;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @Column({ type: "timestamp", nullable: true })
  usedAt: Date | null;
}
