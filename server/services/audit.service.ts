import { getDb } from "../db/data-source";
import { AuditLog } from "../entities/AuditLog";
import { log } from "../logger";

export interface AuditActor {
  userId?: string | null;
  email?: string | null;
}

/**
 * Writes an audit log entry. Never throws — an audit failure must not break
 * the action it records (it is logged instead). Skipped in NODE_ENV=test.
 *
 * Action naming: "<entity>.<verb>", e.g. "user.delete", "order.accept",
 * "auth.login". Pass the actor from requireAuth/requireAdmin (JwtPayload),
 * or null for unauthenticated/system actions (e.g. webhooks).
 */
export async function audit(
  actor: AuditActor | null,
  action: string,
  entityType: string,
  entityId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  if (process.env.NODE_ENV === "test") return;
  try {
    const db = await getDb();
    const repo = db.getRepository(AuditLog);
    const entry = repo.create({
      action,
      entityType,
      entityId,
      actorId: actor?.userId ?? null,
      actorEmail: actor?.email ?? null,
      meta: meta ?? null,
    });
    await repo.save(entry);
  } catch (err) {
    log.error("Audit write failed", err, { meta: { action, entityType, entityId } });
  }
}
