import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { AuditLog } from "@/server/entities/AuditLog";
import { isUuid } from "@/server/utils";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
  const actorId = searchParams.get("actorId");
  const action = searchParams.get("action");
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = await getDb();
  const qb = db.getRepository(AuditLog).createQueryBuilder("a").orderBy("a.createdAt", "DESC");

  if (actorId && isUuid(actorId)) qb.andWhere("a.actorId = :actorId", { actorId });
  if (action) qb.andWhere("a.action = :action", { action });
  if (entityType) qb.andWhere("a.entityType = :entityType", { entityType });
  if (entityId && isUuid(entityId)) qb.andWhere("a.entityId = :entityId", { entityId });
  if (from) qb.andWhere("a.createdAt >= :from", { from: new Date(from) });
  if (to) qb.andWhere("a.createdAt <= :to", { to: new Date(to) });

  const [rows, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

  // Facets for the filter dropdowns
  const repo = db.getRepository(AuditLog);
  const [actions, entityTypes, actors] = await Promise.all([
    repo.createQueryBuilder("a").select("DISTINCT a.action", "action").orderBy("action").getRawMany(),
    repo.createQueryBuilder("a").select("DISTINCT a.entityType", "entityType").orderBy("entityType").getRawMany(),
    repo
      .createQueryBuilder("a")
      .select(['a.actorId AS "actorId"', 'a.actorEmail AS "actorEmail"'])
      .where("a.actorId IS NOT NULL")
      .groupBy("a.actorId")
      .addGroupBy("a.actorEmail")
      .orderBy('"actorEmail"')
      .getRawMany(),
  ]);

  return NextResponse.json({
    logs: rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorId: r.actorId,
      actorEmail: r.actorEmail,
      meta: r.meta,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
    facets: {
      actions: actions.map((a) => a.action),
      entityTypes: entityTypes.map((e) => e.entityType),
      actors: actors,
    },
  });
}
