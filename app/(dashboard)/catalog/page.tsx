"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth-context";
import type { CategoryNode } from "@/app/lib/types";
import ProductImageCarousel from "@/app/components/ProductImageCarousel";

interface SearchProductImage {
  id: string;
  imageUrl: string;
  label: string | null;
  sortOrder: number;
}

interface SearchProduct {
  id: string;
  name: string;
  latinName: string | null;
  price: number;
  type: string;
  categoryId: string;
  categoryName: string;
  images: SearchProductImage[];
  stockMode: string;
  stockQty: number | null;
  stockLevel: string | null;
  wysiwyg: boolean;
}

interface CartItem {
  catalogProductId: string;
  name: string;
  price: number;
  type: string;
  quantity: number;
}

const stockLevelColors: Record<string, string> = {
  LOW: "bg-amber-500/20 text-amber-400",
  AVERAGE: "bg-green-500/20 text-green-400",
  HIGH: "bg-green-500/20 text-green-400",
  OUT_OF_STOCK: "bg-red-500/30 text-red-300",
  PRE_ORDER: "bg-blue-500/20 text-blue-400",
};

const stockLevelLabels: Record<string, string> = {
  LOW: "Limited",
  AVERAGE: "Available",
  HIGH: "Available",
  OUT_OF_STOCK: "Out of Stock",
  PRE_ORDER: "Pre-Order",
};

function formatPrice(n: number) {
  return `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function CatalogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [activeParentId, setActiveParentId] = useState("");
  const [activeChildId, setActiveChildId] = useState("");
  const [search, setSearch] = useState("");
  const [wysiwygOnly, setWysiwygOnly] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [useCredit, setUseCredit] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error();
      const cats = await res.json();
      setCategories(cats);
      if (cats.length > 0) setActiveParentId(cats[0].id);
    } catch {
      setError(true);
    }
  }, []);

  const retryLoad = () => {
    setError(false);
    setLoading(true);
    fetchCategories().then(() => setLoading(false));
  };

  useEffect(() => {
    fetchCategories().then(() => setLoading(false));
  }, [fetchCategories]);

  const fetchProducts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (!search && activeChildId) params.set("categoryId", activeChildId);
      if (search) params.set("q", search);
      const res = await fetch(`/api/search/products?${params}`);
      if (res.ok) setProducts(await res.json());
    } catch {
      // Product fetch failure is non-fatal — categories still shown
    }
  }, [activeChildId, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const activeParent = categories.find((c) => c.id === activeParentId);

  const isOutOfStock = (p: SearchProduct) =>
    (p.stockMode === "EXACT" && (p.stockQty === 0 || p.stockQty === null)) ||
    (p.stockMode === "ROUGH" && p.stockLevel === "OUT_OF_STOCK");

  const addItem = (product: SearchProduct) => {
    const existing = cart.find((i) => i.catalogProductId === product.id);
    if (existing) {
      setCart(cart.map((i) =>
        i.catalogProductId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setCart([...cart, {
        catalogProductId: product.id,
        name: product.name,
        price: Number(product.price),
        type: product.type,
        quantity: 1,
      }]);
    }
  };

  const updateQty = (catalogProductId: string, qty: number) => {
    if (qty <= 0) {
      setCart(cart.filter((i) => i.catalogProductId !== catalogProductId));
    } else {
      setCart(cart.map((i) =>
        i.catalogProductId === catalogProductId ? { ...i, quantity: qty } : i
      ));
    }
  };

  const removeItem = (catalogProductId: string) => {
    setCart(cart.filter((i) => i.catalogProductId !== catalogProductId));
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;
  const itemCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const handleSubmitClick = () => {
    if (cart.length === 0) return;
    setShowTerms(true);
  };

  const handleConfirmSubmit = async () => {
    if (cart.length === 0 || !termsAccepted) return;
    setShowTerms(false);
    setSubmitting(true);

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ catalogProductId: i.catalogProductId, quantity: i.quantity })),
      }),
    });

    if (res.ok) {
      const order = await res.json();
      await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", useCredit }),
      });
      router.push("/orders");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  if (error) return (
    <div className="p-4 md:p-8">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
        <p className="text-white/50 mb-4">Failed to load catalog</p>
        <button onClick={retryLoad} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Catalog</h1>
        <p className="text-white/50 text-sm mt-1">Browse and order from our catalog</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Product browser */}
        <div className="flex-1">
          {/* Search + WYSIWYG filter */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all products..."
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50"
            />
            <button
              onClick={() => setWysiwygOnly(!wysiwygOnly)}
              className={`px-4 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
                wysiwygOnly
                  ? "bg-amber-500/20 border-amber-500/30 text-amber-400"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/10"
              }`}
            >
              WYSIWYG
            </button>
          </div>

          {/* Category tabs - hidden when searching */}
          {!search && (
            <>
              <div className="flex gap-2 mb-4 overflow-x-auto">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setActiveParentId(cat.id); setActiveChildId(""); }}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                      activeParentId === cat.id
                        ? "bg-[#0984E3]/20 text-[#0984E3]"
                        : "bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Sub-category pills */}
              {activeParent && activeParent.children.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setActiveChildId("")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      !activeChildId ? "bg-white/15 text-white" : "bg-white/5 text-white/40 hover:text-white/70"
                    }`}
                  >
                    All
                  </button>
                  {activeParent.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setActiveChildId(child.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        activeChildId === child.id ? "bg-white/15 text-white" : "bg-white/5 text-white/40 hover:text-white/70"
                      }`}
                    >
                      {child.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {products
              .filter((p) => {
                if (wysiwygOnly && !p.wysiwyg) return false;
                if (search) return true;
                if (!activeChildId && activeParentId) {
                  const childIds = activeParent?.children.map((c) => c.id) || [];
                  return childIds.includes(p.categoryId);
                }
                return true;
              })
              .map((p) => {
                const oos = isOutOfStock(p);
                const inCart = cart.find((i) => i.catalogProductId === p.id);
                return (
                  <div key={p.id} className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all flex flex-col ${oos ? "opacity-40" : "hover:border-white/20 hover:bg-white/[0.07]"}`}>
                    <div className="aspect-[4/3] bg-white/5 relative">
                      <ProductImageCarousel images={p.images} alt={p.name} />
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        {p.wysiwyg && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/80 text-white">
                            WYSIWYG
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.type === "COLONY" ? "bg-purple-500/80 text-white" : p.type === "PER_HEAD" ? "bg-emerald-500/80 text-white" : "bg-cyan-500/80 text-white"}`}>
                          {p.type === "PER_HEAD" ? "PER HEAD" : p.type}
                        </span>
                      </div>
                      {inCart && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#0984E3] text-white text-[10px] font-medium z-10">
                          x{inCart.quantity}
                        </span>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">{p.categoryName}</p>
                          <p className="text-white text-sm font-semibold mt-0.5 truncate">{p.name}</p>
                          {p.latinName && <p className="text-white/30 text-xs italic truncate mt-0.5">{p.latinName}</p>}
                        </div>
                        <div className="shrink-0 flex flex-col items-end pt-0.5">
                          {p.stockMode === "EXACT" ? (
                            <span className="text-white/40 text-[10px] whitespace-nowrap">{p.stockQty ?? 0} left</span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium whitespace-nowrap ${stockLevelColors[p.stockLevel || ""] || "bg-white/10 text-white/40"}`}>
                              {stockLevelLabels[p.stockLevel || ""] || p.stockLevel}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 mt-auto pt-2.5">
                        {Number(p.price) === 0 ? (
                          <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white/50 text-xs font-medium">POA</span>
                        ) : (
                          <span className="text-[#0984E3] text-base font-bold">{formatPrice(p.price)}</span>
                        )}
                        <button
                          onClick={() => addItem(p)}
                          disabled={oos}
                          className="w-full sm:w-auto px-4 py-2.5 sm:py-1.5 bg-[#0984E3]/15 text-[#0984E3] text-xs font-semibold rounded-xl hover:bg-[#0984E3]/25 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          {oos ? "Out of Stock" : "Add"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            {products.length === 0 && (
              <div className="col-span-full py-12 text-center text-white/40">No products found</div>
            )}
          </div>
        </div>

        {/* Cart sidebar */}
        <div className="lg:w-80 flex-shrink-0 self-start lg:sticky lg:top-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
            <h3 className="text-white font-semibold mb-4">Draft Invoice</h3>

            {cart.length === 0 ? (
              <p className="text-white/30 text-sm">No items added yet</p>
            ) : (
              <div className="space-y-3 mb-4">
                {cart.map((item) => (
                  <div key={item.catalogProductId} className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/90 text-sm truncate">{item.name}</p>
                      <p className="text-white/40 text-xs">{formatPrice(item.price)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateQty(item.catalogProductId, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center transition-colors"
                      >
                        -
                      </button>
                      <span className="text-white text-sm w-6 text-center tabular-nums">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.catalogProductId, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-white/10 text-white/60 hover:text-white text-xs flex items-center justify-center transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(item.price * item.quantity)}</p>
                      <button onClick={() => removeItem(item.catalogProductId)} className="text-red-400/40 hover:text-red-400 text-[10px] transition-colors">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {cart.length > 0 && (
              <>
                <div className="border-t border-white/10 pt-4 space-y-2">
                  <div className="flex justify-between text-white/60 text-sm">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-white/60 text-sm">
                    <span>VAT (20%)</span>
                    <span className="tabular-nums">{formatPrice(vat)}</span>
                  </div>
                  <div className="h-px bg-white/10" />
                  <div className="flex justify-between">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-[#0984E3] font-bold tabular-nums">{formatPrice(total)}</span>
                  </div>
                </div>

                {user && user.creditBalance > 0 && (
                  <label className="flex items-center gap-2 cursor-pointer mt-4">
                    <input
                      type="checkbox"
                      checked={useCredit}
                      onChange={(e) => setUseCredit(e.target.checked)}
                      className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer"
                    />
                    <span className="text-emerald-400 text-xs font-medium">Use credit ({formatPrice(user.creditBalance)})</span>
                  </label>
                )}

                <button
                  onClick={handleSubmitClick}
                  disabled={submitting}
                  className="w-full mt-4 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl transition-all"
                >
                  {submitting ? "Submitting..." : "Send Draft Order"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Terms & Conditions modal */}
      {showTerms && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
          <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] w-full max-w-md max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-lg p-6 pb-4 shrink-0">Terms & Conditions</h3>
            <div className="overflow-y-auto px-6 flex-1 min-h-0">
              <div className="text-white/60 text-sm space-y-3 mb-4">
                <p>By submitting this order, you acknowledge and agree to the following:</p>
                <ul className="list-disc pl-4 space-y-2 text-white/50 text-xs">
                  <li>Once your order is accepted, you are committed to the purchase and payment is expected promptly.</li>
                  <li>All items are subject to availability. Quantities and pricing may be adjusted prior to acceptance.</li>
                  <li>Where items are unavailable, substitutions will be made according to your specified preferences where possible. If no substitute has been set, the item may be removed from your order.</li>
                  <li>The Coral Farm may make adjustments to your order (including item changes, freight, and additional charges) before or after acceptance. Any changes will be communicated to you, and the updated order remains binding.</li>
                  <li>Payment is due upon acceptance. Failure to pay promptly may result in cancellation of your order.</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 p-6 pt-4 shrink-0">
              <label className="flex items-start gap-3 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-white/80 text-sm">I understand and agree to these terms</span>
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleConfirmSubmit}
                  disabled={!termsAccepted || submitting}
                  className="flex-1 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white text-sm font-medium rounded-xl transition-all"
                >
                  {submitting ? "Submitting..." : "Confirm & Submit Order"}
                </button>
                <button
                  onClick={() => { setShowTerms(false); setTermsAccepted(false); }}
                  className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
