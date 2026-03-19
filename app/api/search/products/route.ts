import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/middleware/auth";
import { getAllCatalogProducts } from "@/server/services/catalog.service";
import { getDownloadUrl } from "@/server/services/storage.service";

export async function GET(request: NextRequest) {
  const user = await requireAuth();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;

  const products = await getAllCatalogProducts({
    search: q,
    categoryId,
    activeOnly: true,
  });

  const result = await Promise.all(
    products.map(async (p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      type: p.type,
      categoryId: p.categoryId,
      categoryName: p.category?.name || "",
      imageUrl: p.imageKey ? await getDownloadUrl(p.imageKey) : null,
      stockMode: p.stockMode,
      stockQty: p.stockQty,
      stockLevel: p.stockLevel,
      wysiwyg: p.wysiwyg,
    }))
  );

  return NextResponse.json(result);
}
