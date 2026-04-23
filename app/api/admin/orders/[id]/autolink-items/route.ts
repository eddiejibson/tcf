import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/middleware/auth";
import { getDb } from "@/server/db/data-source";
import { OrderItem } from "@/server/entities/OrderItem";
import { Order } from "@/server/entities/Order";
import { User } from "@/server/entities/User";
import { CatalogProduct } from "@/server/entities/CatalogProduct";
import { IsNull } from "typeorm";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

// 0-100 score. Strict matching so short generic names ("A grade") don't false-match
// into longer, more specific names ("Cynarina Red A Grade").
function nameScore(itemName: string, catalogName: string, catalogLatin: string | null): number {
  const a = normalize(itemName);
  const b = normalize(catalogName);
  const latin = catalogLatin ? normalize(catalogLatin) : "";
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (latin && a === latin) return 95;

  // Substring matches only count when the shorter string is a substantial, specific chunk
  // of the longer (≥6 chars AND covers ≥60% of the longer). Blocks short generic fragments.
  const substringCovers = (short: string, long: string) =>
    short.length >= 6 && long.includes(short) && short.length / long.length >= 0.6;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  if (substringCovers(short, long)) return 80;
  if (latin) {
    const [ls, ll] = a.length < latin.length ? [a, latin] : [latin, a];
    if (substringCovers(ls, ll)) return 75;
  }

  // Token overlap — requires ≥50% overlap on BOTH sides, so 1 shared word out of 5
  // doesn't produce a match. Skips short stop-words (<3 chars).
  const tokens = (s: string) => new Set(s.split(" ").filter((w) => w.length >= 3));
  const aw = tokens(a);
  const bw = tokens(b);
  if (aw.size === 0 || bw.size === 0) return 0;
  const overlap = [...aw].filter((w) => bw.has(w)).length;
  if (overlap === 0) return 0;
  const propA = overlap / aw.size;
  const propB = overlap / bw.size;
  if (Math.min(propA, propB) < 0.5) return 0;
  return Math.round(((propA + propB) / 2) * 60);
}

// Price match. The stored unitPrice may have been computed from catalogPrice with any of:
//   - surcharge baked in (unitPrice = catalogPrice × (1 + surcharge/100))
//   - customer company discount applied (unitPrice = catalogPrice × (1 − discount/100))
//   - both combined
// We reverse each of those to recover the likely catalog price and take the closest match.
// Accepts within 15% — anything further returns 0.
function priceScore(
  itemPrice: number,
  itemSurchargePct: number,
  catalogPrice: number,
  companyDiscountPct: number,
): number {
  if (!catalogPrice || !itemPrice) return 0;
  const sur = itemSurchargePct > 0 ? 1 + itemSurchargePct / 100 : 1;
  const disc = companyDiscountPct > 0 ? 1 - companyDiscountPct / 100 : 1;
  const candidates = [
    itemPrice,                // no adjustment
    itemPrice / sur,          // strip surcharge
    itemPrice / disc,         // reverse discount
    itemPrice / (sur * disc), // strip both
  ];
  const diffs = candidates.map((p) => Math.abs(p - catalogPrice) / catalogPrice);
  const minDiff = Math.min(...diffs);
  if (minDiff <= 0.01) return 40;
  if (minDiff <= 0.05) return 30;
  if (minDiff <= 0.10) return 20;
  if (minDiff <= 0.15) return 10;
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

  // Pull the order's user → company discount, so the price match can reverse any customer
  // discount that was baked into the stored unitPrice at creation time.
  const order = await db.getRepository(Order).findOne({ where: { id } });
  let companyDiscountPct = 0;
  if (order?.userId) {
    const user = await db.getRepository(User).findOne({ where: { id: order.userId }, relations: ["company"] });
    if (user?.company) companyDiscountPct = Number(user.company.discount) || 0;
  }

  const unlinked = await itemRepo.find({
    where: { orderId: id, productId: IsNull(), catalogProductId: IsNull() },
  });

  const catalog = await catalogRepo.find({ where: { active: true } });

  const results: MatchResult[] = [];
  for (const item of unlinked) {
    // Only consider candidates that meet BOTH the name threshold (≥80) AND have a price
    // within 15%. Among those, pick the one with highest combined score. This way a
    // high-name/wrong-price catalog entry can't beat a correct same-name entry at the
    // right price — and when nothing meets both bars, we emit a clean "no match".
    let bestScore = 0;
    let bestProduct: CatalogProduct | null = null;
    for (const c of catalog) {
      const ns = nameScore(item.name, c.name, c.latinName);
      if (ns < 80) continue;
      const ps = priceScore(Number(item.unitPrice), Number(item.surcharge) || 0, Number(c.price), companyDiscountPct);
      if (ps <= 0) continue;
      const total = ns + ps;
      if (total > bestScore) {
        bestScore = total;
        bestProduct = c;
      }
    }
    const accepted = !!bestProduct;

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
    companyDiscountPct,
    totalUnlinked: unlinked.length,
    matched: toApply.length,
    unmatched: results.length - toApply.length,
    applied: dryRun ? 0 : toApply.length,
    results,
  });
}
