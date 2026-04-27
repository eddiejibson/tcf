import "reflect-metadata";
import "dotenv/config";
import XLSX from "xlsx";
import { getDb } from "../server/db/data-source";
import { Shipment } from "../server/entities/Shipment";
import { Product } from "../server/entities/Product";
import { extractSizeVariant } from "../server/services/size-variant-extract";

const SHIPMENT_NAME = "Taiwan UPDATED";
const XLSX_PATH = "/Users/edwardjibson/Downloads/Ezmarines stock list_20260420.xlsx";

interface XlsxRow {
  english: string;
  latin: string;
  chinese: string;
  stock: string;
  basePrice: number;
  marginPrice: number;
  rowIndex: number;
}

function loadXlsx(margin: number): XlsxRow[] {
  const wb = XLSX.readFile(XLSX_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

  // Header row at 11 (Species Name, Scientific Name, 中文名, Stock, Price)
  const out: XlsxRow[] = [];
  for (let i = 12; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const english = String(r[0] || "").trim();
    const latin = String(r[1] || "").trim();
    const chinese = String(r[2] || "").trim();
    const stock = String(r[3] || "").trim();
    const priceRaw = r[4];
    const basePrice = typeof priceRaw === "number" ? priceRaw : parseFloat(String(priceRaw || ""));
    if (!english || !isFinite(basePrice) || basePrice <= 0) continue;
    out.push({
      english,
      latin,
      chinese,
      stock,
      basePrice,
      marginPrice: Math.round(basePrice * (1 + margin / 100) * 100) / 100,
      rowIndex: i,
    });
  }
  return out;
}

function priceClose(a: number, b: number): boolean {
  return Math.abs(Number(a) - Number(b)) < 0.02;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const db = await getDb();
  const shipment = await db.getRepository(Shipment).findOneByOrFail({ name: SHIPMENT_NAME });
  console.log(`Shipment: ${shipment.name} (${shipment.id}) margin=${shipment.margin}`);

  const xlsxRows = loadXlsx(Number(shipment.margin));
  console.log(`Loaded ${xlsxRows.length} xlsx rows`);

  const products = await db.getRepository(Product).find({ where: { shipmentId: shipment.id } });
  console.log(`Loaded ${products.length} products from DB`);

  // Build index by exact name (trimmed) for fast lookup
  const byName = new Map<string, XlsxRow[]>();
  for (const r of xlsxRows) {
    const k = r.english.trim();
    const arr = byName.get(k) || [];
    arr.push(r);
    byName.set(k, arr);
  }

  const stats = {
    matched: 0,
    matchedByPrice: 0,
    nameNoPrice: 0,
    noNameMatch: 0,
    extracted: 0,
    extractedSize: 0,
    extractedVariant: 0,
    bothNothing: 0,
  };
  const updates: { id: string; name: string; price: number; size: string | null; variant: string | null; src: string }[] = [];
  const unmatched: string[] = [];

  for (const p of products) {
    const name = p.name.trim();
    const price = Number(p.price);
    const candidates = byName.get(name) || [];

    let row: XlsxRow | undefined;
    if (candidates.length === 1) {
      row = candidates[0];
      stats.matched++;
    } else if (candidates.length > 1) {
      row = candidates.find((c) => priceClose(c.marginPrice, price));
      if (row) stats.matchedByPrice++;
      else stats.nameNoPrice++;
    } else {
      stats.noNameMatch++;
      unmatched.push(`${name} (${price})`);
      continue;
    }

    if (!row) {
      unmatched.push(`${name} (${price}) — name match but no price hit; candidates: ${candidates.map((c) => c.marginPrice).join(",")}`);
      continue;
    }

    // Verify price (allow some slack — sometimes margin not applied or rounding)
    if (!priceClose(row.marginPrice, price) && !priceClose(row.basePrice, price)) {
      unmatched.push(`${name} (db=${price} xlsx=${row.basePrice}/+m=${row.marginPrice}) — price mismatch`);
      continue;
    }

    const { size, variant } = extractSizeVariant({
      stock: row.stock,
      english: row.english,
      chinese: row.chinese,
    });

    if (size) stats.extractedSize++;
    if (variant) stats.extractedVariant++;
    if (!size && !variant) {
      stats.bothNothing++;
    } else {
      stats.extracted++;
    }

    updates.push({
      id: p.id,
      name: p.name,
      price,
      size,
      variant,
      src: `stock="${row.stock}" eng="${row.english}" zh="${row.chinese}"`,
    });
  }

  console.log("\n=== STATS ===");
  console.log(JSON.stringify(stats, null, 2));

  console.log("\n=== SAMPLE EXTRACTIONS (first 30 with values) ===");
  const withVal = updates.filter((u) => u.size || u.variant);
  for (const u of withVal.slice(0, 30)) {
    console.log(`  size=${u.size ?? "-"} variant=${u.variant ?? "-"} | ${u.name} (£${u.price})`);
    console.log(`    ${u.src}`);
  }

  console.log("\n=== SAMPLE NO EXTRACTION (first 15) ===");
  for (const u of updates.filter((u) => !u.size && !u.variant).slice(0, 15)) {
    console.log(`  | ${u.name} (£${u.price})`);
    console.log(`    ${u.src}`);
  }

  console.log("\n=== UNMATCHED (first 15 of " + unmatched.length + ") ===");
  for (const u of unmatched.slice(0, 15)) console.log(`  ${u}`);

  if (apply) {
    console.log("\n=== APPLYING UPDATES ===");
    const repo = db.getRepository(Product);
    let n = 0;
    for (const u of updates) {
      if (!u.size && !u.variant) continue;
      await repo.update(u.id, { size: u.size, variant: u.variant });
      n++;
    }
    console.log(`Applied ${n} updates`);
  } else {
    console.log("\n[dry run — pass --apply to write changes]");
  }

  await db.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
