import * as XLSX from "xlsx";

export interface PackingListItem {
  name: string;
  size: string | null;
  quantity: number;
}

export interface PackingListOrder {
  label: string;
  items: PackingListItem[];
}

export interface PackingColumnMapping {
  name: number;
  size: number; // -1 if not mapped
  qty: number;
}

export interface PackingListResult {
  orders: PackingListOrder[];
  headers: string[];
  rawRows: unknown[][];
  columnMappings: PackingColumnMapping;
  separators: { rowIndex: number; label: string }[];
  headerRowIndex: number;
  warnings: string[];
}

// --- Column header patterns ---

const NAME_PATTERNS = [
  /^name$/i, /english[\s_-]*name/i, /common[\s_-]*name/i, /como?n[\s_-]*name/i,
  /^item$/i, /^product$/i, /^description$/i, /^species$/i, /^title$/i,
  /item[\s_-]*name/i, /product[\s_-]*name/i, /species[\s_-]*name/i,
  /scientific[\s_-]*name/i, /scientific/i, /^desc/i, /^latin/i,
  /coral[\s_-]*name/i, /fish[\s_-]*name/i, /livestock/i,
];

const SIZE_PATTERNS = [
  /^size$/i, /^sizes$/i, /^grade$/i, /^class$/i,
  /^dimension/i, /^measurement/i, /^spec$/i, /^specimen/i,
  /^cm$/i, /^inches?$/i, /^mm$/i,
  /size[\s_-]*\(?cm\)?/i, /frag[\s_-]*size/i, /colony[\s_-]*size/i,
  /approx[\s_-]*size/i, /avg[\s_-]*size/i, /coral[\s_-]*size/i,
];

const QTY_PATTERNS = [
  /^qty$/i, /^quantity$/i, /^order$/i, /^ordered$/i,
  /^pcs$/i, /^pieces$/i, /^stock$/i,
  /^units$/i, /^amount$/i, /^total$/i,
  /^count$/i, /^no\.?$/i, /^nos$/i,
  /order[\s_-]*qty/i, /qty[\s_-]*ordered/i,
];

// Things that are DEFINITELY NOT a name or qty
const CODE_PATTERNS = [
  /^code$/i, /^sku$/i, /^ref$/i, /^id$/i,
  /^barcode$/i, /^upc$/i, /^ean$/i,
  /item[\s_-]*code/i, /product[\s_-]*code/i,
  /^no\.?$/i, /^number$/i, /^#$/i,
  /box[\s_-]*\(?no/i, /box[\s_-]*number/i, /box[\s_-]*#/i,
  /carton[\s_-]*no/i, /bag[\s_-]*no/i,
];

const PRICE_PATTERNS = [
  /price/i, /^cost$/i, /per[\s_-]*unit/i,
  /^[£$€]$/i, /^gbp$/i, /^amount$/i, /wholesale/i,
];

const IGNORE_COLUMN_PATTERNS = [
  ...CODE_PATTERNS,
  PRICE_PATTERNS,
  /^box$/i, /^boxes$/i, /^bag$/i, /^bags$/i,
  /^notes?$/i, /^remark/i, /^comment/i,
  /^image/i, /^photo/i, /^pic/i,
].flat();

// --- Helpers ---

function normalizeString(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

interface ColumnStats {
  header: string;
  colIdx: number;
  textCount: number;
  numericCount: number;
  emptyCount: number;
  totalNonEmpty: number;
  avgTextLength: number;
  medianNumeric: number;
  maxNumeric: number;
}

function analyzeColumn(rows: unknown[][], colIdx: number, startRow: number, maxRows: number): Omit<ColumnStats, "header"> {
  let textCount = 0;
  let numericCount = 0;
  let emptyCount = 0;
  let totalLength = 0;
  const numericValues: number[] = [];

  for (let i = startRow; i < Math.min(startRow + maxRows, rows.length); i++) {
    const val = rows[i]?.[colIdx];
    if (val === null || val === undefined || String(val).trim() === "") {
      emptyCount++;
      continue;
    }

    if (typeof val === "number") {
      numericCount++;
      numericValues.push(Math.abs(val));
    } else {
      const str = String(val).trim();
      if (/^-?\d+(\.\d+)?$/.test(str)) {
        numericCount++;
        numericValues.push(Math.abs(parseFloat(str)));
      } else {
        textCount++;
        totalLength += str.length;
      }
    }
  }

  numericValues.sort((a, b) => a - b);
  const totalNonEmpty = textCount + numericCount;

  return {
    colIdx,
    textCount,
    numericCount,
    emptyCount,
    totalNonEmpty,
    avgTextLength: textCount > 0 ? totalLength / textCount : 0,
    medianNumeric: numericValues.length > 0 ? numericValues[Math.floor(numericValues.length / 2)] : 0,
    maxNumeric: numericValues.length > 0 ? numericValues[numericValues.length - 1] : 0,
  };
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

// --- Header row detection ---

function findHeaderRow(data: unknown[][]): number {
  const headerPatterns = [
    /name/i, /price/i, /item/i, /product/i, /description/i,
    /qty/i, /quantity/i, /size/i, /species/i, /stock/i,
    /order/i, /common/i, /scientific/i, /units/i, /grade/i,
  ];

  let bestRow = 0;
  let bestScore = 0;

  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    const cells = row.map((c) => String(c ?? "").trim());
    // Skip rows that are mostly empty
    const nonEmpty = cells.filter((c) => c.length > 0);
    if (nonEmpty.length < 2) continue;

    const rowStr = cells.join(" ");
    let matchCount = headerPatterns.filter((p) => p.test(rowStr)).length;

    // Bonus: lots of short text cells (typical headers)
    const shortTextCells = nonEmpty.filter((c) => c.length < 30 && !/^\d+(\.\d+)?$/.test(c));
    if (shortTextCells.length >= 3) matchCount += 1;

    if (matchCount > bestScore) {
      bestScore = matchCount;
      bestRow = i;
    }
  }

  return bestScore >= 2 ? bestRow : 0;
}

// --- Smart column detection ---

function detectColumnsSmart(data: unknown[][], headerRowIndex: number): PackingColumnMapping & { headers: string[] } {
  const headerRow = data[headerRowIndex] || [];
  const headers = headerRow.map((c) => String(c ?? "").trim());
  const dataStartRow = headerRowIndex + 1;

  // Analyze each column
  const stats: ColumnStats[] = headers.map((header, colIdx) => ({
    header,
    ...analyzeColumn(data, colIdx, dataStartRow, 25),
  }));

  // --- Find NAME column ---
  let nameCol = -1;
  let bestNameScore = -Infinity;

  for (const col of stats) {
    let score = 0;

    // Strong header match
    if (matchesAny(col.header, NAME_PATTERNS)) score += 60;
    // Penalize if it matches code/ignore patterns
    if (matchesAny(col.header, CODE_PATTERNS)) score -= 200;
    if (matchesAny(col.header, PRICE_PATTERNS)) score -= 200;
    if (matchesAny(col.header, QTY_PATTERNS)) score -= 50;

    // Text-heavy column with long strings = likely names
    if (col.textCount > col.numericCount) score += 30;
    if (col.avgTextLength > 10) score += 25;
    if (col.avgTextLength > 20) score += 15;
    if (col.avgTextLength < 3 && col.textCount > 0) score -= 30;

    // Purely numeric = not a name
    if (col.numericCount > 0 && col.textCount === 0) score -= 100;

    // Has enough data
    if (col.totalNonEmpty > 3) score += 5;

    if (score > bestNameScore) {
      bestNameScore = score;
      nameCol = col.colIdx;
    }
  }

  // Fallback: first column with text content
  if (nameCol === -1 || bestNameScore < 0) {
    nameCol = stats.findIndex((c) => c.textCount > c.numericCount && c.avgTextLength > 5);
    if (nameCol === -1) nameCol = 0;
  }

  // --- Find SIZE column ---
  let sizeCol = -1;
  for (const col of stats) {
    if (col.colIdx === nameCol) continue;
    if (matchesAny(col.header, SIZE_PATTERNS)) {
      sizeCol = col.colIdx;
      break;
    }
  }

  // Fallback: check for size-like values (S, M, L, XL, "3-5cm")
  if (sizeCol === -1) {
    for (const col of stats) {
      if (col.colIdx === nameCol) continue;
      if (matchesAny(col.header, CODE_PATTERNS)) continue;
      if (matchesAny(col.header, PRICE_PATTERNS)) continue;

      let sizeHits = 0;
      let checked = 0;
      for (let r = dataStartRow; r < Math.min(dataStartRow + 20, data.length); r++) {
        const val = String(data[r]?.[col.colIdx] ?? "").trim();
        if (!val) continue;
        checked++;
        if (/^\d+[-–]\d+\s*(cm|mm|"|in)?$/i.test(val) || /^[SMLX]{1,3}$/i.test(val) || /^\d+\s*cm$/i.test(val)) {
          sizeHits++;
        }
      }
      if (checked > 0 && sizeHits / checked > 0.4) {
        sizeCol = col.colIdx;
        break;
      }
    }
  }

  // --- Find QTY column ---
  let qtyCol = -1;
  let bestQtyScore = -Infinity;

  for (const col of stats) {
    if (col.colIdx === nameCol || col.colIdx === sizeCol) continue;

    let score = 0;

    // Header match
    if (matchesAny(col.header, QTY_PATTERNS)) score += 50;
    // Hex order ID as header = qty column for that order
    const cleanHeader = col.header.replace(/^#/, "");
    if (/^[0-9A-Fa-f]{6,8}$/.test(cleanHeader)) score += 40;

    // Penalize code/name/price columns
    if (matchesAny(col.header, CODE_PATTERNS)) score -= 200;
    if (matchesAny(col.header, NAME_PATTERNS)) score -= 100;
    if (matchesAny(col.header, PRICE_PATTERNS)) score -= 50;

    // Mostly numeric
    if (col.numericCount > 0 && col.numericCount >= col.textCount) score += 20;

    // REASONABLE numbers: quantities are usually 1-500, not codes like 123456
    if (col.medianNumeric > 0 && col.medianNumeric <= 500) score += 30;
    if (col.medianNumeric > 500 && col.medianNumeric <= 2000) score += 10;
    if (col.medianNumeric > 2000) score -= 40;
    if (col.maxNumeric > 10000) score -= 60;
    if (col.maxNumeric > 100000) score -= 200; // Definitely a code

    // Has data
    if (col.totalNonEmpty > 3) score += 5;

    if (score > bestQtyScore) {
      bestQtyScore = score;
      qtyCol = col.colIdx;
    }
  }

  // Fallback: first numeric column with reasonable values that isn't name/size
  if (qtyCol === -1 || bestQtyScore < 0) {
    for (const col of stats) {
      if (col.colIdx === nameCol || col.colIdx === sizeCol) continue;
      if (col.numericCount > 2 && col.medianNumeric > 0 && col.medianNumeric <= 1000 && col.maxNumeric < 10000) {
        qtyCol = col.colIdx;
        break;
      }
    }
  }

  return { name: nameCol, size: sizeCol, qty: qtyCol === -1 ? -1 : qtyCol, headers };
}

// --- Subtotal/total row blocklist ---

const SUBTOTAL_PATTERN = /^(sub[\s-]?total|total|grand[\s-]?total|sum|shipping|freight|discount|vat|tax|delivery|postage|carriage|handling|p&p|p\+p)$/i;

// --- Order column detection ---

interface OrderColumnResult {
  colIndex: number;
  type: "orderId" | "customer";
}

function detectOrderColumn(
  data: unknown[][],
  headerRowIndex: number,
  nameCol: number,
  sizeCol: number,
  qtyCol: number,
): OrderColumnResult | null {
  const dataStartRow = headerRowIndex + 1;
  const maxScanRows = Math.min(30, data.length - dataStartRow);
  if (maxScanRows < 1) return null;

  const headerRow = data[headerRowIndex] || [];
  const totalCols = headerRow.length;

  let bestCol: OrderColumnResult | null = null;
  let bestScore = 0;

  for (let col = 0; col < totalCols; col++) {
    // Skip columns already identified as name/size/qty
    if (col === nameCol || col === sizeCol || col === qtyCol) continue;

    let hexIdHits = 0;
    let emailHits = 0;
    const distinctValues = new Map<string, number>();
    let totalNonEmpty = 0;
    let totalTextLength = 0;
    let numericOnlyCount = 0;

    for (let r = dataStartRow; r < dataStartRow + maxScanRows && r < data.length; r++) {
      const val = data[r]?.[col];
      if (val === null || val === undefined) continue;
      const str = String(val).trim();
      if (!str) continue;

      totalNonEmpty++;

      // Check for hex ID pattern
      const cleaned = str.replace(/^#/, "");
      if (/^[0-9A-Fa-f]{6,8}$/.test(cleaned)) {
        hexIdHits++;
      }

      // Check for email
      if (/@/.test(str)) {
        emailHits++;
      }

      // Check if purely numeric
      if (/^-?\d+(\.\d+)?$/.test(str)) {
        numericOnlyCount++;
      }

      totalTextLength += str.length;

      const key = str.toLowerCase().trim();
      distinctValues.set(key, (distinctValues.get(key) || 0) + 1);
    }

    if (totalNonEmpty < 2) continue;

    const distinctCount = distinctValues.size;
    const avgTextLen = totalTextLength / totalNonEmpty;

    // Skip columns where most values are all numeric (qty/price column)
    if (numericOnlyCount / totalNonEmpty > 0.7) continue;

    // Skip columns where most values are unique long text (name column)
    if (distinctCount > totalNonEmpty * 0.8 && avgTextLen > 15) continue;

    let score = 0;

    // Hex IDs found → highest priority
    if (hexIdHits >= 2 || (hexIdHits >= 1 && hexIdHits / totalNonEmpty > 0.3)) {
      score = 100 + hexIdHits;
      if (score > bestScore) {
        bestScore = score;
        bestCol = { colIndex: col, type: "orderId" };
      }
      continue;
    }

    // Emails found → strong signal for customer column
    if (emailHits >= 2 || (emailHits >= 1 && emailHits / totalNonEmpty > 0.3)) {
      score = 80 + emailHits;
      if (score > bestScore) {
        bestScore = score;
        bestCol = { colIndex: col, type: "customer" };
      }
      continue;
    }

    // Repeating text groups: 2-10 distinct values where each appears multiple times
    if (distinctCount >= 2 && distinctCount <= 10) {
      const allRepeating = [...distinctValues.values()].every((count) => count >= 2);
      const mostRepeating = [...distinctValues.values()].filter((count) => count >= 2).length / distinctCount > 0.5;

      if (allRepeating || mostRepeating) {
        // Bonus if the header suggests order/customer
        const header = String(headerRow[col] ?? "").trim().toLowerCase();
        const headerBonus = /order|customer|client|ref|account|company|buyer/i.test(header) ? 20 : 0;
        score = 50 + headerBonus + (allRepeating ? 10 : 0);

        if (score > bestScore) {
          bestScore = score;
          bestCol = { colIndex: col, type: "customer" };
        }
      }
    }
  }

  return bestCol;
}

// --- Order separator detection ---

function isOrderSeparator(row: unknown[], totalCols: number, qtyCol?: number): { label: string } | null {
  const cells = row.map((c) => String(c ?? "").trim());
  const nonEmpty = cells.filter((c) => c.length > 0);

  // Very few filled cells relative to total = likely separator
  const fillRatio = nonEmpty.length / Math.max(totalCols, 1);

  // Check first non-empty cell
  const firstNonEmpty = cells.find((c) => c.length > 0) || "";

  // "ORDER <xxx>" pattern
  if (/^ORDER\s+/i.test(firstNonEmpty)) {
    const label = firstNonEmpty.replace(/^ORDER\s+/i, "").replace(/^#/, "").trim();
    return { label: label || firstNonEmpty };
  }

  // "Customer: X" / "Client: X" patterns
  const customerMatch = firstNonEmpty.match(/^(?:customer|client)\s*:\s*(.+)$/i);
  if (customerMatch && nonEmpty.length <= 2) {
    return { label: customerMatch[1].trim() };
  }

  // "Ref: XXX" / "Reference: XXX" patterns
  const refMatch = firstNonEmpty.match(/^(?:ref|reference)\s*:\s*(.+)$/i);
  if (refMatch && nonEmpty.length <= 2) {
    return { label: refMatch[1].trim() };
  }

  // Standalone hex ID (UUID prefix like "876E751E" or "#876E751E")
  if (nonEmpty.length <= 2) {
    const cleaned = firstNonEmpty.replace(/^#/, "");
    if (/^[0-9A-Fa-f]{6,8}$/.test(cleaned)) {
      return { label: cleaned.toUpperCase() };
    }
  }

  // Divider rows — cells containing only dashes, equals, or asterisks
  if (nonEmpty.length >= 1 && nonEmpty.every((c) => /^[-=*]{3,}$/.test(c))) {
    return { label: "---" };
  }

  // Single small number (order separator like "1", "2", "3")
  if (nonEmpty.length === 1 && /^\d+$/.test(firstNonEmpty) && parseInt(firstNonEmpty) > 0 && parseInt(firstNonEmpty) < 100) {
    return { label: firstNonEmpty };
  }

  // Numbered with dot — "1.", "2.", "3." etc.
  if (nonEmpty.length <= 2) {
    const dotNumberMatch = firstNonEmpty.match(/^(\d+)\.\s*(.*)$/);
    if (dotNumberMatch) {
      const num = parseInt(dotNumberMatch[1]);
      if (num > 0 && num < 100) {
        return { label: dotNumberMatch[2]?.trim() || dotNumberMatch[1] };
      }
    }
  }

  // Row with 1-2 cells filled and most empty, where the text doesn't look like a product name
  // (i.e., it's short, or all-caps, or looks like a header/label)
  if (fillRatio <= 0.3 && nonEmpty.length <= 2 && firstNonEmpty.length > 0) {
    // Tighten: if the qty column has a numeric value, this is NOT a separator — it's a product
    if (qtyCol !== undefined && qtyCol >= 0) {
      const qtyVal = cells[qtyCol];
      if (qtyVal && /^\d+(\.\d+)?$/.test(qtyVal) && parseFloat(qtyVal) > 0) {
        return null;
      }
    }

    // Don't treat rows with realistic product names as separators
    // Separators tend to be short labels, email-like, or contain "order"
    const looksLikeLabel = firstNonEmpty.length < 50 && (
      /order/i.test(firstNonEmpty) ||
      /@/.test(firstNonEmpty) || // email
      /^[A-Z0-9\s#_-]+$/.test(firstNonEmpty) || // ALL CAPS or IDs
      /customer/i.test(firstNonEmpty) ||
      /client/i.test(firstNonEmpty) ||
      firstNonEmpty.split(/\s+/).length <= 3 // very few words
    );
    if (looksLikeLabel) {
      return { label: firstNonEmpty };
    }
  }

  return null;
}

// --- Extract items from rows using mappings ---

function extractItemFromRow(row: unknown[], mappings: PackingColumnMapping): PackingListItem | null {
  const nameVal = String(row[mappings.name] ?? "").trim();
  if (!nameVal || nameVal.length < 2) return null;

  // Skip rows that look like just a number (probably a separator/index)
  if (/^\d+$/.test(nameVal) && nameVal.length < 4) return null;

  // Skip subtotal/total/shipping rows
  if (SUBTOTAL_PATTERN.test(nameVal)) return null;

  if (mappings.qty < 0) return null;

  const qtyRaw = row[mappings.qty];
  let quantity = 0;
  if (typeof qtyRaw === "number") {
    quantity = Math.round(qtyRaw);
  } else if (typeof qtyRaw === "string") {
    quantity = parseInt(qtyRaw.replace(/[^\d]/g, "")) || 0;
  }
  if (quantity <= 0) return null;

  // Sanity check: qty shouldn't be absurdly large (likely a code)
  if (quantity > 50000) return null;

  let size: string | null = null;
  if (mappings.size >= 0 && row[mappings.size] !== null && row[mappings.size] !== undefined) {
    const s = String(row[mappings.size]).trim();
    if (s && s !== "0") size = s;
  }

  return { name: normalizeString(nameVal), size, quantity };
}

// --- Build orders from raw data + mappings + separators ---

export function buildOrdersFromRawData(
  rawRows: unknown[][],
  mappings: PackingColumnMapping,
  separators: { rowIndex: number; label: string }[],
  headerRowIndex: number,
): PackingListOrder[] {
  const orders: PackingListOrder[] = [];

  // Adjust separator indices to be relative to rawRows (which starts after headerRow)
  const adjustedSeps = separators
    .map((s) => ({ ...s, relIndex: s.rowIndex - headerRowIndex - 1 }))
    .filter((s) => s.relIndex >= 0);

  if (adjustedSeps.length >= 2) {
    // Multiple orders found via separators
    for (let s = 0; s < adjustedSeps.length; s++) {
      const startRow = adjustedSeps[s].relIndex + 1;
      const endRow = s + 1 < adjustedSeps.length ? adjustedSeps[s + 1].relIndex : rawRows.length;
      const label = adjustedSeps[s].label;

      const items: PackingListItem[] = [];
      for (let r = startRow; r < endRow; r++) {
        if (!rawRows[r]) continue;
        const item = extractItemFromRow(rawRows[r], mappings);
        if (item) items.push(item);
      }

      if (items.length > 0) {
        orders.push({ label, items });
      }
    }
  } else if (adjustedSeps.length === 1) {
    // Single separator - items before and after might be one order, or it's a header
    const items: PackingListItem[] = [];
    for (let r = 0; r < rawRows.length; r++) {
      if (!rawRows[r]) continue;
      // Skip separator rows
      if (adjustedSeps.some((s) => s.relIndex === r)) continue;
      const item = extractItemFromRow(rawRows[r], mappings);
      if (item) items.push(item);
    }
    if (items.length > 0) {
      orders.push({ label: adjustedSeps[0].label || "1", items });
    }
  } else {
    // No separators — all rows as one order
    const items: PackingListItem[] = [];
    for (let r = 0; r < rawRows.length; r++) {
      if (!rawRows[r]) continue;
      const item = extractItemFromRow(rawRows[r], mappings);
      if (item) items.push(item);
    }
    if (items.length > 0) {
      orders.push({ label: "1", items });
    }
  }

  return orders;
}

// --- Multi-qty-column detection (columns per order) ---

function detectMultiQtyColumns(data: unknown[][], headerRowIndex: number, nameCol: number, sizeCol: number): number[] {
  const headerRow = data[headerRowIndex] || [];
  const headers = headerRow.map((c) => String(c ?? "").trim());
  const dataStartRow = headerRowIndex + 1;

  const qtyCols: number[] = [];
  for (let i = 0; i < headers.length; i++) {
    if (i === nameCol || i === sizeCol) continue;
    const header = headers[i];

    // Match known qty patterns or hex order IDs
    const isQtyHeader = matchesAny(header, QTY_PATTERNS);
    const isHexId = /^#?[0-9A-Fa-f]{6,8}$/.test(header.replace(/^#/, ""));
    if (!isQtyHeader && !isHexId) continue;

    // Verify column has reasonable numeric data
    const colStats = analyzeColumn(data, i, dataStartRow, 25);
    if (colStats.numericCount < 2) continue;
    if (colStats.medianNumeric > 5000 || colStats.maxNumeric > 50000) continue;

    qtyCols.push(i);
  }

  return qtyCols;
}

// --- Main parser ---

export function parsePackingList(file: File): Promise<PackingListResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const arrayData = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(arrayData, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

        if (data.length < 2) {
          resolve({ orders: [], headers: [], rawRows: [], columnMappings: { name: 0, size: -1, qty: -1 }, separators: [], headerRowIndex: 0, warnings: ["No data rows found"] });
          return;
        }

        const warnings: string[] = [];
        const headerRowIndex = findHeaderRow(data);
        const detected = detectColumnsSmart(data, headerRowIndex);
        const headers = detected.headers;
        const mappings: PackingColumnMapping = { name: detected.name, size: detected.size, qty: detected.qty };

        if (mappings.name < 0) warnings.push("Could not confidently detect name column");
        if (mappings.qty < 0) warnings.push("Could not confidently detect quantity column");

        // Detect separators in the data rows (after header)
        const totalCols = headers.length;
        const separators: { rowIndex: number; label: string }[] = [];
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;
          const sep = isOrderSeparator(row, totalCols, mappings.qty);
          if (sep) separators.push({ rowIndex: i, label: sep.label });
        }

        const rawRows = data.slice(headerRowIndex + 1);

        // Check for multi-qty-column format (each column = an order)
        const multiQtyCols = detectMultiQtyColumns(data, headerRowIndex, mappings.name, mappings.size);
        if (multiQtyCols.length > 1 && separators.length < 2) {
          // Each qty column is a separate order
          const orders: PackingListOrder[] = [];
          for (const qtyCol of multiQtyCols) {
            const label = headers[qtyCol] || `Column ${qtyCol}`;
            const colMappings: PackingColumnMapping = { name: mappings.name, size: mappings.size, qty: qtyCol };
            const items: PackingListItem[] = [];
            for (const row of rawRows) {
              if (!row) continue;
              if (isOrderSeparator(row, totalCols, qtyCol)) continue;
              const item = extractItemFromRow(row, colMappings);
              if (item) items.push(item);
            }
            if (items.length > 0) {
              orders.push({ label, items });
            }
          }
          // Use first qty col as the primary mapping
          mappings.qty = multiQtyCols[0];
          resolve({ orders, headers, rawRows, columnMappings: mappings, separators, headerRowIndex, warnings });
          return;
        }

        // Check for order/customer column-based grouping (priority over separators)
        const orderCol = detectOrderColumn(data, headerRowIndex, mappings.name, mappings.size, mappings.qty);
        if (orderCol) {
          const groups = new Map<string, unknown[][]>();
          const groupOrder: string[] = [];

          for (const row of rawRows) {
            if (!row) continue;
            // Skip separator rows
            if (isOrderSeparator(row, totalCols, mappings.qty)) continue;

            const val = String(row[orderCol.colIndex] ?? "").trim();
            if (!val) continue;

            // Clean up the group key — strip # prefix for hex IDs
            let key = val;
            if (orderCol.type === "orderId") {
              key = val.replace(/^#/, "").toUpperCase();
            }

            if (!groups.has(key)) {
              groups.set(key, []);
              groupOrder.push(key);
            }
            groups.get(key)!.push(row);
          }

          if (groups.size >= 2) {
            const orders: PackingListOrder[] = [];
            for (const key of groupOrder) {
              const rows = groups.get(key)!;
              const items: PackingListItem[] = [];
              for (const row of rows) {
                const item = extractItemFromRow(row, mappings);
                if (item) items.push(item);
              }
              if (items.length > 0) {
                orders.push({ label: key, items });
              }
            }

            if (orders.length >= 2) {
              resolve({ orders, headers, rawRows, columnMappings: mappings, separators, headerRowIndex, warnings });
              return;
            }
          }
        }

        // Build orders using separator-based splitting
        const orders = buildOrdersFromRawData(rawRows, mappings, separators, headerRowIndex);

        resolve({ orders, headers, rawRows, columnMappings: mappings, separators, headerRowIndex, warnings });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
