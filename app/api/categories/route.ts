import { NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getCategoryTree } from "@/server/services/category.service";

export async function GET() {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tree = await getCategoryTree();
  return NextResponse.json(tree);
}
