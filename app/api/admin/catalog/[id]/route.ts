import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getCatalogProductById, updateCatalogProduct, softDeleteCatalogProduct } from "@/server/services/catalog.service";
import { getDownloadUrl } from "@/server/services/storage.service";
import { isUuid } from "@/server/utils";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const product = await getCatalogProductById(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    ...product,
    categoryName: product.category?.name || "",
    images: await Promise.all(
      (product.images || []).map(async (img) => ({
        id: img.id,
        imageKey: img.imageKey,
        imageUrl: await getDownloadUrl(img.imageKey),
        label: img.label,
        sortOrder: img.sortOrder,
      }))
    ),
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.latinName !== undefined) data.latinName = body.latinName || null;
  if (body.price !== undefined) data.price = parseFloat(body.price);
  if (body.type !== undefined) data.type = body.type;
  if (body.categoryId !== undefined) data.categoryId = body.categoryId;
  if (body.images !== undefined) data.images = body.images;
  if (body.stockMode !== undefined) data.stockMode = body.stockMode;
  if (body.stockQty !== undefined) data.stockQty = body.stockQty != null ? parseInt(body.stockQty) : null;
  if (body.stockLevel !== undefined) data.stockLevel = body.stockLevel;
  if (body.active !== undefined) data.active = body.active;
  if (body.wysiwyg !== undefined) data.wysiwyg = body.wysiwyg;
  if (body.surcharge !== undefined) data.surcharge = parseFloat(body.surcharge) || 0;

  try {
    const product = await updateCatalogProduct(id, data);
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(product);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const product = await softDeleteCatalogProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
