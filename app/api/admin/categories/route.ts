import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getCategoryTree, createCategory } from "@/server/services/category.service";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tree = await getCategoryTree();
  return NextResponse.json(tree);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const category = await createCategory({
    name: body.name,
    parentId: body.parentId || null,
    sortOrder: body.sortOrder ?? 0,
  });

  return NextResponse.json(category, { status: 201 });
}
