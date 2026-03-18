import * as fs from "fs";
import * as path from "path";
import { parseExcelBuffer } from "./server/services/excel-parser.service";

const DOWNLOADS = path.join(process.env.HOME!, "Downloads");

const FILTER_PATTERNS = [
  /BALI/i, /Caribbean/i, /Coral/i, /INDO/i, /Indonesia/i,
  /Maldives/i, /Red[\s_-]*Sea/i, /RVS/i, /AUSTRALIA/i, /price-list/i,
];

const files = fs.readdirSync(DOWNLOADS)
  .filter((f) => /\.xlsx?$/i.test(f))
  .filter((f) => FILTER_PATTERNS.some((p) => p.test(f)))
  .sort();

console.log(`Found ${files.length} coral-related Excel files in ~/Downloads\n`);
console.log("=".repeat(100));

let totalFiles = 0;
let successFiles = 0;
let failedFiles = 0;

for (const file of files) {
  totalFiles++;
  const fullPath = path.join(DOWNLOADS, file);
  console.log(`\n[${ totalFiles }/${ files.length }] ${file}`);
  console.log("-".repeat(80));

  try {
    const buffer = fs.readFileSync(fullPath);
    const result = parseExcelBuffer(buffer, file);

    successFiles++;

    console.log(`  Name detected:     ${result.name ?? "(none)"}`);
    console.log(`  Deadline:          ${result.deadline ?? "(none)"}`);
    console.log(`  Shipment date:     ${result.shipmentDate ?? "(none)"}`);
    console.log(`  Freight cost:      ${result.freightCost != null ? `£${result.freightCost}` : "(none)"}`);
    console.log(`  Items found:       ${result.items.length}`);
    console.log(`  Warnings:          ${result.warnings.length > 0 ? result.warnings.join("; ") : "(none)"}`);

    if (result.items.length > 0) {
      console.log(`  First ${Math.min(3, result.items.length)} items:`);
      for (const item of result.items.slice(0, 3)) {
        const price = item.price != null ? `£${item.price.toFixed(2)}` : "no price";
        const qty = item.qtyPerBox != null ? `qty: ${item.qtyPerBox}` : "no qty";
        const itemWarns = item.warnings.length > 0 ? ` [${item.warnings.join(", ")}]` : "";
        // Check originalRow for any size-like fields
        const sizeKeys = Object.keys(item.originalRow || {}).filter((k) =>
          /size|length|cm|inch|dimension/i.test(k)
        );
        const sizeInfo = sizeKeys.length > 0
          ? ` | size: ${sizeKeys.map((k) => `${k}=${item.originalRow![k]}`).join(", ")}`
          : "";
        console.log(`    - ${item.name}  (${price}, ${qty}${sizeInfo})${itemWarns}`);
      }
    }
  } catch (err: any) {
    failedFiles++;
    console.log(`  ERROR: ${err.message}`);
  }
}

console.log("\n" + "=".repeat(100));
console.log(`\nSummary: ${successFiles} parsed OK, ${failedFiles} failed, ${totalFiles} total`);
