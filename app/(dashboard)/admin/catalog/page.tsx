"use client";

import CategoryPicker from "@/app/components/CategoryPicker";
import type { CatalogProductListItem, CategoryNode } from "@/app/lib/types";
import { generatePriceList, type PriceListProduct } from "@/app/lib/generate-price-list";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

const stockLevelColors: Record<string, string> = {
  LOW: "bg-amber-500/20 text-amber-400",
  AVERAGE: "bg-green-500/20 text-green-400",
  HIGH: "bg-green-500/20 text-green-400",
  OUT_OF_STOCK: "bg-red-500/30 text-red-300",
};

const stockLevelLabels: Record<string, string> = {
  LOW: "Limited",
  AVERAGE: "Available",
  HIGH: "Available",
  OUT_OF_STOCK: "Out of Stock",
};

function formatPrice(n: number) {
  return `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProductListItem[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/admin/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams();
    if (categoryFilter) params.set("categoryId", categoryFilter);
    if (search) params.set("search", search);
    if (showInactive) params.set("active", "all");
    const res = await fetch(`/api/admin/catalog?${params}`);
    if (res.ok) setProducts(await res.json());
    setLoading(false);
  }, [categoryFilter, search, showInactive]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Item Catalog</h1>
          <p className="text-white/50 text-sm mt-1">
            Manage the standalone coral/fish/invert catalog
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              setExporting(true);
              try {
                const res = await fetch("/api/admin/catalog");
                if (res.ok) {
                  const allActive: CatalogProductListItem[] = await res.json();
                  const priceListProducts: PriceListProduct[] = allActive.map((p) => ({
                    name: p.name,
                    price: Number(p.price),
                    type: p.type,
                    categoryName: p.categoryName,
                  }));
                  await generatePriceList(priceListProducts);
                }
              } finally {
                setExporting(false);
              }
            }}
            disabled={exporting}
            className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl text-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {exporting ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            Export Price List
          </button>
          <Link
            href="/admin/catalog/new"
            className="px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white font-medium rounded-xl text-sm transition-all"
          >
            Add Product
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="flex-1 min-w-[200px] px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50"
        />
        <div className="w-56">
          <CategoryPicker
            categories={categories}
            value={categoryFilter}
            onChange={setCategoryFilter}
            placeholder="All Categories"
            allowAll
          />
        </div>
        <label className="flex items-center gap-2 text-white/50 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer"
          />
          Show inactive
        </label>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div className="w-12"></div>
              <div className="flex-1">
                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                  Name
                </p>
              </div>
              <div className="w-20 text-center">
                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                  Type
                </p>
              </div>
              <div className="w-28">
                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                  Category
                </p>
              </div>
              <div className="w-24 text-right">
                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                  Price
                </p>
              </div>
              <div className="w-24 text-center">
                <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                  Stock
                </p>
              </div>
              <div className="w-16"></div>
            </div>
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/admin/catalog/${p.id}`}
                className={`min-w-[800px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors block ${!p.active ? "opacity-50" : ""}`}
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white/90 text-sm font-medium">{p.name}</p>
                  {!p.active && (
                    <p className="text-red-400/60 text-xs">Inactive</p>
                  )}
                </div>
                <div className="w-20 text-center">
                  <span
                    className={`px-2 py-1 rounded-lg text-xs font-medium ${p.type === "COLONY" ? "bg-purple-500/20 text-purple-400" : "bg-cyan-500/20 text-cyan-400"}`}
                  >
                    {p.type}
                  </span>
                </div>
                <div className="w-28">
                  <p className="text-white/60 text-sm truncate">
                    {p.categoryName}
                  </p>
                </div>
                <div className="w-24 text-right">
                  <p className="text-[#0984E3] text-sm font-semibold tabular-nums">
                    {formatPrice(p.price)}
                  </p>
                </div>
                <div className="w-24 text-center">
                  {p.stockMode === "EXACT" ? (
                    <span className="text-white/60 text-sm tabular-nums">
                      {p.stockQty ?? 0}
                    </span>
                  ) : (
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${stockLevelColors[p.stockLevel || ""] || "bg-white/10 text-white/40"}`}
                    >
                      {stockLevelLabels[p.stockLevel || ""] || p.stockLevel || "—"}
                    </span>
                  )}
                </div>
                <div className="w-16 text-right">
                  <span className="text-white/30 text-xs">Edit</span>
                </div>
              </Link>
            ))}
            {products.length === 0 && (
              <div className="py-12 text-center text-white/40">
                No products found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
