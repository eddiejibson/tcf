import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { Product } from "@/server/entities/Product";
import { isUuid } from "@/server/utils";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { productId, featured } = await request.json();
  if (!productId || typeof featured !== "boolean") {
    return NextResponse.json({ error: "productId and featured required" }, { status: 400 });
  }

  const db = await getDb();
  const product = await db.getRepository(Product).findOneBy({ id: productId, shipmentId: id });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  await db.getRepository(Product).update(productId, { featured });

  return NextResponse.json({ id: productId, featured });
}
