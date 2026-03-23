"use client";

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AdminShipmentDetail } from "@/app/lib/types";

type EditItem = {
  _id: number;
  dbId: string | null;
  name: string;
  latinName: string | null;
  price: number | null;
  size: string | null;
  qtyPerBox: number | null;
  availableQty: number | null;
};

let nextItemId = 0;

interface ItemRowProps {
  item: EditItem;
  hasSize: boolean;
  hasStock: boolean;
  onUpdate: (id: number, field: string, value: string) => void;
  onRemove: (id: number) => void;
}

const ItemRow = memo(function ItemRow({ item, hasSize, hasStock, onUpdate, onRemove }: ItemRowProps) {
  const id = item._id;
  return (
    <div className={`min-w-[500px] px-4 md:px-6 h-[49px] flex items-center gap-4 border-b border-white/5 ${item.availableQty !== null && item.availableQty !== undefined && item.availableQty <= 0 ? "opacity-40" : ""}`}>
      <div className="flex-1">
        <input
          value={item.name}
          onChange={(e) => onUpdate(id, "name", e.target.value)}
          className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!item.name ? "border-red-500/50" : "border-white/10"}`}
        />
      </div>
      <div className="w-24">
        <input
          type="number"
          step="0.01"
          value={item.price ?? ""}
          onChange={(e) => onUpdate(id, "price", e.target.value)}
          className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.price === null ? "border-red-500/50" : "border-white/10"}`}
        />
      </div>
      {hasSize && (
        <div className="w-20">
          <input
            value={item.size ?? ""}
            onChange={(e) => onUpdate(id, "size", e.target.value)}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
          />
        </div>
      )}
      <div className="w-20">
        <input
          type="number"
          value={item.qtyPerBox ?? ""}
          onChange={(e) => onUpdate(id, "qtyPerBox", e.target.value)}
          className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.qtyPerBox === null ? "border-amber-500/50" : "border-white/10"}`}
        />
      </div>
      {hasStock && (
        <div className="w-20">
          <input
            type="number"
            value={item.availableQty ?? ""}
            onChange={(e) => onUpdate(id, "availableQty", e.target.value)}
            className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
          />
        </div>
      )}
      <div className="w-16 text-right">
        <button onClick={() => onRemove(id)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
      </div>
    </div>
  );
});

const ROW_H = 49;
const OVERSCAN = 5;
const LIST_H = 500;

function VirtualItemList({ items, hasSize, hasStock, onUpdate, onRemove, scrollRef }: {
  items: EditItem[];
  hasSize: boolean;
  hasStock: boolean;
  onUpdate: (id: number, field: string, value: string) => void;
  onRemove: (id: number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * ROW_H;
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - OVERSCAN);
  const endIdx = Math.min(items.length, startIdx + Math.ceil(LIST_H / ROW_H) + OVERSCAN * 2);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return (
    <div
      ref={scrollRef}
      style={{ maxHeight: LIST_H, overflowY: "auto" }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {items.slice(startIdx, endIdx).map((item, i) => (
          <div
            key={item._id}
            style={{ position: "absolute", top: (startIdx + i) * ROW_H, left: 0, right: 0 }}
          >
            <ItemRow
              item={item}
              hasSize={hasSize}
              hasStock={hasStock}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [items, setItems] = useState<EditItem[]>([]);
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
      setItems(
        data.products.map((p) => ({
          _id: nextItemId++,
          dbId: p.id,
          name: p.name,
          latinName: p.latinName,
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
    setItems((prev) => [{ _id: id, dbId: null, name: "", latinName: null, price: null, size: null, qtyPerBox: 1, availableQty: null }, ...prev]);
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
          products: validItems.map((i) => ({
            ...(i.dbId ? { id: i.dbId } : {}),
            name: i.name,
            latinName: i.latinName || null,
            price: i.price,
            size: i.size,
            qtyPerBox: i.qtyPerBox || 1,
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
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-4">Shipment Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!name ? "border-red-500/50" : "border-white/10"}`} />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Freight Cost</label>
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
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="p-4 md:p-6 flex items-center justify-between border-b border-white/10">
            <h3 className="text-white font-semibold">Products ({items.length})</h3>
            <button onClick={addItem} className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all">
              + Add Item
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[500px] px-4 md:px-6 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Name</p></div>
              <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
              {hasSize && <div className="w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Size</p></div>}
              <div className="w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty/Box</p></div>
              {hasStock && <div className="w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Stock</p></div>}
              <div className="w-16"></div>
            </div>

            <VirtualItemList
              items={items}
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
