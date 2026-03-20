import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getAllCatalogProducts, createCatalogProduct } from "@/server/services/catalog.service";
import { getDownloadUrl } from "@/server/services/storage.service";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || undefined;
  const search = searchParams.get("search") || undefined;
  const activeParam = searchParams.get("active");
  const activeOnly = activeParam !== "all";

  const products = await getAllCatalogProducts({ categoryId, search, activeOnly });

  const result = await Promise.all(
    products.map(async (p) => ({
      id: p.id,
      name: p.name,
      latinName: p.latinName,
      price: p.price,
      type: p.type,
      categoryId: p.categoryId,
      categoryName: p.category?.name || "",
      imageKey: p.imageKey,
      imageUrl: p.imageKey ? await getDownloadUrl(p.imageKey) : null,
      stockMode: p.stockMode,
      stockQty: p.stockQty,
      stockLevel: p.stockLevel,
      active: p.active,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }))
  );

  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { name, latinName, price, type, categoryId, imageKey, stockMode, stockQty, stockLevel, wysiwyg } = body;

  if (!name || price == null || !type || !categoryId || !stockMode) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const product = await createCatalogProduct({
      name,
      latinName: latinName || null,
      price: parseFloat(price),
      type,
      categoryId,
      imageKey: imageKey || null,
      stockMode,
      stockQty: stockQty != null ? parseInt(stockQty) : null,
      stockLevel: stockLevel || null,
      wysiwyg: wysiwyg ?? false,
    });
    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Internal error" }, { status: 400 });
  }
}
