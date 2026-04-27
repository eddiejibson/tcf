import XLSX from "xlsx";

const wb = XLSX.readFile("/Users/edwardjibson/Downloads/Ezmarines stock list_20260420.xlsx");
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];

// Categorize stock col values
const stockVals: Record<string, number> = {};
for (let i = 12; i < rows.length; i++) {
  const v = String(rows[i]?.[3] || "").trim();
  stockVals[v] = (stockVals[v] || 0) + 1;
}
const sorted = Object.entries(stockVals).sort((a, b) => b[1] - a[1]);
console.log("STOCK COL UNIQUE VALUES (top 40):");
for (const [k, v] of sorted.slice(0, 40)) console.log(`  "${k}" -> ${v}`);

// Find rows where stock has cm
console.log("\nROWS WITH cm IN STOCK COL:");
let n = 0;
for (let i = 12; i < rows.length; i++) {
  const v = String(rows[i]?.[3] || "").trim();
  if (/cm|mm/i.test(v)) {
    console.log(`R${i}: ${JSON.stringify([rows[i]?.[0], rows[i]?.[2], rows[i]?.[3], rows[i]?.[4]])}`);
    if (++n > 15) break;
  }
}

// Find rows where English name has cm
console.log("\nROWS WITH cm IN ENGLISH NAME:");
n = 0;
for (let i = 12; i < rows.length; i++) {
  const v = String(rows[i]?.[0] || "").trim();
  if (/cm/i.test(v)) {
    console.log(`R${i}: ${JSON.stringify([rows[i]?.[0], rows[i]?.[2], rows[i]?.[3], rows[i]?.[4]])}`);
    if (++n > 8) break;
  }
}

// Find rows where stock is x and english doesn't have cm
console.log("\nROWS WHERE STOCK=x AND NO CM IN ENGLISH (sample):");
n = 0;
for (let i = 12; i < rows.length; i++) {
  const stock = String(rows[i]?.[3] || "").trim();
  const eng = String(rows[i]?.[0] || "").trim();
  if (/^x+$/i.test(stock) && !/cm/i.test(eng) && eng) {
    console.log(`R${i}: ${JSON.stringify([rows[i]?.[0], rows[i]?.[2], rows[i]?.[3], rows[i]?.[4]])}`);
    if (++n > 12) break;
  }
}
