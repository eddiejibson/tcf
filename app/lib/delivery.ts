// Pure, client- and server-safe delivery pricing model.
//
// Delivery is intentionally flexible: a shipment can offer any mix of methods,
// each with its own calculation basis (per box, per mile, flat, per item, % of goods).
// Customers pick one OR more (e.g. door delivery + mileage). On the cart the amount is
// an ESTIMATE; the final figure is confirmed by an admin at packing-list review — the
// same pattern freight already uses, because final box count / mileage land then.

import { formatMoney } from "./currency";

export type DeliveryBasis = "per_box" | "per_mile" | "per_order" | "per_item" | "percent";

export interface DeliveryTier {
  /** Applies when boxes >= minBoxes. Highest matching minBoxes wins (volume discount). */
  minBoxes: number;
  rate: number;
}

export interface DeliveryOption {
  id: string;
  label: string;
  basis: DeliveryBasis;
  /** £ per unit (box/mile/item), flat £ (per_order), or a percentage (percent). */
  rate: number;
  /** Whether this shipment offers the method. */
  enabled?: boolean;
  unitLabel?: string;
  /** Optional volume pricing for per_box, e.g. cheaper per-box rate at 5+ boxes. */
  tiers?: DeliveryTier[];
  /** Customer must supply a value (e.g. miles) before this can be priced. */
  requiresInput?: boolean;
  inputLabel?: string;
  /** Small print shown under the option, e.g. "Price to be confirmed". */
  note?: string;
}

export interface DeliveryContext {
  boxes: number;
  miles: number;
  itemCount: number;
  goods: number;
}

// Default last-mile rates. Door = £30 per box (volume discounts can be layered on later);
// mileage = £1 per mile, one way. Kept here as the single source of truth.
export const DELIVERY_DOOR_RATE = 30;
export const DELIVERY_MILE_RATE = 1;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Resolve the per-box rate, honouring volume-discount tiers when present. */
export function perBoxRate(opt: DeliveryOption, boxes: number): number {
  if (!opt.tiers?.length) return opt.rate;
  let rate = opt.rate;
  let best = -1;
  for (const t of opt.tiers) {
    if (boxes >= t.minBoxes && t.minBoxes > best) {
      best = t.minBoxes;
      rate = t.rate;
    }
  }
  return rate;
}

export function computeDeliveryAmount(opt: DeliveryOption, ctx: DeliveryContext): number {
  switch (opt.basis) {
    case "per_box":
      return round2(perBoxRate(opt, ctx.boxes) * Math.max(0, ctx.boxes));
    case "per_mile":
      return round2(opt.rate * Math.max(0, ctx.miles));
    case "per_item":
      return round2(opt.rate * Math.max(0, ctx.itemCount));
    case "per_order":
      return round2(opt.rate);
    case "percent":
      return round2((ctx.goods * opt.rate) / 100);
    default:
      return 0;
  }
}

/**
 * Sum the selected delivery methods. `hasUnconfirmed` is true when a selected
 * method still needs input (e.g. mileage with no distance) or can't be priced
 * yet (per-box before the box count is known) — the UI flags these as "~"/TBC.
 */
export function computeDeliveryTotal(
  options: DeliveryOption[],
  selectedIds: string[],
  miles: Record<string, number>,
  base: Omit<DeliveryContext, "miles">,
): { amount: number; hasUnconfirmed: boolean } {
  let amount = 0;
  let hasUnconfirmed = false;
  for (const id of selectedIds) {
    const opt = options.find((o) => o.id === id);
    if (!opt) continue;
    const m = miles[id] ?? 0;
    if (opt.requiresInput && m <= 0) hasUnconfirmed = true;
    if (opt.basis === "per_box" && base.boxes <= 0) hasUnconfirmed = true;
    amount += computeDeliveryAmount(opt, { ...base, miles: m });
  }
  return { amount: round2(amount), hasUnconfirmed };
}

export function deliveryRateLabel(opt: DeliveryOption, currency?: string | null): string {
  const amt = formatMoney(opt.rate, currency);
  switch (opt.basis) {
    case "per_box":
      return `${amt} per box`;
    case "per_mile":
      return `${amt} per mile`;
    case "per_item":
      return `${amt} per item`;
    case "per_order":
      return `${amt} flat`;
    case "percent":
      return `${opt.rate}% of goods`;
    default:
      return "";
  }
}

/**
 * Sensible defaults so the feature works with zero per-shipment config.
 * A shipment can later carry its own `deliveryOptions` to override these.
 */
export const DEFAULT_DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: "door",
    label: "Delivery to your door",
    basis: "per_box",
    rate: 30,
    enabled: true,
    unitLabel: "box",
    note: "discounts on multiple boxes",
  },
  {
    id: "mileage",
    label: "Mileage",
    basis: "per_mile",
    rate: 1,
    enabled: true,
    unitLabel: "mile",
    requiresInput: true,
    inputLabel: "miles, one way",
    note: "one way · price confirmed at review",
  },
  {
    id: "collection",
    label: "Collection (free)",
    basis: "per_order",
    rate: 0,
    enabled: false,
    note: "customer collects in person",
  },
];

/** Stored options if present, else the sensible defaults (back-compat for old shipments). */
export function resolveDeliveryOptions(stored: DeliveryOption[] | null | undefined): DeliveryOption[] {
  return stored && stored.length ? stored : DEFAULT_DELIVERY_OPTIONS;
}

export function deliveryRate(options: DeliveryOption[] | null | undefined, id: string, fallback: number): number {
  const o = resolveDeliveryOptions(options).find((x) => x.id === id);
  return o && typeof o.rate === "number" ? o.rate : fallback;
}

export function deliveryEnabled(options: DeliveryOption[] | null | undefined, id: string): boolean {
  const o = resolveDeliveryOptions(options).find((x) => x.id === id);
  return !!o?.enabled;
}
