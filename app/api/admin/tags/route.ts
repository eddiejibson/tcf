import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Tag } from "@/server/entities/Tag";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const db = await getDb();
  const tags = await db.getRepository(Tag).find({ order: { name: "ASC" } });
  return NextResponse.json(tags.map((t) => ({ id: t.id, name: t.name })));
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Tag name is required" }, { status: 400 });

  const db = await getDb();
  const repo = db.getRepository(Tag);

  // Create-or-return: case-insensitive match keeps tags unique and lets the UI "Add new tag" be naive
  const findExisting = () =>
    repo.createQueryBuilder("tag").where("LOWER(tag.name) = LOWER(:name)", { name }).getOne();

  const existing = await findExisting();
  if (existing) return NextResponse.json({ id: existing.id, name: existing.name });

  try {
    const tag = await repo.save({ name });
    return NextResponse.json({ id: tag.id, name: tag.name }, { status: 201 });
  } catch (e) {
    // Lost a race against the unique index — return the tag the other request created
    const raced = await findExisting();
    if (raced) return NextResponse.json({ id: raced.id, name: raced.name });
    throw e;
  }
}
