import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { audit } from "@/server/services/audit.service";
import { updateCategory, deleteCategory } from "@/server/services/category.service";
import { isUuid } from "@/server/utils";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.parentId !== undefined) data.parentId = body.parentId;
  if (body.sortOrder !== undefined) data.sortOrder = body.sortOrder;

  const category = await updateCategory(id, data);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await audit(admin, "category.update", "category", id, { name: category.name, changes: data });

  return NextResponse.json(category);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteCategory(id);
    await audit(admin, "category.delete", "category", id);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 400 });
  }
}
