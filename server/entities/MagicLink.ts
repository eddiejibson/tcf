import { Entity, Column, ManyToOne, JoinColumn, Relation } from "typeorm";
import { BaseEntity } from "./BaseEntity";
import { User } from "./User";

@Entity("magic_links")
export class MagicLink extends BaseEntity {
  @Column({ type: "varchar", unique: true })
  token: string;

  @Column({ type: "uuid" })
  userId: string;

  @ManyToOne(() => User, (user) => user.magicLinks)
  @JoinColumn({ name: "userId" })
  user: Relation<User>;

  @Column({ type: "timestamp" })
  expiresAt: Date;

  @Column({ type: "timestamp", nullable: true })
  usedAt: Date | null;
}
