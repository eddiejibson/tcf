"use client";

import { bagHeadcount, bagBoxFill, bagCount, type PackOption, type BagSelection } from "@/app/lib/bags";
import { formatMoney } from "@/app/lib/currency";

function toTitleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function Stepper({ value, onChange, disabled }: { value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const btn =
    "w-7 h-7 rounded-lg flex items-center justify-center text-white/70 bg-white/5 hover:bg-white/10 active:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all";
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={btn} onClick={() => onChange(Math.max(0, value - 1))} disabled={disabled || value <= 0} aria-label="Remove bag">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M5 12h14" /></svg>
      </button>
      <span className="w-6 text-center text-white text-sm font-semibold tabular-nums">{value}</span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled} aria-label="Add bag">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

interface Props {
  name: string;
  latinName?: string | null;
  size?: string | null;
  variant?: string | null;
  unitPrice: number; // already discounted
  packOptions: PackOption[];
  bags: BagSelection;
  onChange: (fraction: string, next: number) => void;
  unavailable?: boolean;
  currency?: string | null;
}

export default function ProductBagCard({ name, latinName, size, variant, unitPrice, packOptions, bags, onChange, unavailable, currency }: Props) {
  const fish = bagHeadcount(packOptions, bags);
  const fill = bagBoxFill(packOptions, bags);
  const bagsN = bagCount(bags);
  const lineTotal = fish * unitPrice;
  const active = bagsN > 0;
  const fmt = (n: number) => formatMoney(n, currency);

  return (
    <div className={`px-4 md:px-5 py-3.5 transition-colors ${unavailable ? "opacity-30" : active ? "bg-[#0984E3]/5" : "hover:bg-white/[0.02]"}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-white/90 text-[13px] leading-snug font-semibold">{toTitleCase(name)}</p>
            {unavailable && <span className="text-red-400/80 text-[10px] uppercase tracking-wider font-medium">Unavailable</span>}
          </div>
          {latinName && <p className="text-white/30 text-[11px] italic mt-0.5">{latinName}</p>}
          {(variant || size) && (
            <p className="text-white/40 text-[11px] mt-0.5">{[variant, size].filter(Boolean).join(" / ")}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-white/90 text-sm font-semibold tabular-nums">{fmt(unitPrice)}</p>
          <p className="text-white/30 text-[10px] uppercase tracking-wider">each</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {packOptions.map((opt) => {
          const n = bags[opt.fraction] || 0;
          return (
            <div
              key={opt.fraction}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all ${
                n > 0 ? "bg-[#0984E3]/10 border-[#0984E3]/40" : "bg-white/[0.03] border-white/10"
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span className="text-white text-sm font-semibold leading-none">{opt.fraction === "1/1" ? "Full box" : `${opt.fraction} bag`}</span>
                <span className="text-white/40 text-[11px] mt-1">{opt.headcount} fish</span>
              </div>
              <div className="ml-auto">
                <Stepper value={n} onChange={(v) => onChange(opt.fraction, v)} disabled={unavailable} />
              </div>
            </div>
          );
        })}
      </div>

      {active && (
        <div className="mt-2.5 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px]">
          <span className="text-white/50">{bagsN} bag{bagsN !== 1 ? "s" : ""}</span>
          <span className="text-white/30">·</span>
          <span className="text-white/50 tabular-nums">{fish} fish</span>
          <span className="text-white/30">·</span>
          <span className="text-white/50 tabular-nums">{fill.toFixed(2)} box</span>
          <span className="ml-auto text-[#0984E3] text-sm font-semibold tabular-nums">{fmt(lineTotal)}</span>
        </div>
      )}
    </div>
  );
}
