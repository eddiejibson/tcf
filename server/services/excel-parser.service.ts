import * as XLSX from "xlsx";
import { ParsedShipment, ParsedProduct } from "@/app/lib/types";

const NAME_PATTERNS = [
  /^name$/i, /^item$/i, /^product$/i, /^description$/i, /^species$/i,
  /^title$/i, /^coral$/i, /^fish$/i, /^livestock$/i,
  /item[\s_-]*name/i, /product[\s_-]*name/i, /species[\s_-]*name/i,
  /common[\s_-]*name/i, /scientific/i, /desc/i,
];

const PRICE_PATTERNS = [
  /^price$/i, /^cost$/i, /unit[\s_-]*price/i, /^each$/i, /per[\s_-]*unit/i,
  /price\s*\(?\s*[£$€]?\s*\)?/i, /retail/i, /wholesale/i, /trade/i,
  /^[£$€]$/i, /^gbp$/i, /^amount$/i, /unit[\s_-]*cost/i, /selling/i, /our[\s_-]*price/i,
];

const QTY_PATTERNS = [
  /qty[\s_-]*per[\s_-]*box/i, /per[\s_-]*box/i, /box[\s_-]*qty/i,
  /^quantity$/i, /^qty$/i, /pack[\s_-]*size/i, /^pcs$/i,
  /min(imum)?[\s_-]*order/i, /min[\s_-]*qty/i, /^moq$/i,
  /per[\s_-]*bag/i, /per[\s_-]*pack/i, /^units$/i,
];

const DATE_PATTERNS = [
  /^date$/i, /ship[\s_-]*date/i, /arrival/i, /deadline/i, /due/i,
  /order[\s_-]*by/i, /^eta$/i, /expected/i, /shipping[\s_-]*date/i,
  /departure/i, /dispatch/i, /delivery/i,
];

const FREIGHT_PATTERNS = [
  /freight/i, /shipping[\s_-]*cost/i, /transport/i, /delivery[\s_-]*cost/i,
  /carriage/i, /postage/i,
];

function matchColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h) => pattern.test(String(h || "").trim()));
    if (idx !== -1) return idx;
  }
  return -1;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return value > 0 && value < 100000 ? value : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[£$€,\s]/g, "");
    const numMatch = cleaned.match(/[\d.]+/);
    if (!numMatch) return null;
    const num = parseFloat(numMatch[0]);
    return !isNaN(num) && num > 0 && num < 100000 ? num : null;
  }
  return null;
}

function parseQty(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? Math.round(value) : null;
  if (typeof value === "string") {
    const num = parseInt(value.replace(/[^\d]/g, ""));
    return !isNaN(num) && num > 0 ? num : null;
  }
  return null;
}

function parseDate(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === "number") {
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed) {
        const d = new Date(parsed.y, parsed.m - 1, parsed.d);
        return d.toISOString().split("T")[0];
      }
    } catch { /* ignore */ }
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    const ddmmyy = trimmed.match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (ddmmyy) {
      const day = parseInt(ddmmyy[1]);
      const month = parseInt(ddmmyy[2]);
      let year = parseInt(ddmmyy[3]);
      if (year < 100) year += 2000;
      const d = new Date(year, month - 1, day);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }

    const yyyymmdd = trimmed.match(/(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
    if (yyyymmdd) {
      const d = new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }

    const parsed = Date.parse(trimmed);
    if (!isNaN(parsed)) return new Date(parsed).toISOString().split("T")[0];
  }

  return null;
}

function extractMetadata(data: unknown[][]): { name: string | null; shipmentDate: string | null; deadline: string | null; freightCost: number | null } {
  const meta: { name: string | null; shipmentDate: string | null; deadline: string | null; freightCost: number | null } = {
    name: null, shipmentDate: null, deadline: null, freightCost: null,
  };

  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cellStr = String(row[j] || "").trim();
      const nextCell = row[j + 1];

      if (/deadline|order[\s_-]*by|due[\s_-]*date|close/i.test(cellStr)) {
        const dateVal = parseDate(nextCell) || parseDate(cellStr.split(/[:]\s*/)[1]);
        if (dateVal) meta.deadline = dateVal;
      }

      if (/ship(ment)?[\s_-]*date|arrival|^eta$|expected|dispatch/i.test(cellStr)) {
        const dateVal = parseDate(nextCell) || parseDate(cellStr.split(/[:]\s*/)[1]);
        if (dateVal) meta.shipmentDate = dateVal;
      }

      if (/freight|shipping[\s_-]*cost|carriage|transport/i.test(cellStr)) {
        const costVal = parsePrice(nextCell) || parsePrice(cellStr.split(/[:]\s*/)[1]);
        if (costVal) meta.freightCost = costVal;
      }

      if (i < 5 && !meta.name && cellStr.length > 5 && cellStr.length < 100) {
        if (!/deadline|date|freight|price|name|item|product|qty|quantity|cost|total|shipping/i.test(cellStr)) {
          meta.name = cellStr;
        }
      }
    }
  }

  return meta;
}

function findHeaderRow(data: unknown[][]): number {
  const headerPatterns = [/name/i, /price/i, /item/i, /product/i, /code/i, /description/i, /cost/i, /qty/i];
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map((c) => String(c || "")).join(" ");
    const matchCount = headerPatterns.filter((p) => p.test(rowStr)).length;
    if (matchCount >= 2) return i;
  }
  return 0;
}

function isPriceValue(value: unknown): boolean {
  return parsePrice(value) !== null;
}

export function parseExcelBuffer(buffer: Buffer, filename?: string): ParsedShipment {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

  const warnings: string[] = [];
  const meta = extractMetadata(data);

  if (filename) {
    const dateMatch = filename.match(/(\d{2})\.(\d{2})\.(\d{2})\.(xlsx?|xls)$/i);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const d = new Date(2000 + parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!meta.deadline) meta.deadline = d.toISOString().split("T")[0];
      if (!meta.name) {
        meta.name = filename.replace(/\s*\d{2}\.\d{2}\.\d{2}\.(xlsx?|xls)$/i, "").trim();
      }
    }
  }

  if (!meta.name) {
    meta.name = filename?.replace(/\.(xlsx?|xls)$/i, "") || null;
    warnings.push("Could not detect shipment name");
  }

  if (!meta.deadline) warnings.push("Could not detect deadline");
  if (!meta.shipmentDate) warnings.push("Could not detect shipment date");
  if (!meta.freightCost) warnings.push("Could not detect freight cost");

  if (data.length < 2) {
    return { ...meta, items: [], warnings: [...warnings, "No data rows found"] };
  }

  const headerRowIndex = findHeaderRow(data);
  const headers = (data[headerRowIndex] || []).map((h) => String(h || ""));

  const nameColIndex = matchColumn(headers, NAME_PATTERNS);
  let priceColIndex = matchColumn(headers, PRICE_PATTERNS);
  const qtyColIndex = matchColumn(headers, QTY_PATTERNS);

  const effectiveNameCol = nameColIndex !== -1 ? nameColIndex : 0;

  if (priceColIndex === -1) {
    for (let col = 0; col < headers.length; col++) {
      if (col === effectiveNameCol) continue;
      let priceCount = 0;
      for (let row = headerRowIndex + 1; row < Math.min(headerRowIndex + 10, data.length); row++) {
        if (isPriceValue(data[row]?.[col])) priceCount++;
      }
      if (priceCount >= 2) {
        priceColIndex = col;
        break;
      }
    }
  }

  if (nameColIndex === -1) warnings.push("Name column guessed (first column)");
  if (priceColIndex === -1) warnings.push("Could not detect price column");

  const items: ParsedProduct[] = [];

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const name = String(row[effectiveNameCol] || "").trim();
    if (!name || name.length < 2) continue;

    const itemWarnings: string[] = [];
    const price = priceColIndex !== -1 ? parsePrice(row[priceColIndex]) : null;
    const qty = qtyColIndex !== -1 ? parseQty(row[qtyColIndex]) : null;

    if (price === null && priceColIndex !== -1) continue;
    if (price === null) itemWarnings.push("Missing price");
    if (qty === null) itemWarnings.push("Missing qty per box");

    const originalRow: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (header && row[idx] !== undefined) originalRow[header] = row[idx];
    });

    items.push({ name, price, qtyPerBox: qty, originalRow, warnings: itemWarnings });
  }

  return {
    name: meta.name,
    shipmentDate: meta.shipmentDate,
    deadline: meta.deadline,
    freightCost: meta.freightCost,
    items,
    warnings,
  };
}
