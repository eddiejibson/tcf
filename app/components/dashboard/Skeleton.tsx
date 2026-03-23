"use client";

function SkeletonBase({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-white/[0.06] ${className ?? ""}`}
    >
      <div className="absolute inset-0 skeleton-shimmer" />
    </div>
  );
}

export function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <SkeletonBase className="h-4" style-width={width} />;
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <SkeletonBase className={`h-24 ${className ?? ""}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-3">
      <SkeletonBase className="h-4 w-2/3" />
      <SkeletonBase className="h-3 w-1/2" />
      <SkeletonBase className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonOrderList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex items-center gap-4"
        >
          <SkeletonBase className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonBase className="h-4 w-1/3" />
            <SkeletonBase className="h-3 w-1/2" />
          </div>
          <SkeletonBase className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBase key={i} className="h-4" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 py-2"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonBase key={c} className="h-3" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonShipmentGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function DashboardLoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#0984E3] animate-spin" />
        </div>
        <span className="text-white/30 text-sm">Loading...</span>
      </div>
    </div>
  );
}
