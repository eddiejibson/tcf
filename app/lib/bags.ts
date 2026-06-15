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
