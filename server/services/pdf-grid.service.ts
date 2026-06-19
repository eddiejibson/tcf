// Turns a PDF buffer into a faithful 2-D cell grid (unknown[][]) — the same shape
// XLSX.utils.sheet_to_json(sheet, { header: 1 }) produces — so the existing
// shipment parser (buildShipmentFromGrid) can consume PDFs with zero changes to
// its column-detection/extraction logic.
//
// The hard part of PDFs is that they carry no table structure: just text fragments
// at (x, y) coordinates. We rebuild the table geometrically:
//   1. group fragments into rows by their y (baseline) position,
//   2. find the column-header row,
//   3. detect side-by-side tables ("bands") by spotting the header labels
//      repeating horizontally (real supplier packing lists print 2 tables per page),
//   4. within each band, derive column anchors (header cells refined by the
//      left-edges of the data below) and snap every fragment to a column,
//   5. stack the bands (left table, then right table) across every page.
//
// It deliberately knows nothing about fish/prices/boxes — it only reconstructs a
// grid. All domain logic stays in the shared parser.

import type { ParsedShipment, ColumnMapping } from "@/app/lib/types";
import { buildShipmentFromGrid } from "./excel-parser.service";

type Item = { str: string; x: number; y: number; w: number; h: number };
type Cell = { x: number; text: string };

// Header keywords used both to locate the header row and to detect repeating
// side-by-side tables. Intentionally broad — matches price lists and packing lists.
const HEADER_KEYWORDS =
  /\b(code|name|common|scientific|latin|species|item|product|description|desc|price|cost|each|unit|amount|qty|quantity|pcs|pieces|stock|available|size|grade|box|variant|colou?r)\b/i;

// ---- pdfjs loader -----------------------------------------------------------

// Dynamically import the legacy build so Next's bundler never tries to pull the
// browser worker into the server bundle. Cached after first load.
let pdfjsLib: typeof import("pdfjs-dist/legacy/build/pdf.mjs") | null = null;
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsLib;
}

// ---- geometry helpers -------------------------------------------------------

// Cluster fragments into visual rows by y. Tolerance adapts to the document's own
// line spacing so dense and airy PDFs both split correctly.
function groupRows(items: Item[]): Item[][] {
  if (items.length === 0) return [];
  const ys = [...new Set(items.map((i) => Math.round(i.y * 2) / 2))].sort((a, b) => b - a);
  const gaps: number[] = [];
  for (let i = 1; i < ys.length; i++) gaps.push(ys[i - 1] - ys[i]);
  const positive = gaps.filter((g) => g > 0.5).sort((a, b) => a - b);
  const median = positive.length ? positive[Math.floor(positive.length / 2)] : 6;
  const tol = Math.min(6, Math.max(2, median * 0.5));

  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: Item[][] = [];
  let cur: Item[] | null = null;
  let curY = 0;
  for (const it of sorted) {
    if (!cur || Math.abs(curY - it.y) > tol) {
      cur = [];
      rows.push(cur);
      curY = it.y;
    }
    cur.push(it);
    // Track the row's running baseline (mean) so a tall cell doesn't drift it.
    curY = (curY * (cur.length - 1) + it.y) / cur.length;
  }
  for (const r of rows) r.sort((a, b) => a.x - b.x);
  return rows;
}

// Merge fragments that sit flush against each other into a single cell value.
// A new cell starts only when the horizontal gap to the previous fragment is
// large relative to the text height (i.e. a real column gutter, not a word space).
function mergeFragments(frags: Item[], gutter: number): Cell[] {
  const cells: Cell[] = [];
  let curText = "";
  let curX = 0;
  let prevEnd = -Infinity;
  for (const f of frags) {
    const gap = f.x - prevEnd;
    if (curText === "") {
      curText = f.str;
      curX = f.x;
    } else if (gap > gutter) {
      cells.push({ x: curX, text: curText.trim() });
      curText = f.str;
      curX = f.x;
    } else {
      // same cell — preserve an explicit space only when fragments don't already touch
      curText += gap > 1 && !curText.endsWith(" ") && !f.str.startsWith(" ") ? " " + f.str : f.str;
    }
    prevEnd = f.x + f.w;
  }
  if (curText.trim()) cells.push({ x: curX, text: curText.trim() });
  return cells;
}

// Score a row by how header-like it is (count of distinct header keywords it carries).
function headerScore(frags: Item[]): number {
  const text = frags.map((f) => f.str).join(" ");
  const hits = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(HEADER_KEYWORDS.source, "gi");
  while ((m = re.exec(text))) hits.add(m[0].toLowerCase());
  return hits.size;
}

// Find the most header-like row in the page (needs >=3 keyword hits to count).
function findHeaderRowIdx(rows: Item[][]): number {
  let best = -1;
  let bestScore = 2;
  for (let i = 0; i < rows.length; i++) {
    const s = headerScore(rows[i]);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return best;
}

// Gutter width that separates header columns into cells. It must sit *between* a
// word-space (~quarter of the text height) and a real column gap. Side-by-side
// tables can butt up close — a right-aligned Qty column can end only ~9px before
// the next table's first column — so we keep this tight (a fraction of the text
// height) rather than ~1 full character, which would weld the two tables together.
function estimateGutter(frags: Item[]): number {
  const medH = frags.map((f) => f.h).sort((a, b) => a - b)[Math.floor(frags.length / 2)] || 10;
  return Math.min(7, Math.max(4, medH * 0.45));
}

// Detect N side-by-side tables by finding the period at which the header labels
// repeat horizontally. Returns the x-split boundaries (band starts), or a single
// band when the header doesn't repeat.
function detectBands(headerCells: Cell[]): { start: number; end: number }[] {
  const single = [{ start: -Infinity, end: Infinity }];
  const n = headerCells.length;
  if (n < 4) return single;

  const norm = headerCells.map((c) => c.text.toLowerCase().replace(/\s+/g, " ").trim());
  for (let p = 2; p <= Math.floor(n / 2); p++) {
    if (n % p !== 0) continue;
    const cycles = n / p;
    if (cycles < 2) continue;
    let repeats = true;
    for (let i = 0; i + p < n; i++) {
      if (norm[i] !== norm[i + p]) {
        repeats = false;
        break;
      }
    }
    if (!repeats) continue;
    // Require the cycle starts to be horizontally well separated (real tables, not
    // an accidental short period within one table).
    const starts: number[] = [];
    for (let k = 0; k < cycles; k++) starts.push(headerCells[k * p].x);
    let separated = true;
    for (let k = 1; k < starts.length; k++) if (starts[k] - starts[k - 1] < 60) separated = false;
    if (!separated) continue;

    const bands: { start: number; end: number }[] = [];
    for (let k = 0; k < cycles; k++) {
      const start = k === 0 ? -Infinity : starts[k] - 6;
      const end = k === cycles - 1 ? Infinity : starts[k + 1] - 6;
      bands.push({ start, end });
    }
    return bands;
  }
  return single;
}

// Build the column anchors for a band: start from the header cell x-positions, then
// pull each anchor toward the left-edges of the data fragments that align under it
// (averages out header jitter / fragment splits). Anchors with no data are kept
// (e.g. a Qty column that's empty in a short box) so columns stay aligned.
function buildAnchors(headerCells: Cell[], dataFrags: Item[]): number[] {
  let anchors = headerCells.map((c) => c.x).sort((a, b) => a - b);
  if (anchors.length === 0) {
    // No header in band — cluster data left-edges into columns.
    const xs = dataFrags.map((f) => f.x).sort((a, b) => a - b);
    const clusters: number[][] = [];
    for (const x of xs) {
      const last = clusters[clusters.length - 1];
      if (last && x - last[last.length - 1] < 14) last.push(x);
      else clusters.push([x]);
    }
    anchors = clusters
      .filter((c) => c.length >= Math.max(2, dataFrags.length * 0.03))
      .map((c) => c.reduce((s, v) => s + v, 0) / c.length);
    return anchors;
  }
  // Refine: snap data left-edges to nearest anchor, then recompute as their mean.
  const sums = anchors.map(() => 0);
  const counts = anchors.map(() => 0);
  for (const f of dataFrags) {
    let best = 0;
    let bestD = Infinity;
    for (let a = 0; a < anchors.length; a++) {
      const d = Math.abs(f.x - anchors[a]);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    // Only let a fragment pull an anchor if it's plausibly the start of that cell.
    if (bestD < 40) {
      sums[best] += f.x;
      counts[best] += 1;
    }
  }
  return anchors.map((a, i) => (counts[i] >= 3 ? sums[i] / counts[i] : a));
}

// Assign each fragment in a row to the column whose anchor it's nearest to (by
// left-edge), then join fragments within a column.
function rowToCells(frags: Item[], anchors: number[]): string[] {
  const buckets: Item[][] = anchors.map(() => []);
  for (const f of frags) {
    let best = 0;
    let bestD = Infinity;
    for (let a = 0; a < anchors.length; a++) {
      const d = Math.abs(f.x - anchors[a]);
      if (d < bestD) {
        bestD = d;
        best = a;
      }
    }
    buckets[best].push(f);
  }
  return buckets.map((b) => {
    if (b.length === 0) return "";
    b.sort((a, c) => a.x - c.x);
    let text = "";
    let prevEnd = -Infinity;
    for (const f of b) {
      const gap = f.x - prevEnd;
      text += text === "" ? f.str : gap > 1 && !text.endsWith(" ") && !f.str.startsWith(" ") ? " " + f.str : f.str;
      prevEnd = f.x + f.w;
    }
    return text.trim();
  });
}

// ---- main -------------------------------------------------------------------

// Thrown for problems the uploader can act on (vs. an internal bug). The route
// surfaces the message to the admin instead of a generic "failed to parse".
export class PdfParseError extends Error {
  readonly userFacing = true;
  constructor(message: string) {
    super(message);
    this.name = "PdfParseError";
  }
}

export async function pdfBufferToGrid(buffer: Buffer | ArrayBuffer): Promise<unknown[][]> {
  const { getDocument } = await getPdfjs();
  const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  let doc;
  try {
    doc = await getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
      // text extraction only — no rendering, so no canvas needed
    }).promise;
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === "PasswordException") throw new PdfParseError("This PDF is password-protected. Remove the password and upload it again.");
    if (name === "InvalidPDFException") throw new PdfParseError("This file isn't a readable PDF. Re-export it and try again.");
    throw e;
  }

  const grid: unknown[][] = [];

  // Collected per band so we stack left-table rows then right-table rows.
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const items: Item[] = tc.items
      .map((it) => {
        const t = it as { str?: string; transform?: number[]; width?: number; height?: number };
        return {
          str: t.str ?? "",
          x: t.transform ? t.transform[4] : 0,
          y: t.transform ? t.transform[5] : 0,
          w: t.width ?? 0,
          h: t.height ?? Math.abs(t.transform?.[3] ?? 8),
        };
      })
      .filter((i) => i.str && i.str.trim() !== "");
    page.cleanup?.();
    if (items.length === 0) continue;

    const rows = groupRows(items);
    const headerIdx = findHeaderRowIdx(rows);
    const headerFrags = headerIdx >= 0 ? rows[headerIdx] : [];
    const gutter = headerFrags.length ? estimateGutter(headerFrags) : 8;
    const headerCells = mergeFragments(headerFrags, gutter);
    const bands = detectBands(headerCells);

    for (const band of bands) {
      const inBand = (x: number) => x >= band.start && x < band.end;
      const bandHeaderCells = headerCells.filter((c) => inBand(c.x));
      const dataFrags = rows
        .filter((_, i) => i > headerIdx)
        .flat()
        .filter((f) => inBand(f.x));
      const anchors = buildAnchors(bandHeaderCells, dataFrags);
      if (anchors.length === 0) continue;

      for (let i = 0; i < rows.length; i++) {
        const frags = rows[i].filter((f) => inBand(f.x));
        if (frags.length === 0) continue;
        const cells = rowToCells(frags, anchors);
        if (cells.some((c) => c !== "")) grid.push(cells);
      }
    }
  }

  await doc.destroy?.();
  return grid;
}

// Reduce a reconstructed PDF grid to just the product table: the column-header row
// plus rows that carry a real positive quantity. PDFs interleave letterhead, footers,
// repeated headers, box markers and per-box totals between products; the packing-list
// parser would read those sparse rows as order separators and fragment/drop the list.
// A packing list always states a quantity per item, so that's the reliable keep signal.
export function pdfPackingTableRows(grid: unknown[][]): unknown[][] {
  let headerIdx = -1;
  let bestScore = 1;
  const kw = new RegExp(HEADER_KEYWORDS.source, "gi");
  for (let i = 0; i < Math.min(grid.length, 40); i++) {
    const text = (grid[i] || []).map((c) => String(c ?? "")).join(" ");
    const score = (text.match(kw) || []).length;
    if (score > bestScore) {
      bestScore = score;
      headerIdx = i;
    }
  }
  if (headerIdx === -1) return grid;

  const header = grid[headerIdx] as unknown[];
  const qtyCol = header.findIndex((c) => /\b(qty|quantity|pcs|pieces|count|units?)\b/i.test(String(c ?? "")));
  if (qtyCol === -1) return grid;

  const out: unknown[][] = [header];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i] || [];
    // Skip per-box / grand totals — they carry a number but aren't products.
    if (row.some((c) => /^(sub[\s-]?total|grand[\s-]?total|total)\b/i.test(String(c ?? "").trim()))) continue;
    const q = String(row[qtyCol] ?? "").trim();
    if (/^\d+$/.test(q) && parseInt(q) > 0) out.push(row);
  }
  return out;
}

// Parse a PDF price/packing list into a ParsedShipment by reconstructing its grid
// and running it through the same column-detection pipeline Excel uploads use.
export async function parsePdfBuffer(
  buffer: Buffer | ArrayBuffer,
  filename?: string,
  columnOverrides?: Partial<ColumnMapping>,
): Promise<ParsedShipment> {
  const grid = await pdfBufferToGrid(buffer);
  if (grid.length === 0) {
    throw new PdfParseError("No selectable text found in this PDF — it may be a scanned image. Upload the Excel version instead.");
  }
  return buildShipmentFromGrid(grid, filename, columnOverrides);
}
