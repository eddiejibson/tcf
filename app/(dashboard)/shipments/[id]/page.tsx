"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ShipmentDetail, SerializedProduct } from "@/app/lib/types";
import { useAuth } from "@/app/lib/auth-context";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function SubstitutePicker({ products, onSelect, onClose }: { products: SerializedProduct[]; onSelect: (p: SerializedProduct) => void; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    startTransition(() => {
      const q = value.toLowerCase();
      setFilteredProducts(q ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.size && p.size.toLowerCase().includes(q))) : products);
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] w-full max-w-lg max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Select Substitute</h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50"
          />
        </div>
        <div className="overflow-auto flex-1 p-2">
          {filteredProducts.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No products found</p>
          ) : (
            filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">{toTitleCase(p.name)}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.size && <span className="text-white/30 text-[11px]">{p.size}</span>}
                    <span className="text-white/30 text-[11px]">{formatPrice(Number(p.price))}</span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [substitutes, setSubstitutes] = useState<Map<string, { productId: string; name: string }>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [pickerForProduct, setPickerForProduct] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const fetchShipment = useCallback(async () => {
    const res = await fetch(`/api/shipments/${params.id}`);
    if (res.ok) setShipment(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchShipment(); }, [fetchShipment]);

  const sortedProducts = useMemo(() => {
    if (!shipment) return [];
    const available: SerializedProduct[] = [];
    const unavailable: SerializedProduct[] = [];
    for (const p of shipment.products) {
      if (p.availableQty !== null && p.availableQty !== undefined && p.availableQty <= 0) {
        unavailable.push(p);
      } else {
        available.push(p);
      }
    }
    return [...available, ...unavailable];
  }, [shipment]);

  const getQty = (id: string) => cart.get(id) || 0;

  const getMaxQty = (product: SerializedProduct) => {
    if (product.availableQty === null || product.availableQty === undefined) return Infinity;
    return product.availableQty;
  };

  const isUnavailable = (product: SerializedProduct) => {
    return product.availableQty !== null && product.availableQty !== undefined && product.availableQty <= 0;
  };

  const updateQty = (product: SerializedProduct, delta: number) => {
    if (isUnavailable(product)) return;
    const newCart = new Map(cart);
    const current = newCart.get(product.id) || 0;
    const max = getMaxQty(product);
    const next = Math.max(0, Math.min(max, current + delta));
    if (next === 0) newCart.delete(product.id); else newCart.set(product.id, next);
    setCart(newCart);
  };

  const setQtyVal = (product: SerializedProduct, qty: number) => {
    if (isUnavailable(product)) return;
    const newCart = new Map(cart);
    const max = getMaxQty(product);
    const clamped = Math.min(Math.max(0, qty), max);
    if (clamped <= 0) newCart.delete(product.id); else newCart.set(product.id, clamped);
    setCart(newCart);
  };

  const subtotal = shipment?.products.reduce((sum, p) => sum + getQty(p.id) * Number(p.price), 0) || 0;

  const totalBoxes = shipment ? Math.ceil(shipment.products.reduce((sum, p) => {
    const qty = getQty(p.id);
    if (qty === 0) return sum;
    return sum + qty / p.qtyPerBox;
  }, 0)) : 0;

  const estimatedFreight = totalBoxes > 0 && shipment ? Number(shipment.freightCost) * totalBoxes : 0;
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  const handleSubmitClick = () => {
    if (!shipment || cart.size === 0) return;
    setShowTerms(true);
  };

  const handleConfirmSubmit = async () => {
    if (!shipment || cart.size === 0 || !termsAccepted) return;
    setShowTerms(false);
    setSubmitting(true);

    const items = shipment.products
      .filter((p) => getQty(p.id) > 0)
      .map((p) => {
        const sub = substitutes.get(p.id);
        return {
          productId: p.id,
          name: p.name,
          quantity: getQty(p.id),
          unitPrice: Number(p.price),
          substituteProductId: sub?.productId || null,
          substituteName: sub?.name || null,
        };
      });

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipmentId: shipment.id, items }),
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
  if (!shipment) return <div className="p-8 text-white/40">Shipment not found</div>;

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.push("/shipments")} className="text-white/50 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Shipments
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{shipment.name}</h1>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-amber-400 text-sm font-medium">Deadline: {new Date(shipment.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          <span className="text-white/40 text-sm">{shipment.products.length} products</span>
        </div>
      </div>

      {cart.size > 0 && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5 mb-6">
          <div className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-6 min-w-0">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Subtotal</p>
                <p className="text-white text-sm font-semibold tabular-nums">{formatPrice(subtotal)}</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">VAT (20%)</p>
                <p className="text-white/60 text-sm tabular-nums">{formatPrice(vat)}</p>
              </div>
              {estimatedFreight > 0 && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Est. Freight</p>
                  <p className="text-white/40 text-sm tabular-nums">~{formatPrice(estimatedFreight)}</p>
                </div>
              )}
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Total</p>
                <p className="text-[#0984E3] text-lg font-bold tabular-nums">{formatPrice(total)}</p>
              </div>
              <p className="text-white/30 text-xs">{cart.size} items{totalBoxes > 0 ? ` / ${totalBoxes} boxes` : ""}</p>
            </div>
            {user && user.creditBalance > 0 && (
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
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
              className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all flex items-center gap-2 shrink-0"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Send Draft Order"
              )}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
        <div className="px-5 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
          <div className="min-w-0 flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
          <div className="text-right shrink-0 w-16"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
          <div className="shrink-0 w-[86px] text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty</p></div>
          <div className="text-right shrink-0 w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
        </div>

        <div className="divide-y divide-white/5">
          {sortedProducts.map((product) => {
            const qty = getQty(product.id);
            const lineTotal = qty * Number(product.price);
            const unavail = isUnavailable(product);
            const max = getMaxQty(product);
            const sub = substitutes.get(product.id);
            return (
              <div key={product.id} className={`px-5 py-3 transition-colors ${unavail ? "opacity-30" : qty > 0 ? "bg-[#0984E3]/5" : "hover:bg-white/[0.02]"}`}>
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-white/90 text-[13px] leading-snug font-semibold">{toTitleCase(product.name)}</p>
                      {unavail && <span className="text-red-400/80 text-[10px] uppercase tracking-wider font-medium">Unavailable</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {product.size && <span className="text-white/30 text-[11px]">{product.size}</span>}
                      {product.qtyPerBox > 1 && <span className="text-white/30 text-[11px]">{product.qtyPerBox} per box</span>}
                      {!unavail && max !== Infinity && <span className="text-white/20 text-[11px]">{max} avail</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 w-16">
                    <p className="text-white/60 text-xs tabular-nums">{formatPrice(Number(product.price))}</p>
                  </div>
                  <div className="flex items-center shrink-0">
                    {unavail ? (
                      <div className="w-[86px] text-center"><span className="text-white/20 text-xs">—</span></div>
                    ) : (
                      <>
                        <button onClick={() => updateQty(product, -1)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                          <span className="text-sm font-medium">−</span>
                        </button>
                        <input
                          type="number"
                          value={qty}
                          onChange={(e) => setQtyVal(product, parseInt(e.target.value) || 0)}
                          className="w-8 h-7 bg-transparent text-white text-center text-xs font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button onClick={() => updateQty(product, 1)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                          <span className="text-sm font-medium">+</span>
                        </button>
                      </>
                    )}
                  </div>
                  <div className="text-right shrink-0 w-20">
                    {qty > 0 ? (
                      <p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(lineTotal)}</p>
                    ) : (
                      <p className="text-white/20 text-sm tabular-nums">—</p>
                    )}
                  </div>
                </div>
                {qty > 0 && !unavail && (
                  <div className="mt-1.5 ml-0.5">
                    {sub ? (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400/70 text-[11px]">Sub: {toTitleCase(sub.name)}</span>
                        <button onClick={() => setPickerForProduct(product.id)} className="text-white/30 hover:text-white/60 text-[10px] transition-colors">change</button>
                        <button onClick={() => { const n = new Map(substitutes); n.delete(product.id); setSubstitutes(n); }} className="text-red-400/40 hover:text-red-400/70 text-[10px] transition-colors">remove</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setPickerForProduct(product.id)}
                        className="text-white/25 hover:text-white/50 text-[11px] transition-colors"
                      >
                        + Set substitute
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pickerForProduct && shipment && (
        <SubstitutePicker
          products={shipment.products.filter((p) => p.id !== pickerForProduct && !(p.availableQty !== null && p.availableQty !== undefined && p.availableQty <= 0))}
          onSelect={(p) => {
            const n = new Map(substitutes);
            n.set(pickerForProduct, { productId: p.id, name: p.name });
            setSubstitutes(n);
            setPickerForProduct(null);
          }}
          onClose={() => setPickerForProduct(null)}
        />
      )}

      {showTerms && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowTerms(false)}>
          <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-semibold text-lg mb-4">Terms & Conditions</h3>
            <div className="text-white/60 text-sm space-y-3 mb-6">
              <p>By submitting this order, you acknowledge and agree to the following:</p>
              <ul className="list-disc pl-4 space-y-2 text-white/50 text-xs">
                <li>Once your order is accepted, you are committed to the purchase and payment is expected promptly.</li>
                <li>All items are subject to availability. Quantities and pricing may be adjusted prior to acceptance.</li>
                <li>Where items are unavailable, substitutions will be made according to your specified preferences where possible. If no substitute has been set, the item may be removed from your order.</li>
                <li>The Coral Farm may make adjustments to your order (including item changes, freight, and additional charges) before or after acceptance. Any changes will be communicated to you, and the updated order remains binding.</li>
                <li>Payment is due upon acceptance. Failure to pay promptly may result in cancellation of your order.</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 cursor-pointer mb-6">
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
      )}
    </div>
  );
}
