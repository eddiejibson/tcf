// Fractional-bag maths. A box is divided into fraction bags (1/12, 1/6, 1/8, …); each fish has a
// per-fraction headcount. Customers order whole bags, which should add up to whole boxes.

export interface PackOption {
  fraction: string;
  headcount: number;
}

/** Numeric value of a fraction label, e.g. "1/12" → 0.0833. Returns 0 if unparseable. */
export function fractionValue(fraction: string): number {
  const [n, d] = fraction.split("/").map((x) => parseInt(x, 10));
  if (!d || isNaN(n) || isNaN(d)) return 0;
  return n / d;
}

/** bags selected for one product: { "1/12": 2, "1/6": 1 } */
export type BagSelection = Record<string, number>;

/** Total fish for a selection (Σ bags × per-bag headcount). */
export function bagHeadcount(packOptions: PackOption[], sel: BagSelection): number {
  let total = 0;
  for (const opt of packOptions) total += (sel[opt.fraction] || 0) * opt.headcount;
  return total;
}

/** Box-space consumed by a selection, in boxes (Σ bags × fraction value). */
export function bagBoxFill(packOptions: PackOption[], sel: BagSelection): number {
  let fill = 0;
  for (const opt of packOptions) fill += (sel[opt.fraction] || 0) * fractionValue(opt.fraction);
  return Math.round(fill * 1e6) / 1e6;
}

/** Total bags in a selection. */
export function bagCount(sel: BagSelection): number {
  let n = 0;
  for (const k in sel) n += sel[k] || 0;
  return n;
}

export function hasAnyBags(sel: BagSelection | undefined): boolean {
  if (!sel) return false;
  for (const k in sel) if ((sel[k] || 0) > 0) return true;
  return false;
}

// --- Parsing helpers (shared by the Excel parser and the client column-remap) ---

// Pack-fraction column headers like "1/6 Qty", "1/12 Qty", "1/8", "1/4 bag" — the number of fish
// that fit in a fraction-of-a-box bag. The fraction set varies by supplier, so this stays generic.
export const PACK_FRACTION_RE = /^\s*(\d{1,2})\s*\/\s*(\d{1,3})\s*(?:th)?\s*(?:qty|quantity|pcs|pieces|bag|bags|box)?\s*$/i;

export function detectPackColumns(headers: string[]): { colIndex: number; fraction: string; denom: number }[] {
  const cols: { colIndex: number; fraction: string; denom: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const m = String(headers[i] || "").trim().match(PACK_FRACTION_RE);
    if (!m) continue;
    const num = parseInt(m[1], 10);
    const denom = parseInt(m[2], 10);
    if (denom >= 2 && num >= 1 && num <= denom) cols.push({ colIndex: i, fraction: `${num}/${denom}`, denom });
  }
  return cols;
}

export function packOptionsFromRow(row: unknown[], packCols: { colIndex: number; fraction: string }[]): PackOption[] {
  const out: PackOption[] = [];
  for (const c of packCols) {
    const raw = row[c.colIndex];
    const n = typeof raw === "number" ? Math.round(raw) : parseInt(String(raw ?? "").replace(/[^\d]/g, ""), 10);
    if (!isNaN(n) && n > 0) out.push({ fraction: c.fraction, headcount: n });
  }
  return out;
}

/** Legacy single qtyPerBox = fish per FULL box, derived from the first bag (headcount × denominator). */
export function qtyPerBoxFromPacks(packOptions: PackOption[]): number | null {
  if (!packOptions.length) return null;
  const d = parseInt(packOptions[0].fraction.split("/")[1], 10);
  return d > 0 ? packOptions[0].headcount * d : null;
}
