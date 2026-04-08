import * as XLSX from "xlsx";
import type { ParsedShipment, ParsedProduct, ColumnMapping } from "@/app/lib/types";

const NAME_PATTERNS = [
  /english[\s_-]*name/i, /common[\s_-]*name/i, /como?n[\s_-]*name/i,
  /^name$/i, /^item$/i, /^product$/i, /^description$/i, /^species$/i,
  /^title$/i, /^coral$/i, /^fish$/i, /^livestock$/i,
  /item[\s_-]*name/i, /product[\s_-]*name/i, /species[\s_-]*name/i,
  /desc/i,
  /culture[\s_-]*coral/i, /coral[\s_-]*name/i,
];

const LATIN_NAME_PATTERNS = [
  /^latin[\s_-]*name$/i, /^latin$/i,
  /scientific[\s_-]*name/i, /^scientific$/i,
  /^species[\s_-]*name$/i, /^botanical/i,
];

const PRICE_PATTERNS = [
  /price/i,
  /^cost$/i, /unit[\s_-]*cost/i,
  /amount[\s_-]*(gbp|usd|eur|[£$€])/i,
  /^each$/i, /per[\s_-]*unit/i,
  /^[£$€]$/i, /^gbp$/i, /^amount$/i,
  /wholesale/i,
  /retailer[\s_-]*buy/i,
];

const SIZE_PATTERNS = [
  /^size$/i, /^sizes$/i, /^grade$/i, /^class$/i,
  /^dimension/i, /^measurement/i,
  /^length$/i, /^width$/i, /^height$/i, /^spec$/i, /^specimen/i,
  /^cm$/i, /^inches?$/i, /^mm$/i,
  /size[\s_-]*\(?cm\)?/i, /frag[\s_-]*size/i, /colony[\s_-]*size/i,
  /approx[\s_-]*size/i, /avg[\s_-]*size/i, /coral[\s_-]*size/i,
];

const VARIANT_PATTERNS = [
  /^variant$/i, /^colour$/i, /^color$/i, /^morph$/i, /^form$/i,
];

const QTY_PER_BOX_PATTERNS = [
  /quantity[\s_/-]*per[\s_-]*box/i, /quantity[\s_/-]*box/i,
  /qty[\s_/-]*per[\s_-]*box/i, /qty[\s_/-]*box/i,
  /per[\s_-]*box/i, /box[\s_-]*qty/i, /box[\s_-]*quantity/i,
  /pack[\s_-]*size/i, /^pcs$/i, /^\(pcs\)$/i,
  /pcs[\s_-]*per[\s_-]*box/i, /pieces[\s_-]*per[\s_-]*box/i,
  /quantity[\s_-]*per[\s_-]*bag/i, /qty[\s_-]*per[\s_-]*bag/i,
  /per[\s_-]*bag/i, /per[\s_-]*pack/i,
  /quantity[\s_-]*of[\s_-]*each/i, /qty[\s_-]*of[\s_-]*each/i,
  /quantity[\s_-]*per[\s_-]*pack/i, /qty[\s_-]*per[\s_-]*pack/i,
  /pieces[\s_-]*per/i,
];

const STOCK_PATTERNS = [
  /^stock$/i, /^available$/i, /^avail$/i, /^inventory$/i,
  /^in[\s_-]*stock$/i, /^on[\s_-]*hand$/i,
  /^supply$/i, /^nos$/i, /^count$/i,
  /^qty$/i, /^quantity$/i, /^qnty$/i,
  /^units$/i, /^no\.?\s*available/i,
  /avail(able)?[\s_-]*(qty|quantity|stock|number|no\.?|#)/i,
  /stock[\s_-]*(qty|quantity|level|count|number|no\.?|#|available)/i,
  /(qty|quantity)[\s_-]*(available|avail|in[\s_-]*stock|remaining|left)/i,
  /current[\s_-]*(stock|qty|quantity|inventory)/i,
  /in[\s_-]*stock/i, /on[\s_-]*hand/i,
  /total[\s_-]*(qty|quantity|stock)/i,
  /^no\.?$/i, /^num$/i, /^amount$/i,
  /number[\s_-]*(available|in[\s_-]*stock)/i,
  /remaining[\s_-]*(qty|quantity|stock)/i,
  /(qty|quantity)[\s_-]*(on[\s_-]*hand|remaining|left)/i,
];

const DATE_PATTERNS = [
  /^date$/i, /ship[\s_-]*date/i, /arrival/i, /deadline/i, /due/i,
  /order[\s_-]*by/i, /^eta$/i, /expected/i, /shipping[\s_-]*date/i,
  /departure/i, /dispatch/i, /delivery/i, /landing/i,
];

const FREIGHT_PATTERNS = [
  /freight/i, /shipping[\s_-]*cost/i, /transport/i, /delivery[\s_-]*cost/i,
  /carriage/i, /postage/i, /box[\s_-]*price/i,
];

function matchColumn(headers: string[], patterns: RegExp[], exclude: number[] = []): number {
  for (const pattern of patterns) {
    const idx = headers.findIndex((h, i) => !exclude.includes(i) && pattern.test(String(h || "").trim()));
    if (idx !== -1) return idx;
  }
  return -1;
}

function isNumericColumn(data: unknown[][], colIndex: number, startRow: number): boolean {
  let numericCount = 0;
  let totalCount = 0;
  for (let i = startRow; i < Math.min(startRow + 15, data.length); i++) {
    const val = data[i]?.[colIndex];
    if (val === undefined || val === null || val === "") continue;
    totalCount++;
    if (typeof val === "number" || /^\d+$/.test(String(val).trim())) numericCount++;
  }
  return totalCount > 0 && numericCount / totalCount > 0.8;
}

function isTextColumn(data: unknown[][], colIndex: number, startRow: number): boolean {
  let textCount = 0;
  let totalCount = 0;
  for (let i = startRow; i < Math.min(startRow + 15, data.length); i++) {
    const val = data[i]?.[colIndex];
    if (val === undefined || val === null || val === "") continue;
    totalCount++;
    const str = String(val).trim();
    if (str.length >= 3 && !/^\d+(\.\d+)?$/.test(str)) textCount++;
  }
  return totalCount > 0 && textCount / totalCount > 0.6;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") {
    if (value <= 0 || value >= 100000) return null;
    return Math.round(value * 100) / 100;
  }
  if (typeof value === "string") {
    const cleaned = value.replace(/[£$€,\s]/g, "").replace(/^(US|UK|EU|GBP|USD|EUR)\s*/i, "");
    const numMatch = cleaned.match(/[\d.]+/);
    if (!numMatch) return null;
    const num = parseFloat(numMatch[0]);
    if (isNaN(num) || num <= 0 || num >= 100000) return null;
    return Math.round(num * 100) / 100;
  }
  return null;
}

function parseQty(value: unknown): number | null {
  if (typeof value === "number") return value >= 0 ? Math.round(value) : null;
  if (typeof value !== "string") return null;

  const s = value.trim();
  if (!s) return null;

  // Skip non-numeric specials
  if (/^(net|n\/a|tba|tbc|na|-+)$/i.test(s)) return null;

  // K-notation range: "2.5k - 3k"
  const kRange = s.match(/^([\d.]+)\s*k\s*[-–—]\s*([\d.]+)\s*k$/i);
  if (kRange) {
    const low = parseFloat(kRange[1]) * 1000;
    const high = parseFloat(kRange[2]) * 1000;
    if (!isNaN(low) && !isNaN(high) && low >= 0 && high >= 0) return Math.round((low + high) / 2);
  }

  // Single k-notation: "3K", "2.5k"
  const kSingle = s.match(/^([\d.]+)\s*k$/i);
  if (kSingle) {
    const n = parseFloat(kSingle[1]) * 1000;
    return !isNaN(n) && n >= 0 ? Math.round(n) : null;
  }

  // Numeric range: "20 - 30", "20-30", "80 – 100"
  const range = s.match(/^([\d.]+)\s*[-–—]\s*([\d.]+)$/);
  if (range) {
    const low = parseFloat(range[1]);
    const high = parseFloat(range[2]);
    if (!isNaN(low) && !isNaN(high) && low >= 0 && high >= 0) return Math.round((low + high) / 2);
  }

  // Plus notation: "30+", "50+"
  const plus = s.match(/^([\d.]+)\s*\+$/);
  if (plus) {
    const n = parseFloat(plus[1]);
    return !isNaN(n) && n >= 0 ? Math.round(n) : null;
  }

  // Plain number
  const n = parseInt(s.replace(/[^\d]/g, ""));
  return !isNaN(n) && n >= 0 ? n : null;
}

function parseSize(value: unknown): string | null {
  if (!value) return null;
  const str = String(value).trim();
  if (!str || str === "0") return null;
  return str;
}

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseNaturalDate(text: string): string | null {
  const match = text.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(\d{4}))?/i,
  );
  if (!match) return null;
  const day = parseInt(match[1]);
  const month = MONTH_MAP[match[2].toLowerCase()];
  if (month === undefined) return null;
  const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
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

    const natural = parseNaturalDate(trimmed);
    if (natural) return natural;

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

function extractFreightFromText(text: string): number | null {
  const match = text.match(/[£]([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const val = parseFloat(match[1].replace(/,/g, ""));
  return !isNaN(val) && val > 10 ? val : null;
}

function extractMetadata(data: unknown[][]): { name: string | null; shipmentDate: string | null; deadline: string | null; freightCost: number | null } {
  const meta: { name: string | null; shipmentDate: string | null; deadline: string | null; freightCost: number | null } = {
    name: null, shipmentDate: null, deadline: null, freightCost: null,
  };

  for (let i = 0; i < Math.min(30, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    const rowText = row.map((c) => String(c || "")).join(" ");

    if (!meta.freightCost && /freight|packing|delivery|carriage|transport|box[\s_-]*price/i.test(rowText)) {
      for (let j = 0; j < row.length; j++) {
        const val = extractFreightFromText(String(row[j] || ""));
        if (val) { meta.freightCost = val; break; }
      }
      if (!meta.freightCost) {
        const val = extractFreightFromText(rowText);
        if (val) meta.freightCost = val;
      }
    }

    for (let j = 0; j < row.length; j++) {
      const cellStr = String(row[j] || "").trim();

      if (!meta.deadline && /deadline|order[\s_-]*by|due[\s_-]*date|close/i.test(cellStr)) {
        const d = parseNaturalDate(cellStr) || parseDate(cellStr.split(/[:]\s*/)[1]) || parseDate(row[j + 1]);
        if (d) meta.deadline = d;
      }

      if (!meta.shipmentDate && /landing|ship(ment)?[\s_-]*date|arrival|^eta$|expected|dispatch/i.test(cellStr)) {
        const d = parseNaturalDate(cellStr) || parseDate(cellStr.split(/[:]\s*/)[1]) || parseDate(row[j + 1]);
        if (d) meta.shipmentDate = d;
      }
    }
  }

  return meta;
}

function findHeaderRow(data: unknown[][]): number {
  const headerPatterns = [/name/i, /price/i, /item/i, /product/i, /code/i, /description/i, /cost/i, /qty/i, /size/i, /species/i, /stock/i, /common/i, /scientific/i, /units/i];
  let bestRow = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(40, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    const rowStr = row.map((c) => String(c || "")).join(" ");
    const matchCount = headerPatterns.filter((p) => p.test(rowStr)).length;
    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestRow = i;
    }
  }
  return bestScore >= 2 ? bestRow : 0;
}

function findBestNameColumn(headers: string[], data: unknown[][], headerRowIndex: number, excludeCols: number[]): number {
  const matched = matchColumn(headers, NAME_PATTERNS, excludeCols);
  if (matched !== -1 && isTextColumn(data, matched, headerRowIndex + 1)) return matched;

  for (let col = 0; col < headers.length; col++) {
    if (excludeCols.includes(col)) continue;
    if (isTextColumn(data, col, headerRowIndex + 1) && !isNumericColumn(data, col, headerRowIndex + 1)) {
      return col;
    }
  }

  return matched !== -1 ? matched : 0;
}

function detectShipmentName(data: unknown[][], headerRowIndex: number, filename?: string): string | null {
  for (let i = 0; i < Math.min(headerRowIndex, 8); i++) {
    const row = data[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const cellStr = String(row[j] || "").trim();
      if (cellStr.length > 5 && cellStr.length < 120) {
        if (!/deadline|date|freight|price|name|item|product|qty|quantity|cost|total|shipping|order|^[£$€]/i.test(cellStr)) {
          if (!/^\d+$/.test(cellStr)) return cellStr;
        }
      }
    }
  }
  return null;
}

const SIZE_LABEL_RE = /\b(xs|sm|ml|xl|xxl)\b|\d+[\s-]*cm/i;

interface MatrixInfo {
  sizeColumns: { colIndex: number; label: string }[];
  nameCol: number;
}

function detectMatrixFormat(data: unknown[][], headerRowIndex: number): MatrixInfo | null {
  const subHeaderRow = data[headerRowIndex + 1];
  if (!subHeaderRow) return null;

  const sizeColumns: { colIndex: number; label: string }[] = [];
  for (let j = 0; j < subHeaderRow.length; j++) {
    const val = String(subHeaderRow[j] || "").trim();
    if (val && SIZE_LABEL_RE.test(val) && val.length < 20) {
      sizeColumns.push({ colIndex: j, label: val });
    }
  }

  if (sizeColumns.length < 2) return null;

  let validCount = 0;
  for (let i = headerRowIndex + 2; i < Math.min(headerRowIndex + 7, data.length); i++) {
    const row = data[i];
    if (!row) continue;
    if (sizeColumns.some((sc) => typeof row[sc.colIndex] === "number" && (row[sc.colIndex] as number) > 0)) {
      validCount++;
    }
  }
  if (validCount < 2) return null;

  const sizeColSet = new Set(sizeColumns.map((sc) => sc.colIndex));
  let nameCol = 0;
  const headerRow = data[headerRowIndex];
  if (headerRow) {
    for (let j = 0; j < headerRow.length; j++) {
      if (/name|product|coral|description/i.test(String(headerRow[j] || ""))) {
        nameCol = j;
        break;
      }
    }
  }

  if (nameCol === 0 && !sizeColSet.has(1)) {
    let len0 = 0, cnt0 = 0, len1 = 0, cnt1 = 0;
    for (let i = headerRowIndex + 2; i < Math.min(headerRowIndex + 15, data.length); i++) {
      const v0 = data[i]?.[0], v1 = data[i]?.[1];
      if (typeof v0 === "string" && v0.trim().length > 1) { len0 += v0.trim().length; cnt0++; }
      if (typeof v1 === "string" && v1.trim().length > 1) { len1 += v1.trim().length; cnt1++; }
    }
    if (cnt1 > 0 && cnt0 > 0 && (len1 / cnt1) > (len0 / cnt0) * 2) nameCol = 1;
  }

  return { sizeColumns, nameCol };
}

function parseMatrixFormat(
  data: unknown[][],
  headerRowIndex: number,
  matrix: MatrixInfo,
  meta: { name: string | null; shipmentDate: string | null; deadline: string | null; freightCost: number | null },
  warnings: string[],
  headersList: string[],
): ParsedShipment {
  const items: ParsedProduct[] = [];
  const headers = (data[headerRowIndex] || []).map((h) => String(h || ""));
  warnings.push("Matrix format detected - sizes spread as columns");

  for (let i = headerRowIndex + 2; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const name = String(row[matrix.nameCol] || "").trim();
    if (!name || name.length < 2) continue;

    for (const sc of matrix.sizeColumns) {
      const price = parsePrice(row[sc.colIndex]);
      if (price === null) continue;

      const originalRow: Record<string, unknown> = {};
      headers.forEach((h, idx) => { if (h && row[idx] !== undefined) originalRow[h] = row[idx]; });

      items.push({
        name: `${name} (${sc.label})`,
        price,
        size: sc.label,
        qtyPerBox: null,
        availableQty: null,
        originalRow,
        warnings: [],
      });
    }
  }

  return { ...meta, items, warnings, headers: headersList, columnMappings: { name: matrix.nameCol, latinName: -1, variant: -1, price: -1, size: -1, qtyPerBox: -1, stock: -1 } };
}

function isCategoryRow(row: unknown[], nameCol: number, priceCol: number): boolean {
  const name = String(row[nameCol] || "").trim();
  if (!name || name.length < 2) return false;

  if (/^\(.*\)$/.test(name) || /^\[.*\]$/.test(name)) return true;
  if (/^[-=~*]{3,}/.test(name)) return true;

  const price = row[priceCol];
  if (price !== undefined && price !== null && price !== "" && price !== 0) return false;
  let filled = 0;
  for (const cell of row) {
    if (cell !== undefined && cell !== null && String(cell).trim() !== "") filled++;
  }
  return filled <= 2;
}

export function parseExcelBuffer(buffer: Buffer | ArrayBuffer, filename?: string, columnOverrides?: Partial<ColumnMapping>): ParsedShipment {
  const workbook = XLSX.read(buffer, { type: buffer instanceof ArrayBuffer ? "array" : "buffer" });
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
    }
  }

  const emptyMappings: ColumnMapping = { name: -1, latinName: -1, variant: -1, price: -1, size: -1, qtyPerBox: -1, stock: -1 };

  if (data.length < 2) {
    return { ...meta, name: meta.name || filename?.replace(/\.(xlsx?|xls)$/i, "") || null, items: [], warnings: [...warnings, "No data rows found"], headers: [], columnMappings: emptyMappings };
  }

  const headerRowIndex = findHeaderRow(data);
  const headers = (data[headerRowIndex] || []).map((h) => String(h || ""));

  // Merge multi-row headers: if the row above has values in columns where the
  // header row is empty or very short (e.g. "(PCS)"), merge them in.
  // Only merge values that match known column patterns to avoid section titles.
  const allColumnPatterns = [...NAME_PATTERNS, ...LATIN_NAME_PATTERNS, ...PRICE_PATTERNS, ...SIZE_PATTERNS, ...QTY_PER_BOX_PATTERNS, ...STOCK_PATTERNS, ...DATE_PATTERNS, ...FREIGHT_PATTERNS];
  if (headerRowIndex > 0) {
    const aboveRow = data[headerRowIndex - 1];
    if (aboveRow) {
      for (let i = 0; i < Math.max(headers.length, aboveRow.length); i++) {
        const above = String(aboveRow[i] || "").trim();
        if (!above) continue;
        const current = (headers[i] || "").trim();
        if ((!current || current.length <= 6) && allColumnPatterns.some((p) => p.test(above))) {
          const merged = current ? `${above} ${current}` : above;
          if (i < headers.length) headers[i] = merged;
          else headers.push(merged);
        }
      }
    }
  }

  if (!meta.name) meta.name = detectShipmentName(data, headerRowIndex, filename);
  if (!meta.name) {
    meta.name = filename?.replace(/\s*\d{2}\.\d{2}\.\d{2}\.(xlsx?|xls)$/i, "").replace(/\.(xlsx?|xls)$/i, "").trim() || null;
    if (meta.name) warnings.push("Shipment name guessed from filename");
  }

  if (!meta.deadline) warnings.push("Could not detect deadline");
  if (!meta.shipmentDate) warnings.push("Could not detect shipment date");
  if (!meta.freightCost) warnings.push("Could not detect freight cost");

  const matrixFormat = !columnOverrides ? detectMatrixFormat(data, headerRowIndex) : null;
  if (matrixFormat) {
    return parseMatrixFormat(data, headerRowIndex, matrixFormat, meta, warnings, headers);
  }

  let qtyPerBoxColIndex = columnOverrides?.qtyPerBox !== undefined ? columnOverrides.qtyPerBox : matchColumn(headers, QTY_PER_BOX_PATTERNS);
  let sizeColIndex = columnOverrides?.size !== undefined ? columnOverrides.size : matchColumn(headers, SIZE_PATTERNS);
  let priceColIndex = columnOverrides?.price !== undefined ? columnOverrides.price : matchColumn(headers, PRICE_PATTERNS);

  const reservedCols = [qtyPerBoxColIndex, sizeColIndex, priceColIndex].filter((c) => c !== -1);
  let nameColIndex = columnOverrides?.name !== undefined ? columnOverrides.name : findBestNameColumn(headers, data, headerRowIndex, reservedCols);
  reservedCols.push(nameColIndex);

  let latinNameColIndex = columnOverrides?.latinName !== undefined ? columnOverrides.latinName : matchColumn(headers, LATIN_NAME_PATTERNS, [nameColIndex, qtyPerBoxColIndex, sizeColIndex, priceColIndex].filter((c) => c !== -1));

  let variantColIndex = matchColumn(headers, VARIANT_PATTERNS, [nameColIndex, priceColIndex, sizeColIndex, latinNameColIndex, qtyPerBoxColIndex].filter((c) => c !== -1));

  let stockColIndex = columnOverrides?.stock !== undefined ? columnOverrides.stock : matchColumn(headers, STOCK_PATTERNS, [qtyPerBoxColIndex, nameColIndex, priceColIndex, sizeColIndex, latinNameColIndex, variantColIndex].filter((c) => c !== -1));

  if (priceColIndex === -1 && columnOverrides?.price === undefined) {
    for (let col = 0; col < headers.length; col++) {
      if (reservedCols.includes(col) || col === stockColIndex) continue;
      let priceCount = 0;
      for (let row = headerRowIndex + 1; row < Math.min(headerRowIndex + 10, data.length); row++) {
        if (parsePrice(data[row]?.[col]) !== null) priceCount++;
      }
      if (priceCount >= 2) {
        priceColIndex = col;
        break;
      }
    }
  }

  if (priceColIndex === -1) warnings.push("Could not detect price column");

  if (stockColIndex !== -1 && columnOverrides?.stock === undefined) {
    let filled = 0;
    let total = 0;
    for (let row = headerRowIndex + 1; row < Math.min(headerRowIndex + 30, data.length); row++) {
      const val = data[row]?.[stockColIndex];
      total++;
      if (val !== undefined && val !== null && val !== "" && parseQty(val) !== null) filled++;
    }
    const hasStockData = total > 0 && filled / total > 0.3;
    if (!hasStockData) stockColIndex = -1;
  }

  const columnMappings: ColumnMapping = {
    name: nameColIndex,
    latinName: latinNameColIndex,
    variant: variantColIndex,
    price: priceColIndex,
    size: sizeColIndex,
    qtyPerBox: qtyPerBoxColIndex,
    stock: stockColIndex,
  };

  const items: ParsedProduct[] = [];

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const rawName = String(row[nameColIndex] || "").trim();
    if (!rawName || rawName.length < 2) continue;
    if (/^\d+$/.test(rawName) && rawName.length < 4) continue;
    if (priceColIndex !== -1 && isCategoryRow(row, nameColIndex, priceColIndex)) continue;

    const itemWarnings: string[] = [];
    const price = priceColIndex !== -1 ? parsePrice(row[priceColIndex]) : null;
    const qtyPerBox = qtyPerBoxColIndex !== -1 ? parseQty(row[qtyPerBoxColIndex]) : null;
    const size = sizeColIndex !== -1 ? parseSize(row[sizeColIndex]) : null;
    const availableQty = stockColIndex !== -1 ? (parseQty(row[stockColIndex]) ?? 0) : null;
    const latinName = latinNameColIndex !== -1 ? (row[latinNameColIndex] ? String(row[latinNameColIndex]).trim() || null : null) : null;
    const variant = variantColIndex !== -1 ? (row[variantColIndex] ? String(row[variantColIndex]).trim() || null : null) : null;

    if (price === null && priceColIndex !== -1) continue;
    if (price === null) itemWarnings.push("Missing price");

    const originalRow: Record<string, unknown> = {};
    headers.forEach((header, idx) => {
      if (header && row[idx] !== undefined) originalRow[header] = row[idx];
    });

    items.push({ name: rawName, latinName, variant, price, size, qtyPerBox, availableQty, originalRow, warnings: itemWarnings });
  }

  const rawRows = data.slice(headerRowIndex + 1);

  return {
    name: meta.name,
    shipmentDate: meta.shipmentDate,
    deadline: meta.deadline,
    freightCost: meta.freightCost,
    items,
    warnings,
    headers,
    columnMappings,
    rawRows,
  };
}
