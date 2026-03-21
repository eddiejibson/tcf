"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { UserListItem, CategoryNode } from "@/app/lib/types";
import CustomerPicker from "@/app/components/CustomerPicker";
import CatalogProductForm from "@/app/components/admin/CatalogProductForm";

interface SearchProductImage {
  id: string;
  imageUrl: string;
  label: string | null;
  sortOrder: number;
}

interface SearchProduct {
  id: string;
  name: string;
  price: number;
  type: string;
  categoryId: string;
  categoryName: string;
  images: SearchProductImage[];
  stockMode: string;
  stockQty: number | null;
  stockLevel: string | null;
}

export interface OrderLineItem {
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

interface OrderBuilderProps {
  mode: "create" | "edit";
  initialDraftId?: string | null;
  initialItems?: OrderLineItem[];
  initialUserId?: string;
  initialNotes?: string;
}

export default function OrderBuilder({ mode, initialDraftId = null, initialItems = [], initialUserId = "", initialNotes = "" }: OrderBuilderProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [activeParentId, setActiveParentId] = useState("");
  const [activeChildId, setActiveChildId] = useState("");
  const [search, setSearch] = useState("");
  const [orderItems, setOrderItems] = useState<OrderLineItem[]>(initialItems);
  const [notes, setNotes] = useState(initialNotes);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewProduct, setShowNewProduct] = useState(false);

  // Draft auto-save state
  const [draftOrderId, setDraftOrderId] = useState<string | null>(initialDraftId ?? null);
  const draftOrderIdRef = useRef<string | null>(initialDraftId ?? null);
  const [draftStatus, setDraftStatus] = useState<"idle" | "saving" | "saved">(initialDraftId ? "saved" : "idle");
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savingRef = useRef(false);
  // Track whether initial state has been set up (skip first auto-save in edit mode)
  const initializedRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => { draftOrderIdRef.current = draftOrderId; }, [draftOrderId]);

  // Sync initial props when they change (for edit mode loading)
  useEffect(() => {
    if (initialItems.length > 0 && !initializedRef.current) {
      setOrderItems(initialItems);
      initializedRef.current = true;
    }
  }, [initialItems]);

  useEffect(() => {
    if (initialUserId && !initializedRef.current) setSelectedUserId(initialUserId);
  }, [initialUserId]);

  useEffect(() => {
    if (initialNotes && !initializedRef.current) setNotes(initialNotes);
  }, [initialNotes]);

  useEffect(() => {
    if (initialDraftId) {
      setDraftOrderId(initialDraftId);
      draftOrderIdRef.current = initialDraftId;
    }
  }, [initialDraftId]);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users?role=USER&limit=100");
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/admin/categories");
    if (res.ok) {
      const cats = await res.json();
      setCategories(cats);
      if (cats.length > 0) setActiveParentId(cats[0].id);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchCategories()]).then(() => setLoading(false));
  }, [fetchUsers, fetchCategories]);

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams();
    if (!search && activeChildId) params.set("categoryId", activeChildId);
    if (search) params.set("q", search);
    const res = await fetch(`/api/search/products?${params}`);
    if (res.ok) setProducts(await res.json());
  }, [activeChildId, search]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Auto-save draft
  useEffect(() => {
    if (orderItems.length === 0) return;
    // Skip auto-save on initial load in edit mode
    if (mode === "edit" && !initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (savingRef.current) return;
      savingRef.current = true;
      setDraftStatus("saving");
      try {
        if (!draftOrderIdRef.current) {
          // Create new draft
          const res = await fetch("/api/admin/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: selectedUserId || null,
              items: orderItems.map((i) => ({ catalogProductId: i.catalogProductId, quantity: i.quantity })),
              notes: notes || undefined,
              asDraft: true,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            setDraftOrderId(data.id);
          }
        } else {
          // Update existing draft
          await fetch(`/api/admin/orders/${draftOrderIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              draftItems: orderItems.map((i) => ({ catalogProductId: i.catalogProductId, quantity: i.quantity })),
              notes: notes || undefined,
              userId: selectedUserId || null,
            }),
          });
        }
        setDraftStatus("saved");
      } catch {
        setDraftStatus("idle");
      } finally {
        savingRef.current = false;
      }
    }, 1000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, orderItems, notes]);

  const activeParent = categories.find((c) => c.id === activeParentId);

  const addItem = (product: SearchProduct) => {
    const existing = orderItems.find((i) => i.catalogProductId === product.id);
    if (existing) {
      setOrderItems(orderItems.map((i) =>
        i.catalogProductId === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setOrderItems([...orderItems, {
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
      setOrderItems(orderItems.filter((i) => i.catalogProductId !== catalogProductId));
    } else {
      setOrderItems(orderItems.map((i) =>
        i.catalogProductId === catalogProductId ? { ...i, quantity: qty } : i
      ));
    }
  };

  const removeItem = (catalogProductId: string) => {
    setOrderItems(orderItems.filter((i) => i.catalogProductId !== catalogProductId));
  };

  const subtotal = orderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  const handleCreate = async () => {
    if (!selectedUserId || orderItems.length === 0) return;
    // Kill any pending auto-save to prevent race conditions
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    savingRef.current = true;
    setCreating(true);

    try {
      if (draftOrderId) {
        // Transition draft -> ACCEPTED
        const res = await fetch(`/api/admin/orders/${draftOrderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ACCEPTED" }),
        });
        if (res.ok) {
          const data = await res.json();
          router.push(`/admin/orders/${data.id}`);
          return;
        }
      }

      // Fallback: create directly as ACCEPTED
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          items: orderItems.map((i) => ({ catalogProductId: i.catalogProductId, quantity: i.quantity })),
          notes: notes || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/admin/orders/${data.id}`);
        return;
      }
    } finally {
      savingRef.current = false;
      setCreating(false);
    }
  };

  const handleProductCreated = (product: { id: string; name: string; price: number; type: string }) => {
    setShowNewProduct(false);
    addItem({ ...product, categoryId: "", categoryName: "", images: [], stockMode: "EXACT", stockQty: null, stockLevel: null });
    fetchProducts();
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  const isOutOfStock = (p: SearchProduct) =>
    (p.stockMode === "EXACT" && (p.stockQty === 0 || p.stockQty === null)) ||
    (p.stockMode === "ROUGH" && p.stockLevel === "OUT_OF_STOCK");

  const title = mode === "edit" ? "Edit Draft Order" : "Create Order";
  const submitLabel = mode === "edit" ? "Accept Order" : "Create Order";
  const submittingLabel = mode === "edit" ? "Accepting..." : "Creating...";

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {draftStatus === "saving" && (
          <span className="text-white/30 text-xs flex items-center gap-1.5">
            <div className="w-3 h-3 border border-white/20 border-t-white/50 rounded-full animate-spin" />
            Saving draft...
          </span>
        )}
        {draftStatus === "saved" && (
          <span className="text-emerald-400/60 text-xs">Draft saved</span>
        )}
      </div>

      {/* Customer selector */}
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6 overflow-visible relative z-10">
        <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Customer</label>
        <CustomerPicker users={users} value={selectedUserId} onChange={setSelectedUserId} />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Product browser */}
        <div className="flex-1">
          {/* Search + New Product button */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search all products..."
              className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50"
            />
            <button
              onClick={() => setShowNewProduct(true)}
              className="px-4 py-2.5 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-xl hover:bg-[#0984E3]/30 transition-all whitespace-nowrap"
            >
              + New Product
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
                if (search) return true;
                if (!activeChildId && activeParentId) {
                  const childIds = activeParent?.children.map((c) => c.id) || [];
                  return childIds.includes(p.categoryId);
                }
                return true;
              })
              .map((p) => {
                const oos = isOutOfStock(p);
                const inCart = orderItems.find((i) => i.catalogProductId === p.id);
                return (
                  <div key={p.id} className={`bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all ${oos ? "opacity-40" : "hover:border-white/20"}`}>
                    <div className="aspect-square bg-white/5 relative">
                      {p.images?.[0]?.imageUrl ? (
                        <img src={p.images[0].imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/10">
                          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        </div>
                      )}
                      <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-medium ${p.type === "COLONY" ? "bg-purple-500/80 text-white" : "bg-cyan-500/80 text-white"}`}>
                        {p.type}
                      </span>
                      {inCart && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-[#0984E3] text-white text-[10px] font-medium">
                          x{inCart.quantity}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="text-white/90 text-sm font-medium truncate">{p.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[#0984E3] text-sm font-semibold">{formatPrice(p.price)}</span>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-white/30 text-[8px] uppercase tracking-wider font-medium">Availability</span>
                          {p.stockMode === "EXACT" ? (
                            <span className="text-white/40 text-xs">{p.stockQty ?? 0} left</span>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stockLevelColors[p.stockLevel || ""] || "bg-white/10 text-white/40"}`}>
                              {stockLevelLabels[p.stockLevel || ""] || p.stockLevel}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => addItem(p)}
                        disabled={oos}
                        className="w-full mt-2 px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        {oos ? "Out of Stock" : "Add"}
                      </button>
                    </div>
                  </div>
                );
              })}
            {products.length === 0 && (
              <div className="col-span-full py-12 text-center text-white/40">No products found</div>
            )}
          </div>
        </div>

        {/* Order summary sidebar */}
        <div className="lg:w-80 flex-shrink-0">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 lg:sticky lg:top-8">
            <h3 className="text-white font-semibold mb-4">Order Summary</h3>

            {orderItems.length === 0 ? (
              <p className="text-white/30 text-sm">No items added yet</p>
            ) : (
              <div className="space-y-3 mb-4">
                {orderItems.map((item) => (
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

            {orderItems.length > 0 && (
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
            )}

            <div className="mt-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Order notes (optional)..."
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 resize-none"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating || !selectedUserId || orderItems.length === 0}
              className="w-full mt-4 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl transition-all"
            >
              {creating ? submittingLabel : submitLabel}
            </button>
          </div>
        </div>
      </div>

      {/* New Product Modal */}
      {showNewProduct && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowNewProduct(false)}
        >
          <div
            className="bg-[#1a1f26] border border-white/10 rounded-[20px] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">New Product</h2>
              <button onClick={() => setShowNewProduct(false)} className="text-white/30 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <CatalogProductForm
              onSuccess={handleProductCreated}
              onCancel={() => setShowNewProduct(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
