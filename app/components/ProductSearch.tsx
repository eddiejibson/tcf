"use client";

import { useState, useMemo } from "react";

export interface ProductSearchItem {
  id: string;
  name: string;
  latinName?: string | null;
  variant?: string | null;
  size?: string | null;
  price?: number;
}

interface ProductSearchProps {
  products: ProductSearchItem[];
  onSelect: (product: ProductSearchItem) => void;
  compact?: boolean;
  placeholder?: string;
}

export default function ProductSearch({ products, onSelect, compact = false, placeholder = "Search products..." }: ProductSearchProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 30);
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.latinName && p.latinName.toLowerCase().includes(q)) ||
        (p.variant && p.variant.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q)),
    ).slice(0, 30);
  }, [products, query]);

  return (
    <div>
      <div className="relative mb-2">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/25 focus:outline-none focus:border-[#0984E3]/50 text-sm ${compact ? "py-1.5 text-xs" : "py-2"}`}
        />
      </div>
      <div className={`overflow-auto space-y-0.5 ${compact ? "max-h-48" : "max-h-60"}`}>
        {filtered.length === 0 && (
          <p className="text-white/20 text-xs py-3 text-center">No products match</p>
        )}
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => { onSelect(p); setQuery(""); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
          >
            <div className="min-w-0 flex-1">
              <span className="text-white/80 text-sm">{p.name}</span>
              {(p.latinName || p.variant || p.size) && (
                <span className="text-white/30 text-xs ml-2">
                  {[p.latinName && <em key="l">{p.latinName}</em>, p.variant, p.size].filter(Boolean).map((v, i) => (
                    <span key={i}>{i > 0 ? " · " : ""}{v}</span>
                  ))}
                </span>
              )}
            </div>
            <svg className="w-4 h-4 text-white/10 group-hover:text-white/30 shrink-0 ml-2 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          </button>
        ))}
      </div>
    </div>
  );
}
