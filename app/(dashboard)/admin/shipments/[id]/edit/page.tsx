"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AdminShipmentDetail } from "@/app/lib/types";
import { VirtualItemList } from "@/app/components/shipments/ProductItemList";
import DeliveryOptionsEditor from "@/app/components/shipments/DeliveryOptionsEditor";
import { DEFAULT_DELIVERY_OPTIONS, resolveDeliveryOptions, type DeliveryOption } from "@/app/lib/delivery";

type EditItem = {
  _id: number;
  dbId: string | null;
  name: string;
  latinName: string | null;
  variant: string | null;
  price: number | null;
  size: string | null;
  qtyPerBox: number | null;
  availableQty: number | null;
};

let nextItemId = 0;

export default function EditShipmentPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [margin, setMargin] = useState("");
  const [fractionalBagsEnabled, setFractionalBagsEnabled] = useState(false);
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>(DEFAULT_DELIVERY_OPTIONS);
  const [notes, setNotes] = useState("");
  const [currency, setCurrency] = useState("");
  const [freightCurrency, setFreightCurrency] = useState("");
  const [items, setItems] = useState<EditItem[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/admin/shipments/${params.id}`);
      if (!res.ok) { setLoading(false); return; }
      const data: AdminShipmentDetail = await res.json();
      setName(data.name);
      setDeadline(data.deadline?.slice(0, 10) || "");
      setShipmentDate(data.shipmentDate?.slice(0, 10) || "");
      setFreightCost(String(data.freightCost || ""));
      setMargin(String(data.margin || ""));
      setFractionalBagsEnabled(!!data.fractionalBagsEnabled);
      setDeliveryOptions(resolveDeliveryOptions(data.deliveryOptions));
      setNotes(data.notes || "");
      setCurrency(data.currency || "");
      setFreightCurrency(data.freightCurrency || "");
      setItems(
        data.products.map((p) => ({
          _id: nextItemId++,
          dbId: p.id,
          name: p.name,
          latinName: p.latinName,
          variant: p.variant,
          price: Number(p.price),
          size: p.size,
          qtyPerBox: p.qtyPerBox,
          availableQty: p.availableQty,
        }))
      );
      setLoading(false);
    }
    load();
  }, [params.id]);

  const updateItem = useCallback((id: number, field: string, value: string) => {
    setItems((prev) => prev.map((item) => {
      if (item._id !== id) return item;
      if (field === "price") return { ...item, price: parseFloat(value) || null };
      if (field === "qtyPerBox") return { ...item, qtyPerBox: parseInt(value) || null };
      if (field === "availableQty") return { ...item, availableQty: value === "" ? null : parseInt(value) };
      if (field === "size") return { ...item, size: value || null };
      if (field === "name") return { ...item, name: value };
      return item;
    }));
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item._id !== id));
  }, []);

  const addItem = useCallback(() => {
    const id = nextItemId++;
    setItems((prev) => [{ _id: id, dbId: null, name: "", latinName: null, variant: null, price: null, size: null, qtyPerBox: null, availableQty: null }, ...prev]);
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0 });
    });
  }, []);

  const handleSave = async () => {
    if (!name || !deadline || !shipmentDate) return;
    setSaving(true);

    const validItems = items.filter((i) => i.name && i.price && i.price > 0);

    try {
      const res = await fetch(`/api/admin/shipments/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          deadline,
          shipmentDate,
          freightCost: parseFloat(freightCost) || 0,
          margin: parseFloat(margin) || 0,
          fractionalBagsEnabled,
          deliveryOptions,
          notes,
          currency,
          freightCurrency,
          products: validItems.map((i) => ({
            ...(i.dbId ? { id: i.dbId } : {}),
            name: i.name,
            latinName: i.latinName || null,
            variant: i.variant || null,
            price: i.price,
            size: i.size,
            qtyPerBox: i.qtyPerBox || null,
            availableQty: i.availableQty,
          })),
        }),
      });

      if (res.ok) {
        router.push(`/admin/shipments/${params.id}`);
        return;
      }
      const err = await res.json().catch(() => null);
      alert(err?.error || "Failed to save shipment");
    } catch {
      alert("Network error — changes may not have been saved.");
    }
    setSaving(false);
  };

  const hasVariant = useMemo(() => items.some((i) => i.variant), [items]);
  const hasSize = useMemo(() => items.some((i) => i.size), [items]);
  const hasStock = useMemo(() => items.some((i) => i.availableQty !== null && i.availableQty !== undefined), [items]);
  const validCount = useMemo(() => items.filter((i) => i.name && i.price).length, [items]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <button onClick={() => router.push(`/admin/shipments/${params.id}`)} className="text-white/50 hover:text-white text-sm mb-4 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Shipment
        </button>
        <h1 className="text-2xl font-bold text-white">Edit Shipment</h1>
        <p className="text-white/50 text-sm mt-1">Modify shipment details and products</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 p-4 md:p-6">
          <h3 className="text-white font-semibold mb-4">Shipment Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!name ? "border-red-500/50" : "border-white/10"}`} />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Freight Cost <span className="text-white/25 normal-case tracking-normal">per box{currency.trim() ? ` (${currency.trim()})` : ""}</span></label>
              <input type="number" step="0.01" value={freightCost} onChange={(e) => setFreightCost(e.target.value)} className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!freightCost ? "border-amber-500/50" : "border-white/10"}`} />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Deadline</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!deadline ? "border-red-500/50" : "border-white/10"}`} />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Shipment Date</label>
              <input type="date" value={shipmentDate} onChange={(e) => setShipmentDate(e.target.value)} className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!shipmentDate ? "border-red-500/50" : "border-white/10"}`} />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Item Currency <span className="text-white/25 normal-case tracking-normal">(optional)</span></label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="£ (default)" maxLength={8} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#0984E3]/50" />
              <p className="text-white/30 text-xs mt-1.5">How item prices display, e.g. £, $, GBP, USD. Leave blank for £.</p>
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Freight Currency <span className="text-white/25 normal-case tracking-normal">(optional)</span></label>
              <input value={freightCurrency} onChange={(e) => setFreightCurrency(e.target.value)} placeholder={currency.trim() || "£"} maxLength={8} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#0984E3]/50" />
              <p className="text-white/30 text-xs mt-1.5">For freight, delivery and shipping. Leave blank to match the item currency.</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Margin %</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                value={margin}
                onChange={(e) => setMargin(e.target.value)}
                placeholder="0"
                className="w-32 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
              />
              <p className="text-white/30 text-xs">Stored margin value only — does not recalculate product prices</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Shipment Notes <span className="text-white/25 normal-case tracking-normal">(shown to customers)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder="Pricing notes, delivery info, deadlines, anything customers should read before ordering. This shows at the top of the shipment for everyone."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/25 focus:outline-none focus:border-[#0984E3]/50 resize-y leading-relaxed"
            />
            <p className="text-white/30 text-xs mt-1.5">Public to all customers. Keep supplier-only notes out of here.</p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={fractionalBagsEnabled}
                onChange={(e) => setFractionalBagsEnabled(e.target.checked)}
                className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer"
              />
              <span className="text-white/80 text-sm font-medium">Fractional-bag ordering</span>
            </label>
            <p className="text-white/30 text-xs mt-1.5">When on, customers order this shipment by bags like 1/12 and 1/6 instead of by raw quantity.</p>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Delivery options (optional)</label>
            <DeliveryOptionsEditor options={deliveryOptions} onChange={setDeliveryOptions} currency={currency} />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 overflow-hidden">
          <div className="p-4 md:p-6 flex items-center justify-between border-b border-white/10">
            <h3 className="text-white font-semibold">Products ({items.length})</h3>
            <button onClick={addItem} className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all">
              + Add Item
            </button>
          </div>

          {/* Search */}
          <div className="px-4 md:px-6 py-2 border-b border-white/10">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input type="text" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder={`Search ${items.length} products...`} className="w-full pl-9 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/25 focus:outline-none focus:border-[#0984E3]/50" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px] px-4 md:px-6 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Name</p></div>
              {hasVariant && <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Variant</p></div>}
              <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
              {hasSize && <div className="w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Size</p></div>}
              <div className="w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty/Box</p></div>
              {hasStock && <div className="w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Stock</p></div>}
              <div className="w-16"></div>
            </div>

            <VirtualItemList
              items={itemSearch.trim() ? items.filter((i) => { const q = itemSearch.toLowerCase(); return i.name.toLowerCase().includes(q) || (i.latinName && i.latinName.toLowerCase().includes(q)) || (i.variant && i.variant.toLowerCase().includes(q)) || (i.size && i.size.toLowerCase().includes(q)); }) : items}
              hasVariant={hasVariant}
              hasSize={hasSize}
              hasStock={hasStock}
              onUpdate={updateItem}
              onRemove={removeItem}
              scrollRef={scrollContainerRef}
            />
          </div>
        </div>

        <div className="hidden md:flex items-center justify-between">
          <button onClick={() => router.push(`/admin/shipments/${params.id}`)} className="text-white/50 hover:text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name || !deadline || !shipmentDate || validCount === 0}
            className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
          >
            {saving ? "Saving..." : `Save Shipment (${validCount} products)`}
          </button>
        </div>

        {/* Sticky bottom bar on mobile */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111318]/90 backdrop-blur-xl border-t border-white/10 px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.push(`/admin/shipments/${params.id}`)} className="px-4 py-3 text-white/50 hover:text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name || !deadline || !shipmentDate || validCount === 0}
            className="flex-1 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm"
          >
            {saving ? "Saving..." : `Save Shipment (${validCount} products)`}
          </button>
        </div>
        <div className="md:hidden h-20" />
      </div>
    </div>
  );
}
