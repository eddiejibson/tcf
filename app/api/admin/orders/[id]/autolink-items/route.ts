import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { OrderItem } from "@/server/entities/OrderItem";
import { CatalogProduct } from "@/server/entities/CatalogProduct";
import { IsNull } from "typeorm";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

// 0-100 score. Exact normalized → latin match → substring → token overlap.
function nameScore(itemName: string, catalogName: string, catalogLatin: string | null): number {
  const a = normalize(itemName);
  const b = normalize(catalogName);
  const latin = catalogLatin ? normalize(catalogLatin) : "";
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a === latin) return 95;
  if (b.includes(a) || a.includes(b)) return 75;
  if (latin && (latin.includes(a) || a.includes(latin))) return 70;
  const aw = new Set(a.split(" ").filter((w) => w.length >= 2));
  const bw = new Set(b.split(" ").filter((w) => w.length >= 2));
  if (aw.size === 0 || bw.size === 0) return 0;
  const overlap = [...aw].filter((w) => bw.has(w)).length;
  return (overlap / Math.max(aw.size, bw.size)) * 60;
}

// Tries the stored unitPrice both as-is and with surcharge stripped, so orders where surcharge
// was baked into unitPrice still match. Tolerance widens to account for discounts.
function priceScore(itemPrice: number, itemSurchargePct: number, catalogPrice: number): number {
  if (!catalogPrice || !itemPrice) return 0;
  const candidates = [
    itemPrice,
    itemSurchargePct > 0 ? itemPrice / (1 + itemSurchargePct / 100) : itemPrice,
  ];
  const diffs = candidates.map((p) => Math.abs(p - catalogPrice) / catalogPrice);
  const minDiff = Math.min(...diffs);
  if (minDiff <= 0.01) return 40;
  if (minDiff <= 0.05) return 30;
  if (minDiff <= 0.15) return 20;
  if (minDiff <= 0.25) return 10;
  return 0;
}

interface MatchResult {
  itemId: string;
  itemName: string;
  itemPrice: number;
  matched: null | { catalogProductId: string; catalogName: string; catalogLatinName: string | null; catalogPrice: number; score: number };
}

// POST /api/admin/orders/:id/autolink-items — scans this order's unlinked items (productId
// AND catalogProductId both null), proposes catalog matches by name+price. With { dryRun: true }
// only previews; otherwise writes catalogProductId onto each matched item.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const dryRun: boolean = !!body.dryRun;

  const db = await getDb();
  const itemRepo = db.getRepository(OrderItem);
  const catalogRepo = db.getRepository(CatalogProduct);

  const unlinked = await itemRepo.find({
    where: { orderId: id, productId: IsNull(), catalogProductId: IsNull() },
  });

  const catalog = await catalogRepo.find({ where: { active: true } });

  const results: MatchResult[] = [];
  for (const item of unlinked) {
    let bestScore = 0;
    let bestProduct: CatalogProduct | null = null;
    for (const c of catalog) {
      const ns = nameScore(item.name, c.name, c.latinName);
      if (ns < 40) continue;
      const ps = priceScore(Number(item.unitPrice), Number(item.surcharge) || 0, Number(c.price));
      const total = ns + ps;
      if (total > bestScore) {
        bestScore = total;
        bestProduct = c;
      }
    }
    // Accept if strong name alone (>=70) OR decent name (>=60) with any price signal.
    const accepted = bestProduct && (
      bestScore >= 70 ||
      (bestScore >= 60 && priceScore(Number(item.unitPrice), Number(item.surcharge) || 0, Number(bestProduct.price)) > 0)
    );

    results.push({
      itemId: item.id,
      itemName: item.name,
      itemPrice: Number(item.unitPrice),
      matched: accepted && bestProduct
        ? {
            catalogProductId: bestProduct.id,
            catalogName: bestProduct.name,
            catalogLatinName: bestProduct.latinName,
            catalogPrice: Number(bestProduct.price),
            score: Math.round(bestScore),
          }
        : null,
    });
  }

  const toApply = results.filter((r) => r.matched);

  if (!dryRun && toApply.length > 0) {
    for (const r of toApply) {
      if (!r.matched) continue;
      await itemRepo.update(r.itemId, { catalogProductId: r.matched.catalogProductId });
    }
  }

  return NextResponse.json({
    dryRun,
    totalUnlinked: unlinked.length,
    matched: toApply.length,
    unmatched: results.length - toApply.length,
    applied: dryRun ? 0 : toApply.length,
    results,
  });
}
