import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getAllCatalogProducts, createCatalogProduct } from "@/server/services/catalog.service";
import { getDownloadUrl } from "@/server/services/storage.service";
import { getDb } from "@/server/db/data-source";
import { CatalogProduct } from "@/server/entities/CatalogProduct";

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
      images: await Promise.all(
        (p.images || []).map(async (img) => ({
          id: img.id,
          imageKey: img.imageKey,
          imageUrl: await getDownloadUrl(img.imageKey),
          label: img.label,
          sortOrder: img.sortOrder,
        }))
      ),
      stockMode: p.stockMode,
      stockQty: p.stockQty,
      stockLevel: p.stockLevel,
      surcharge: Number(p.surcharge) || 0,
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
  const { name, latinName, price, type, categoryId, images, stockMode, stockQty, stockLevel, wysiwyg } = body;

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
      images: Array.isArray(images) ? images : [],
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

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { surcharge, categoryIds } = await request.json();
  if (surcharge === undefined) return NextResponse.json({ error: "Missing surcharge" }, { status: 400 });

  const db = await getDb();
  const repo = db.getRepository(CatalogProduct);
  const value = parseFloat(surcharge) || 0;

  if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
    await repo.createQueryBuilder()
      .update(CatalogProduct)
      .set({ surcharge: value })
      .where("active = true")
      .andWhere("\"categoryId\" IN (:...categoryIds)", { categoryIds })
      .execute();
  } else {
    await repo.update({ active: true }, { surcharge: value });
  }

  return NextResponse.json({ success: true });
}
