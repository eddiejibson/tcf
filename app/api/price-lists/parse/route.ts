import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";

const PASSWORD = "RlQ8UG";

interface ParsedItem {
  name: string;
  price: number;
  originalRow: Record<string, unknown>;
}

interface ParsedFile {
  filename: string;
  displayName: string;
  deadline: string;
  items: ParsedItem[];
  error?: string;
}

function extractDateFromFilename(filename: string): string {
  const match = filename.match(/(\d{2})\.(\d{2})\.(\d{2})\.(xlsx?|xls)$/i);
  if (!match) return "";

  const [, day, month, year] = match;
  const date = new Date(
    2000 + parseInt(year),
    parseInt(month) - 1,
    parseInt(day)
  );

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function findPriceColumn(headers: string[]): number {
  // First try to find explicit price column
  const pricePatterns = [/price/i, /cost/i, /£/i, /gbp/i, /amount/i, /total/i];

  for (const pattern of pricePatterns) {
    const index = headers.findIndex((h) => pattern.test(String(h || "")));
    if (index !== -1) return index;
  }

  return -1;
}

function findNameColumn(headers: string[]): number {
  const namePatterns = [
    /name/i,
    /item/i,
    /product/i,
    /description/i,
    /species/i,
    /fish/i,
    /coral/i,
  ];

  for (const pattern of namePatterns) {
    const index = headers.findIndex((h) => pattern.test(String(h || "")));
    if (index !== -1) return index;
  }

  // Default to first column if no match
  return 0;
}

function isPriceValue(value: unknown): boolean {
  if (typeof value === "number" && value > 0 && value < 100000) {
    return true;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[£$,\s]/g, "");
    const num = parseFloat(cleaned);
    return !isNaN(num) && num > 0 && num < 100000;
  }
  return false;
}

function parsePrice(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[£$,\s]/g, "");
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

function parseExcelFile(filePath: string): ParsedItem[] {
  console.log("parseExcelFile called for:", filePath);

  const fileBuffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  console.log("Data rows:", data.length);

  if (data.length < 2) return [];

  // Find header row - look for row containing recognizable headers
  let headerRowIndex = 0;
  const headerPatterns = [/name/i, /price/i, /item/i, /product/i, /code/i, /description/i];

  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    const rowStr = row.map((c) => String(c || "")).join(" ");
    const matchCount = headerPatterns.filter((p) => p.test(rowStr)).length;

    if (matchCount >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  console.log("Header row index:", headerRowIndex);
  const headers = (data[headerRowIndex] || []).map((h) => String(h || ""));
  console.log("Headers:", headers);

  let priceColIndex = findPriceColumn(headers);
  const nameColIndex = findNameColumn(headers);
  console.log("nameColIndex:", nameColIndex, "priceColIndex:", priceColIndex);

  // If no explicit price column found, look for column with decimal values
  if (priceColIndex === -1) {
    for (let col = 0; col < headers.length; col++) {
      if (col === nameColIndex) continue;

      let priceCount = 0;
      for (
        let row = headerRowIndex + 1;
        row < Math.min(headerRowIndex + 10, data.length);
        row++
      ) {
        if (isPriceValue(data[row]?.[col])) {
          priceCount++;
        }
      }

      if (priceCount >= 2) {
        priceColIndex = col;
        break;
      }
    }
  }

  if (priceColIndex === -1) return [];

  const items: ParsedItem[] = [];

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const name = String(row[nameColIndex] || "").trim();
    const priceValue = row[priceColIndex];

    if (!name || name.length < 2) continue;
    if (!isPriceValue(priceValue)) continue;

    const price = parsePrice(priceValue);
    if (price <= 0) continue;

    const originalRow: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (header && row[idx] !== undefined) {
        originalRow[header] = row[idx];
      }
    });

    items.push({
      name,
      price,
      originalRow,
    });
  }

  return items;
}

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (password !== PASSWORD) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const cwd = process.cwd();
    const priceListsDir = path.join(cwd, "price-lists");

    console.log("CWD:", cwd);
    console.log("Price lists dir:", priceListsDir);
    console.log("Dir exists:", fs.existsSync(priceListsDir));

    if (!fs.existsSync(priceListsDir)) {
      console.log("Directory does not exist!");
      return NextResponse.json({ files: [], error: "Directory not found", cwd, priceListsDir });
    }

    const allFiles = fs.readdirSync(priceListsDir);
    console.log("All files in dir:", allFiles);

    const files = allFiles.filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".xlsx" || ext === ".xls";
    });
    console.log("Excel files:", files);

    const parsedFiles: ParsedFile[] = [];

    for (const file of files) {
      const filePath = path.join(priceListsDir, file);

      try {
        console.log(`Parsing file: ${filePath}`);
        console.log(`File exists: ${fs.existsSync(filePath)}`);

        const items = parseExcelFile(filePath);
        console.log(`Items found for ${file}: ${items.length}`);

        parsedFiles.push({
          filename: file,
          displayName: file.replace(/\s*\d{2}\.\d{2}\.\d{2}\.(xlsx?|xls)$/i, ""),
          deadline: extractDateFromFilename(file),
          items,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error parsing ${file}:`, errorMsg);
        parsedFiles.push({
          filename: file,
          displayName: file.replace(/\s*\d{2}\.\d{2}\.\d{2}\.(xlsx?|xls)$/i, ""),
          deadline: extractDateFromFilename(file),
          items: [],
          error: errorMsg,
        });
      }
    }

    return NextResponse.json({ files: parsedFiles });
  } catch {
    return NextResponse.json(
      { error: "Failed to parse price lists" },
      { status: 500 }
    );
  }
}
