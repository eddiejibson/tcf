import { Entity, Column, Index } from "typeorm";
import { BaseEntity } from "./BaseEntity";

// Append-only record of every significant action: who did it (actor id + email),
// what happened (action like "user.delete", "order.accept"), to which record
// (entityType + entityId), and any context (meta). Never updated or deleted.
@Entity("audit_logs")
export class AuditLog extends BaseEntity {
  @Index()
  @Column({ type: "varchar" })
  action: string;

  @Index()
  @Column({ type: "varchar" })
  entityType: string;

  @Column({ type: "uuid", nullable: true })
  entityId: string | null;

  @Index()
  @Column({ type: "uuid", nullable: true })
  actorId: string | null;

  @Column({ type: "varchar", nullable: true })
  actorEmail: string | null;

  @Column({ type: "jsonb", nullable: true })
  meta: Record<string, unknown> | null;
}
