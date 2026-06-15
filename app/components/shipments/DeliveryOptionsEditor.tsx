"use client";

import type { DeliveryOption } from "@/app/lib/delivery";
import { DEFAULT_CURRENCY } from "@/app/lib/currency";

function unitText(o: DeliveryOption): string {
  switch (o.basis) {
    case "per_box": return "per box";
    case "per_mile": return "per mile";
    case "per_item": return "per item";
    case "per_order": return "flat";
    case "percent": return "% of goods";
    default: return "";
  }
}

// Per-shipment delivery setup. Every method is optional: untick any (or all) of them.
// Rates feed the per-order packing review; the customer sees only the final delivery line.
export default function DeliveryOptionsEditor({
  options,
  onChange,
  currency,
}: {
  options: DeliveryOption[];
  onChange: (options: DeliveryOption[]) => void;
  currency?: string | null;
}) {
  const sym = (currency ?? "").trim() || DEFAULT_CURRENCY;
  const update = (id: string, patch: Partial<DeliveryOption>) =>
    onChange(options.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  const anyOn = options.some((o) => o.enabled);

  return (
    <div className="space-y-2">
      {options.map((o) => (
        <div
          key={o.id}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
            o.enabled ? "bg-[#0984E3]/5 border-[#0984E3]/30" : "bg-white/[0.02] border-white/10"
          }`}
        >
          <label className="flex items-center gap-2.5 cursor-pointer min-w-0 flex-1">
            <input
              type="checkbox"
              checked={!!o.enabled}
              onChange={(e) => update(o.id, { enabled: e.target.checked })}
              className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer shrink-0"
            />
            <span className={`text-sm font-medium truncate ${o.enabled ? "text-white" : "text-white/50"}`}>{o.label}</span>
          </label>
          {o.basis === "per_order" && o.rate === 0 ? (
            <span className="text-white/40 text-xs shrink-0">Free</span>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-white/40 text-sm">{sym}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={o.rate}
                disabled={!o.enabled}
                onChange={(e) => update(o.id, { rate: parseFloat(e.target.value) || 0 })}
                className="w-20 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right tabular-nums focus:outline-none focus:border-[#0984E3]/50 disabled:opacity-40"
              />
              <span className="text-white/40 text-xs w-16">{unitText(o)}</span>
            </div>
          )}
        </div>
      ))}
      <p className="text-white/30 text-[11px] mt-1">
        {anyOn
          ? "Set per order at packing review. The customer sees the final delivery line on their order."
          : "Delivery is off for this shipment. Orders will not carry a delivery charge."}
      </p>
    </div>
  );
}
