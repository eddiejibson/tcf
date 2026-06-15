// Per-shipment currency label. Free text set by admin (e.g. "£", "$", "GBP", "USD").
// When unset, everything falls back to "£" so existing shipments are unchanged.

export const DEFAULT_CURRENCY = "£";

/**
 * Format a money amount with a shipment's currency label.
 * - A symbol (no letters) hugs the number: "£12.34", "$12.34".
 * - An alphabetic code gets a trailing space: "GBP 12.34", "USD 12.34".
 * - Unset/blank → "£12.34" (unchanged default).
 */
export function formatMoney(amount: number | string, currency?: string | null): string {
  const n = Number(amount).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cur = (currency ?? "").trim();
  if (!cur) return `${DEFAULT_CURRENCY}${n}`;
  return /[a-z]/i.test(cur) ? `${cur} ${n}` : `${cur}${n}`;
}

/** Excel number-format string for a currency label, e.g. `"£"#,##0.00` or `"GBP "#,##0.00`. */
export function excelMoneyFormat(currency?: string | null): string {
  const cur = (currency ?? "").trim() || DEFAULT_CURRENCY;
  const prefix = /[a-z]/i.test(cur) ? `${cur} ` : cur;
  return `"${prefix}"#,##0.00`;
}

/** Normalise a currency label for comparison/display (blank → "£"). */
export function resolveCurrency(currency?: string | null): string {
  return (currency ?? "").trim() || DEFAULT_CURRENCY;
}

/**
 * The freight/logistics currency: its own label if set, otherwise the item currency, otherwise £.
 * Lets a shipment price freight in a different currency from its items.
 */
export function resolveFreightCurrency(itemCurrency?: string | null, freightCurrency?: string | null): string {
  return (freightCurrency ?? "").trim() || resolveCurrency(itemCurrency);
}

/** True when item and freight currencies resolve to the same label (the common single-currency case). */
export function sameCurrency(itemCurrency?: string | null, freightCurrency?: string | null): boolean {
  return resolveCurrency(itemCurrency) === resolveFreightCurrency(itemCurrency, freightCurrency);
}
