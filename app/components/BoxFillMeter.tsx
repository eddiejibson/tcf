"use client";

// Mirrors the supplier's "Box %" widget: shows how full the boxes are so customers pack whole
// boxes and don't pay freight on half-empty ones.
export default function BoxFillMeter({ boxFill }: { boxFill: number }) {
  if (boxFill <= 0) return null;
  const boxesUsed = Math.ceil(boxFill);
  const partial = boxFill - Math.floor(boxFill);
  const isWhole = partial < 1e-6;
  const currentPct = isWhole ? 100 : Math.round(partial * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Box fill</p>
        <p className="text-white/60 text-xs tabular-nums">
          {boxesUsed} box{boxesUsed !== 1 ? "es" : ""}
          {!isWhole && <span className="text-white/35"> · box {boxesUsed} {currentPct}% full</span>}
        </p>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isWhole ? "bg-emerald-400" : "bg-[#0984E3]"}`}
          style={{ width: `${currentPct}%` }}
        />
      </div>
      {isWhole ? (
        <p className="text-emerald-400/70 text-[10px] mt-1">All boxes packed full</p>
      ) : (
        <p className="text-amber-400/60 text-[10px] mt-1">{100 - currentPct}% of box {boxesUsed} still free. Top up to avoid paying for air.</p>
      )}
    </div>
  );
}
