import XLSX from "xlsx";
import path from "path";
import os from "os";

const files = [
  "BALI CORAL PRICE LIST.xlsx",
  "BALI PICK YOUR OWN LIST - MAR26.xlsx",
  "BALI - PICK LIST BOX 1 UPDATED.xlsx",
  "Caribbean import.xlsx",
  "Coral Essentials Ocean Grown Ornamentals Pricelist.xlsx",
  "INDO PACIFIC DIRECT RED SEA STOCK LIST 2.12.25.xls",
  "Maldives_Import.xlsx",
  "Red Sea List.xlsx",
  "RVS STOCK REPORT 05JAN26.xls",
  "AUSTRALIA CORAL BOXES.xlsx",
];

const downloadsDir = path.join(os.homedir(), "Downloads");

for (const filename of files) {
  const filePath = path.join(downloadsDir, filename);
  console.log("\n" + "=".repeat(100));
  console.log(`FILE: ${filename}`);
  console.log("=".repeat(100));

  try {
    const workbook = XLSX.readFile(filePath);

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
      });

      console.log(`\n  SHEET: "${sheetName}" (${rows.length} total rows)`);
      console.log("  " + "-".repeat(96));

      const preview = rows.slice(0, 10);
      for (let i = 0; i < preview.length; i++) {
        console.log(`  Row ${i}: ${JSON.stringify(preview[i])}`);
      }
    }
  } catch (err: any) {
    console.log(`  ERROR: ${err.message}`);
  }
}
