"use client";

import { useState, useRef, useCallback, memo, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ParsedProduct, ParsedShipment, ColumnMapping } from "@/app/lib/types";

type ItemWithId = ParsedProduct & { _id: number };
let nextItemId = 0;

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "price", label: "Price" },
  { key: "size", label: "Size" },
  { key: "qtyPerBox", label: "Qty Per Box" },
  { key: "stock", label: "Stock / Available" },
];

function clientParsePrice(value: unknown): number | null {
  if (typeof value === "number") return value > 0 && value < 100000 ? Math.round(value * 100) / 100 : null;
  if (typeof value === "string") {
    const cleaned = value.replace(/[£$€,\s]/g, "");
    const m = cleaned.match(/[\d.]+/);
    if (!m) return null;
    const n = parseFloat(m[0]);
    return !isNaN(n) && n > 0 && n < 100000 ? Math.round(n * 100) / 100 : null;
  }
  return null;
}

function clientParseQty(value: unknown): number | null {
  if (typeof value === "number") return value >= 0 ? Math.round(value) : null;
  if (typeof value !== "string") return null;

  const s = value.trim();
  if (!s) return null;
  if (/^(net|n\/a|tba|tbc|na|-+)$/i.test(s)) return null;

  // K-notation range: "2.5k - 3k"
  const kRange = s.match(/^([\d.]+)\s*k\s*[-–—]\s*([\d.]+)\s*k$/i);
  if (kRange) {
    const low = parseFloat(kRange[1]) * 1000;
    const high = parseFloat(kRange[2]) * 1000;
    if (!isNaN(low) && !isNaN(high) && low >= 0 && high >= 0) return Math.round((low + high) / 2);
  }

  // Single k-notation: "3K", "2.5k"
  const kSingle = s.match(/^([\d.]+)\s*k$/i);
  if (kSingle) {
    const n = parseFloat(kSingle[1]) * 1000;
    return !isNaN(n) && n >= 0 ? Math.round(n) : null;
  }

  // Numeric range: "20 - 30", "20-30" → average
  const range = s.match(/^([\d.]+)\s*[-–—]\s*([\d.]+)$/);
  if (range) {
    const low = parseFloat(range[1]);
    const high = parseFloat(range[2]);
    if (!isNaN(low) && !isNaN(high) && low >= 0 && high >= 0) return Math.round((low + high) / 2);
  }

  // Plus notation: "30+", "50+"
  const plus = s.match(/^([\d.]+)\s*\+$/);
  if (plus) {
    const n = parseFloat(plus[1]);
    return !isNaN(n) && n >= 0 ? Math.round(n) : null;
  }

  // Plain number
  const n = parseInt(s.replace(/[^\d]/g, ""));
  return !isNaN(n) && n >= 0 ? n : null;
}

function remapFromRawRows(rawRows: unknown[][], hdrs: string[], mappings: ColumnMapping): ParsedProduct[] {
  const items: ParsedProduct[] = [];
  for (const row of rawRows) {
    const r = row as unknown[];
    if (!r || r.length === 0) continue;

    const nameVal = mappings.name >= 0 ? String(r[mappings.name] || "").trim() : "";
    if (!nameVal || nameVal.length < 2) continue;
    if (/^\d+$/.test(nameVal) && nameVal.length < 4) continue;

    let price: number | null = null;
    if (mappings.price >= 0) {
      price = clientParsePrice(r[mappings.price]);
    }
    if (price === null && mappings.price >= 0) continue;

    let size: string | null = null;
    if (mappings.size >= 0) {
      const v = r[mappings.size];
      if (v) { const s = String(v).trim(); if (s && s !== "0") size = s; }
    }

    let qtyPerBox: number | null = null;
    if (mappings.qtyPerBox >= 0) qtyPerBox = clientParseQty(r[mappings.qtyPerBox]);

    let availableQty: number | null = null;
    if (mappings.stock >= 0) {
      availableQty = clientParseQty(r[mappings.stock]) ?? 0;
    }

    const originalRow: Record<string, unknown> = {};
    hdrs.forEach((h, idx) => { if (h && r[idx] !== undefined) originalRow[h] = r[idx]; });

    items.push({ name: nameVal, price, size, qtyPerBox, availableQty, originalRow, warnings: [] });
  }
  return items;
}

interface ItemRowProps {
  item: ItemWithId;
  hasSize: boolean;
  hasStock: boolean;
  onUpdate: (id: number, field: keyof ParsedProduct, value: string) => void;
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

function VirtualItemList({ items, hasSize, hasStock, onUpdate, onRemove, isPending, scrollRef }: {
  items: ItemWithId[];
  hasSize: boolean;
  hasStock: boolean;
  onUpdate: (id: number, field: keyof ParsedProduct, value: string) => void;
  onRemove: (id: number) => void;
  isPending: boolean;
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
      className={`transition-opacity ${isPending ? "opacity-40" : ""}`}
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

export default function NewShipmentPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parsed, setParsed] = useState<ParsedShipment | null>(null);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [items, setItems] = useState<ItemWithId[]>([]);
  const [mappingsOpen, setMappingsOpen] = useState(false);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({ name: -1, price: -1, size: -1, qtyPerBox: -1, stock: -1 });
  const [headers, setHeaders] = useState<string[]>([]);
  const [margin, setMargin] = useState("");
  const [isPending, startTransition] = useTransition();
  const basePricesRef = useRef<Map<number, number | null>>(new Map());
  const rawRowsRef = useRef<unknown[][]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const assignIds = (items: ParsedProduct[]): ItemWithId[] =>
    items.map((item) => ({ ...item, _id: nextItemId++ }));

  const applyMarginAndSet = useCallback((newItems: ParsedProduct[], currentMargin: string) => {
    const itemsWithIds = assignIds(newItems);
    const baseMap = new Map<number, number | null>();
    itemsWithIds.forEach((item) => baseMap.set(item._id, item.price));
    basePricesRef.current = baseMap;
    const m = parseFloat(currentMargin);
    if (m > 0) {
      setItems(itemsWithIds.map((item) => {
        if (item.price === null) return item;
        return { ...item, price: Math.round(item.price * (1 + m / 100) * 100) / 100 };
      }));
    } else {
      setItems(itemsWithIds);
    }
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/admin/shipments/upload", { method: "POST", body: formData });
    if (res.ok) {
      const data: ParsedShipment = await res.json();
      setParsed(data);
      setName(data.name || "");
      setDeadline(data.deadline || "");
      setShipmentDate(data.shipmentDate || "");
      setFreightCost(data.freightCost?.toString() || "");
      setHeaders(data.headers || []);
      setColumnMappings(data.columnMappings || { name: -1, price: -1, size: -1, qtyPerBox: -1, stock: -1 });
      rawRowsRef.current = data.rawRows || [];
      applyMarginAndSet(data.items, margin);
    }
    setUploading(false);
  };

  const handleMappingChange = (key: keyof ColumnMapping, value: number) => {
    const newMappings = { ...columnMappings, [key]: value };
    setColumnMappings(newMappings);
    if (rawRowsRef.current.length > 0) {
      const newItems = remapFromRawRows(rawRowsRef.current, headers, newMappings);
      startTransition(() => {
        applyMarginAndSet(newItems, margin);
      });
    }
  };

  const handleMarginChange = useCallback((value: string) => {
    setMargin(value);
    const m = parseFloat(value);
    if (isNaN(m) || m === 0) {
      setItems((prev) =>
        prev.map((item) => {
          const base = basePricesRef.current.get(item._id);
          if (base === null || base === undefined) return item;
          return { ...item, price: base };
        })
      );
    } else {
      setItems((prev) =>
        prev.map((item) => {
          const base = basePricesRef.current.get(item._id);
          if (base === null || base === undefined) return item;
          return { ...item, price: Math.round(base * (1 + m / 100) * 100) / 100 };
        })
      );
    }
  }, []);

  const updateItem = useCallback((id: number, field: keyof ParsedProduct, value: string) => {
    setItems((prev) => prev.map((item) => {
      if (item._id !== id) return item;
      if (field === "price") {
        const p = parseFloat(value) || null;
        basePricesRef.current.set(id, p);
        return { ...item, price: p };
      }
      if (field === "qtyPerBox") return { ...item, qtyPerBox: parseInt(value) || null };
      if (field === "availableQty") return { ...item, availableQty: value === "" ? null : parseInt(value) };
      if (field === "size") return { ...item, size: value || null };
      if (field === "name") return { ...item, name: value };
      return item;
    }));
  }, []);

  const removeItem = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item._id !== id));
    basePricesRef.current.delete(id);
  }, []);

  const addItem = useCallback(() => {
    const id = nextItemId++;
    setItems((prev) => [{ name: "", price: null, size: null, qtyPerBox: 1, availableQty: null, warnings: [], _id: id }, ...prev]);
    basePricesRef.current.set(id, null);
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({ top: 0 });
    });
  }, []);

  const handleCreate = async () => {
    if (!name || !deadline || !shipmentDate) return;

    setCreating(true);
    const validItems = items.filter((i) => i.name && i.price && i.price > 0);

    try {
      const res = await fetch("/api/admin/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          deadline,
          shipmentDate,
          freightCost: parseFloat(freightCost) || 0,
          margin: parseFloat(margin) || 0,
          products: validItems.map((i) => ({
            name: i.name,
            price: i.price,
            size: i.size,
            qtyPerBox: i.qtyPerBox || 1,
            availableQty: i.availableQty,
          })),
        }),
      });

      if (res.ok) {
        router.push("/admin/shipments");
        return;
      }
      const err = await res.json().catch(() => null);
      alert(err?.error || "Failed to create shipment");
    } catch {
      alert("Network error - shipment may have been created. Check the shipments list.");
    }
    setCreating(false);
  };

  const hasSize = useMemo(() => items.some((i) => i.size), [items]);
  const hasStock = useMemo(() => items.some((i) => i.availableQty !== null && i.availableQty !== undefined), [items]);
  const validCount = useMemo(() => items.filter((i) => i.name && i.price).length, [items]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-white">Create Shipment</h1>
        <p className="text-white/50 text-sm mt-1">Upload an Excel file or create manually</p>
      </div>

      {!parsed ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-12 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#0984E3]/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#0984E3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <h3 className="text-white font-semibold text-lg mb-2">Upload Price List</h3>
          <p className="text-white/50 text-sm mb-6">Upload an Excel (.xlsx/.xls) file to auto-extract products</p>
          <label className="inline-block px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white font-medium rounded-xl transition-all cursor-pointer">
            {uploading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Parsing...
              </div>
            ) : "Choose File"}
            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} className="hidden" />
          </label>
          <div className="mt-6">
            <button
              onClick={() => setParsed({ name: null, shipmentDate: null, deadline: null, freightCost: null, items: [], warnings: [], headers: [], columnMappings: { name: -1, price: -1, size: -1, qtyPerBox: -1, stock: -1 } })}
              className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm font-medium transition-colors"
            >
              Or create manually without a file
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {parsed.warnings.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-[16px] p-4">
              <p className="text-amber-400 text-sm font-medium mb-2">Warnings</p>
              {parsed.warnings.map((w, i) => (
                <p key={i} className="text-amber-400/70 text-xs">{w}</p>
              ))}
            </div>
          )}

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
            {items.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Price Margin %</label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    value={margin}
                    onChange={(e) => handleMarginChange(e.target.value)}
                    placeholder="0"
                    className="w-32 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
                  />
                  <p className="text-white/30 text-xs">
                    {margin && parseFloat(margin) > 0
                      ? `All prices increased by ${margin}% from base`
                      : "Apply a percentage markup to all parsed prices"}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
            <div className="p-4 md:p-6 flex items-center justify-between border-b border-white/10">
              <h3 className="text-white font-semibold">Products ({items.length})</h3>
              <div className="flex items-center gap-3">
                {headers.length > 0 && (
                  <button
                    onClick={() => setMappingsOpen(!mappingsOpen)}
                    className={`p-2 rounded-lg transition-all ${mappingsOpen ? "bg-[#0984E3]/20 text-[#0984E3]" : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10"}`}
                    title="Column mappings"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
                <button onClick={addItem} className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all">
                  + Add Item
                </button>
              </div>
            </div>

            {mappingsOpen && headers.length > 0 && (
              <div className="px-6 py-4 border-b border-white/10 bg-white/[0.03]">
                <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Column Mappings</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {MAPPING_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">{label}</label>
                      <select
                        value={columnMappings[key]}
                        onChange={(e) => handleMappingChange(key, parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-[#0984E3]/50 appearance-none cursor-pointer"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.3)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
                      >
                        <option value={-1} className="bg-[#1a1f26] text-white/50">Not mapped</option>
                        {headers.map((h, i) => h ? (
                          <option key={i} value={i} className="bg-[#1a1f26] text-white">{h}</option>
                        ) : null)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              isPending={isPending}
              scrollRef={scrollContainerRef}
            />
            </div>
          </div>

          <div className="hidden md:flex items-center justify-between">
            <button onClick={() => { setParsed(null); setItems([]); setMargin(""); basePricesRef.current = new Map(); rawRowsRef.current = []; }} className="text-white/50 hover:text-white text-sm font-medium transition-colors">
              Start Over
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name || !deadline || !shipmentDate || validCount === 0}
              className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
            >
              {creating ? "Creating..." : `Create Shipment (${validCount} products)`}
            </button>
          </div>

          {/* Sticky bottom bar on mobile */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#111318]/90 backdrop-blur-xl border-t border-white/10 px-4 py-3 flex items-center gap-3">
            <button onClick={() => { setParsed(null); setItems([]); setMargin(""); basePricesRef.current = new Map(); rawRowsRef.current = []; }} className="px-4 py-3 text-white/50 hover:text-white text-sm font-medium transition-colors">
              Reset
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name || !deadline || !shipmentDate || validCount === 0}
              className="flex-1 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all text-sm"
            >
              {creating ? "Creating..." : `Create Shipment (${validCount} products)`}
            </button>
          </div>
          <div className="md:hidden h-20" />
        </div>
      )}
    </div>
  );
}
