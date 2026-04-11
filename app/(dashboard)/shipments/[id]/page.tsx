"use client";

import { useAuth } from "@/app/lib/auth-context";
import { applyDiscount } from "@/app/lib/discount";
import type { SerializedProduct, ShipmentDetail } from "@/app/lib/types";
import { useParams, useRouter } from "next/navigation";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function SubstitutePicker({
  products,
  onSelect,
  onClose,
}: {
  products: SerializedProduct[];
  onSelect: (p: SerializedProduct) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filteredProducts, setFilteredProducts] = useState(products);
  const [, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = (value: string) => {
    setSearch(value);
    startTransition(() => {
      const q = value.toLowerCase();
      setFilteredProducts(
        q
          ? products.filter(
              (p) =>
                p.name.toLowerCase().includes(q) ||
                (p.latinName && p.latinName.toLowerCase().includes(q)) ||
                (p.variant && p.variant.toLowerCase().includes(q)) ||
                (p.size && p.size.toLowerCase().includes(q)),
            )
          : products,
      );
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f26] border border-white/10 rounded-[20px] w-full max-w-lg max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold">Select Substitute</h3>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors"
            >
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
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
            <p className="text-white/30 text-sm text-center py-8">
              No products found
            </p>
          ) : (
            filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">
                    {toTitleCase(p.name)}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {p.size && (
                      <span className="text-white/30 text-[11px]">
                        {p.size}
                      </span>
                    )}
                    <span className="text-white/30 text-[11px]">
                      {formatPrice(Number(p.price))}
                    </span>
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
  const discount = user?.companyDiscount || 0;
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [substitutes, setSubstitutes] = useState<
    Map<string, { productId: string; name: string }>
  >(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [useCredit, setUseCredit] = useState(false);
  const [pickerForProduct, setPickerForProduct] = useState<string | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [maxBoxes, setMaxBoxes] = useState("");
  const [minBoxes, setMinBoxes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [cartBarVisible, setCartBarVisible] = useState(true);
  const cartBarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchShipment = useCallback(async () => {
    const res = await fetch(`/api/shipments/${params.id}`);
    if (res.ok) setShipment(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    fetchShipment();
  }, [fetchShipment]);

  useEffect(() => {
    const el = cartBarRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCartBarVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cart.size]);

  const sortedProducts = useMemo(() => {
    if (!shipment) return [];
    const available: SerializedProduct[] = [];
    const unavailable: SerializedProduct[] = [];
    for (const p of shipment.products) {
      if (
        p.availableQty !== null &&
        p.availableQty !== undefined &&
        p.availableQty <= 0
      ) {
        unavailable.push(p);
      } else {
        available.push(p);
      }
    }
    return [...available, ...unavailable];
  }, [shipment]);

  const filteredProducts = useMemo(() => {
    if (!deferredSearch.trim()) return sortedProducts;
    const q = deferredSearch.toLowerCase();
    return sortedProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.latinName && p.latinName.toLowerCase().includes(q)) ||
        (p.variant && p.variant.toLowerCase().includes(q)) ||
        (p.size && p.size.toLowerCase().includes(q)),
    );
  }, [sortedProducts, deferredSearch]);

  const getQty = (id: string) => cart.get(id) || 0;

  const getMaxQty = (product: SerializedProduct) => {
    if (product.availableQty === null || product.availableQty === undefined)
      return Infinity;
    return product.availableQty;
  };

  const isUnavailable = (product: SerializedProduct) => {
    return (
      product.availableQty !== null &&
      product.availableQty !== undefined &&
      product.availableQty <= 0
    );
  };

  const updateQty = (product: SerializedProduct, delta: number) => {
    if (isUnavailable(product)) return;
    const newCart = new Map(cart);
    const current = newCart.get(product.id) || 0;
    const max = getMaxQty(product);
    const next = Math.max(0, Math.min(max, current + delta));
    if (next === 0) newCart.delete(product.id);
    else newCart.set(product.id, next);
    setCart(newCart);
  };

  const setQtyVal = (product: SerializedProduct, qty: number) => {
    if (isUnavailable(product)) return;
    const newCart = new Map(cart);
    const max = getMaxQty(product);
    const clamped = Math.min(Math.max(0, qty), max);
    if (clamped <= 0) newCart.delete(product.id);
    else newCart.set(product.id, clamped);
    setCart(newCart);
  };

  const subtotal =
    shipment?.products.reduce(
      (sum, p) => sum + getQty(p.id) * applyDiscount(Number(p.price), discount),
      0,
    ) || 0;

  const boxCalc = shipment
    ? shipment.products.reduce((acc, p) => {
        const qty = getQty(p.id);
        if (qty === 0) return acc;
        if (p.qtyPerBox > 1) {
          return { ...acc, boxes: acc.boxes + qty / p.qtyPerBox, hasUnknown: acc.hasUnknown };
        }
        // qtyPerBox is 1 (default/unknown) — can't estimate boxes
        return { ...acc, hasUnknown: true };
      }, { boxes: 0, hasUnknown: false })
    : { boxes: 0, hasUnknown: false };

  const totalBoxes = Math.ceil(boxCalc.boxes);
  const hasUnknownBoxItems = boxCalc.hasUnknown;

  const estimatedFreight =
    totalBoxes > 0 && shipment ? Number(shipment.freightCost) * totalBoxes : 0;
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
        body: JSON.stringify({
          action: "submit",
          useCredit,
          maxBoxes: maxBoxes ? parseInt(maxBoxes) : null,
          minBoxes: minBoxes ? parseInt(minBoxes) : null,
        }),
      });
      router.push("/orders");
    }
    setSubmitting(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  if (!shipment)
    return <div className="p-8 text-white/40">Shipment not found</div>;

  return (
    <div className="p-4 md:p-8">
      <button
        onClick={() => router.push("/shipments")}
        className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Shipments
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">{shipment.name}</h1>
        <div className="flex items-center gap-4 mt-2">
          <span className="text-amber-400 text-sm font-medium">
            Deadline:{" "}
            {new Date(shipment.deadline).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </span>
          <span className="text-white/40 text-sm">
            {shipment.products.length} products
          </span>
        </div>
      </div>

      {cart.size > 0 && (
        <div
          ref={cartBarRef}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-5 mb-6"
        >
          {discount > 0 && (
            <div className="mb-3 px-2.5 py-1.5 bg-[#0984E3]/10 border border-[#0984E3]/20 rounded-lg inline-block">
              <p className="text-[#0984E3] text-xs font-medium">{discount}% discount applied</p>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3 md:flex md:flex-wrap md:items-start md:gap-6 mb-4">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
                Subtotal
              </p>
              <p className="text-white text-sm font-semibold tabular-nums">
                {formatPrice(subtotal)}
              </p>
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
                VAT (20%)
              </p>
              <p className="text-white/60 text-sm tabular-nums">
                {formatPrice(vat)}
              </p>
            </div>
            {(estimatedFreight > 0 || hasUnknownBoxItems) && cart.size > 0 && (
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
                  Est. Freight
                </p>
                <p className="text-white/40 text-sm tabular-nums">
                  {estimatedFreight > 0 ? `~${formatPrice(estimatedFreight)}` : "—"}
                </p>
                {hasUnknownBoxItems && (
                  <p className="text-amber-400/60 text-[10px] mt-0.5">Partial — some items have unknown box qty</p>
                )}
              </div>
            )}
            <div className="col-span-2 md:col-span-1">
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">
                Total
              </p>
              <p className="text-[#0984E3] text-sm md:text-lg font-bold tabular-nums">
                {formatPrice(total)}
              </p>
            </div>
            <p className="hidden md:block text-white/30 text-xs self-center">
              {cart.size} items{totalBoxes > 0 ? ` / ${totalBoxes} boxes` : ""}
            </p>
          </div>
          <p className="md:hidden text-white/30 text-xs mb-4">
            {cart.size} items{totalBoxes > 0 ? ` · ${totalBoxes} boxes` : ""}
          </p>
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            {user && user.creditBalance > 0 && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCredit}
                  onChange={(e) => setUseCredit(e.target.checked)}
                  className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-emerald-400 text-xs font-medium">
                  Use credit ({formatPrice(user.creditBalance)})
                </span>
              </label>
            )}
            <button
              onClick={handleSubmitClick}
              disabled={submitting}
              className="w-full md:w-auto md:ml-auto px-6 py-3 md:py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 active:bg-[#0984E3]/80 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2"
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

      {cart.size > 0 && !cartBarVisible && (
        <div className="sticky top-14 md:top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-2.5 mb-4 bg-[#111518]/95 backdrop-blur-xl border-b border-white/10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <p className="text-[#0984E3] text-sm font-bold tabular-nums">{formatPrice(total)}</p>
              <p className="text-white/30 text-xs">{cart.size} items{totalBoxes > 0 ? ` · ${totalBoxes} boxes` : ""}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => searchInputRef.current?.focus(), 400); }}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 flex items-center justify-center text-white/40 hover:text-white/70 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </button>
              <button
                onClick={handleSubmitClick}
                disabled={submitting}
                className="px-4 py-2 bg-[#0984E3] hover:bg-[#0984E3]/90 active:bg-[#0984E3]/80 disabled:bg-white/10 text-white text-xs font-medium rounded-xl transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Send Draft Order"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
        <div className="px-4 md:px-5 py-3 border-b border-white/10">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <div className="hidden md:flex min-w-[420px] px-5 py-2 items-center gap-4 border-b border-white/10 bg-white/[0.02]">
            <div className="min-w-0 flex-1">
              <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                Item
              </p>
            </div>
            <div className="text-right shrink-0 w-16">
              <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                Price
              </p>
            </div>
            <div className="shrink-0 w-[86px] text-center">
              <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                Qty
              </p>
            </div>
            <div className="text-right shrink-0 w-20">
              <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">
                Total
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/5">
            {filteredProducts.length === 0 && searchQuery.trim() && (
              <div className="px-4 md:px-5 py-8 text-center">
                <p className="text-white/30 text-sm">
                  No products match &ldquo;{searchQuery}&rdquo;
                </p>
              </div>
            )}
            {filteredProducts.map((product) => {
              const qty = getQty(product.id);
              const lineTotal = qty * applyDiscount(Number(product.price), discount);
              const unavail = isUnavailable(product);
              const max = getMaxQty(product);
              const sub = substitutes.get(product.id);
              return (
                <React.Fragment key={product.id}>
                  <div
                    className={`min-w-[420px] hidden md:block px-5 py-3 transition-colors ${unavail ? "opacity-30" : qty > 0 ? "bg-[#0984E3]/5" : "hover:bg-white/[0.02]"}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-white/90 text-[13px] leading-snug font-semibold">
                            {toTitleCase(product.name)}
                          </p>
                          {unavail && (
                            <span className="text-red-400/80 text-[10px] uppercase tracking-wider font-medium">
                              Unavailable
                            </span>
                          )}
                        </div>
                        {product.latinName && (
                          <p className="text-white/30 text-[11px] italic mt-0.5">{product.latinName}</p>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          {product.variant && (
                            <span className="text-white/40 text-[11px]">
                              {product.variant}
                            </span>
                          )}
                          {product.size && (
                            <span className="text-white/30 text-[11px]">
                              {product.size}
                            </span>
                          )}
                          {product.qtyPerBox > 1 && (
                            <span className="text-white/30 text-[11px]">
                              {product.qtyPerBox} per box
                            </span>
                          )}
                          {!unavail && max !== Infinity && (
                            <span className="text-white/20 text-[11px]">
                              {max} avail
                            </span>
                          )}
                        </div>
                        {qty > 0 && !unavail && (
                          <div className="mt-1.5">
                            {sub ? (
                              <div className="flex items-center gap-2">
                                <span className="text-amber-400/70 text-[11px]">
                                  Sub: {toTitleCase(sub.name)}
                                </span>
                                <button
                                  onClick={() =>
                                    setPickerForProduct(product.id)
                                  }
                                  className="text-white/30 hover:text-white/60 text-[10px] transition-colors"
                                >
                                  change
                                </button>
                                <button
                                  onClick={() => {
                                    const n = new Map(substitutes);
                                    n.delete(product.id);
                                    setSubstitutes(n);
                                  }}
                                  className="text-red-400/40 hover:text-red-400/70 text-[10px] transition-colors"
                                >
                                  remove
                                </button>
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
                      <div className="text-right shrink-0 w-16">
                        {discount > 0 ? (
                          <>
                            <p className="text-white/30 text-[10px] tabular-nums line-through">{formatPrice(Number(product.price))}</p>
                            <p className="text-[#0984E3] text-xs tabular-nums font-medium">{formatPrice(applyDiscount(Number(product.price), discount))}</p>
                          </>
                        ) : (
                          <p className="text-white/60 text-xs tabular-nums">
                            {formatPrice(Number(product.price))}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center shrink-0">
                        {unavail ? (
                          <div className="w-[86px] text-center">
                            <span className="text-white/20 text-xs">—</span>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => updateQty(product, -1)}
                              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                            >
                              <span className="text-sm font-medium">−</span>
                            </button>
                            <input
                              type="number"
                              value={qty}
                              onChange={(e) =>
                                setQtyVal(
                                  product,
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="w-8 h-7 bg-transparent text-white text-center text-xs font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <button
                              onClick={() => updateQty(product, 1)}
                              className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
                            >
                              <span className="text-sm font-medium">+</span>
                            </button>
                          </>
                        )}
                      </div>
                      <div className="text-right shrink-0 w-20">
                        {qty > 0 ? (
                          <p className="text-[#0984E3] text-sm font-semibold tabular-nums">
                            {formatPrice(lineTotal)}
                          </p>
                        ) : (
                          <p className="text-white/20 text-sm tabular-nums">
                            —
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Mobile card layout */}
                  <div
                    className={`md:hidden px-4 py-3.5 transition-colors ${unavail ? "opacity-30" : qty > 0 ? "bg-[#0984E3]/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white/90 text-sm leading-snug font-semibold">
                            {toTitleCase(product.name)}
                          </p>
                          {unavail && (
                            <span className="text-red-400/80 text-[10px] uppercase tracking-wider font-medium">
                              Unavailable
                            </span>
                          )}
                        </div>
                        {product.latinName && (
                          <p className="text-white/25 text-[11px] italic mt-0.5">{product.latinName}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          {product.variant && (
                            <span className="text-white/40 text-[10px]">{product.variant}</span>
                          )}
                          {discount > 0 ? (
                            <>
                              <span className="text-white/30 text-[10px] tabular-nums line-through">{formatPrice(Number(product.price))}</span>
                              <span className="text-[#0984E3] text-xs tabular-nums font-medium">{formatPrice(applyDiscount(Number(product.price), discount))}</span>
                            </>
                          ) : (
                            <span className="text-white/50 text-xs tabular-nums font-medium">
                              {formatPrice(Number(product.price))}
                            </span>
                          )}
                          {product.size && (
                            <>
                              <span className="text-white/15">·</span>
                              <span className="text-white/30 text-xs">
                                {product.size}
                              </span>
                            </>
                          )}
                          {product.qtyPerBox > 1 && (
                            <>
                              <span className="text-white/15">·</span>
                              <span className="text-white/30 text-xs">
                                {product.qtyPerBox}/box
                              </span>
                            </>
                          )}
                          {!unavail && max !== Infinity && (
                            <>
                              <span className="text-white/15">·</span>
                              <span className="text-white/20 text-xs">
                                {max} left
                              </span>
                            </>
                          )}
                        </div>
                        {qty > 0 && (
                          <p className="text-[#0984E3] text-xs font-bold tabular-nums mt-1">
                            Total: {formatPrice(lineTotal)}
                          </p>
                        )}
                      </div>
                      {unavail ? (
                        <div className="shrink-0 w-[100px] text-center">
                          <span className="text-white/20 text-xs">—</span>
                        </div>
                      ) : (
                        <div className="flex items-center shrink-0">
                          <button
                            onClick={() => updateQty(product, -1)}
                            className="w-9 h-9 rounded-xl bg-white/5 active:bg-white/15 flex items-center justify-center text-white/50 transition-all"
                          >
                            <span className="text-base font-medium">−</span>
                          </button>
                          <input
                            type="number"
                            value={qty}
                            onChange={(e) =>
                              setQtyVal(product, parseInt(e.target.value) || 0)
                            }
                            className="w-10 h-9 bg-transparent text-white text-center text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => updateQty(product, 1)}
                            className="w-9 h-9 rounded-xl bg-white/5 active:bg-white/15 flex items-center justify-center text-white/50 transition-all"
                          >
                            <span className="text-base font-medium">+</span>
                          </button>
                        </div>
                      )}
                    </div>
                    {qty > 0 && !unavail && (
                      <div className="mt-2 ml-0.5">
                        {sub ? (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400/70 text-xs">
                              Sub: {toTitleCase(sub.name)}
                            </span>
                            <button
                              onClick={() => setPickerForProduct(product.id)}
                              className="text-white/30 hover:text-white/60 text-xs transition-colors"
                            >
                              change
                            </button>
                            <button
                              onClick={() => {
                                const n = new Map(substitutes);
                                n.delete(product.id);
                                setSubstitutes(n);
                              }}
                              className="text-red-400/40 hover:text-red-400/70 text-xs transition-colors"
                            >
                              remove
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPickerForProduct(product.id)}
                            className="text-white/25 hover:text-white/50 text-xs transition-colors"
                          >
                            + Set substitute
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      {pickerForProduct && shipment && (
        <SubstitutePicker
          products={shipment.products.filter(
            (p) =>
              p.id !== pickerForProduct &&
              !(
                p.availableQty !== null &&
                p.availableQty !== undefined &&
                p.availableQty <= 0
              ),
          )}
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
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowTerms(false)}
        >
          <div
            className="bg-[#1a1f26] border border-white/10 rounded-[20px] w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-white font-semibold text-lg p-6 pb-4 shrink-0">
              Order Summary
            </h3>
            <div className="overflow-y-auto px-6 flex-1 min-h-0">
              <div className="bg-white/5 rounded-xl p-3.5 mb-5 space-y-2">
                {discount > 0 && (
                  <div className="flex justify-between text-sm pb-1">
                    <span className="text-[#0984E3] font-medium">{discount}% discount applied</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Subtotal ({cart.size} items)</span>
                  <span className="text-white font-medium tabular-nums">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">VAT (20%)</span>
                  <span className="text-white/60 tabular-nums">{formatPrice(vat)}</span>
                </div>
                {(estimatedFreight > 0 || hasUnknownBoxItems) && (
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Est. Freight{totalBoxes > 0 ? ` (${totalBoxes} boxes)` : ""}{hasUnknownBoxItems ? " *" : ""}</span>
                    <span className="text-white/40 tabular-nums">{estimatedFreight > 0 ? `~${formatPrice(estimatedFreight)}` : "TBC"}</span>
                  </div>
                )}
                {hasUnknownBoxItems && (
                  <p className="text-amber-400/50 text-[10px]">* Some items have unknown box quantity — freight is a partial estimate</p>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between text-sm">
                  <span className="text-white/70 font-medium">Total</span>
                  <span className="text-[#0984E3] font-bold tabular-nums">{formatPrice(total)}</span>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-3.5 mb-5 space-y-3">
                <p className="text-white/50 text-xs uppercase tracking-wider font-medium">Box Limits <span className="text-white/20 normal-case">(optional)</span></p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Min Boxes</label>
                    <input
                      type="number"
                      min="0"
                      value={minBoxes}
                      onChange={(e) => setMinBoxes(e.target.value)}
                      placeholder="No min"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50"
                    />
                  </div>
                  <div>
                    <label className="text-white/40 text-xs mb-1 block">Max Boxes</label>
                    <input
                      type="number"
                      min="0"
                      value={maxBoxes}
                      onChange={(e) => setMaxBoxes(e.target.value)}
                      placeholder="No max"
                      className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50"
                    />
                  </div>
                </div>
              </div>

              <div className="text-white/60 text-sm space-y-3 mb-4">
                <p>
                  By submitting this order, you acknowledge and agree to the
                  following:
                </p>
                <ul className="list-disc pl-4 space-y-2 text-white/50 text-xs">
                  <li>
                    Once your order is accepted, you are committed to the purchase
                    and payment is expected promptly.
                  </li>
                  <li>
                    All items are subject to availability. Quantities and pricing
                    may be adjusted prior to acceptance.
                  </li>
                  <li>
                    Where items are unavailable, substitutions will be made
                    according to your specified preferences where possible. If no
                    substitute has been set, the item may be removed from your
                    order.
                  </li>
                  <li>
                    The Coral Farm may make adjustments to your order (including
                    item changes, freight, and additional charges) before or after
                    acceptance. Any changes will be communicated to you, and the
                    updated order remains binding.
                  </li>
                  <li>
                    Payment is due upon acceptance. Failure to pay promptly may
                    result in cancellation of your order.
                  </li>
                  <li>
                    Freight estimates are provided by the shipper and are not
                    guaranteed. Actual freight charges may differ from estimates
                    shown. If you would like to limit the maximum number of boxes
                    on your order, please go back and set your preferred limit
                    before submitting.
                  </li>
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
                <span className="text-white/80 text-sm">
                  I understand and agree to these terms
                </span>
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
                  onClick={() => {
                    setShowTerms(false);
                    setTermsAccepted(false);
                  }}
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
