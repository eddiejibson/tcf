"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ParsedProduct, ParsedShipment } from "@/app/lib/types";

export default function NewShipmentPage() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parsed, setParsed] = useState<ParsedShipment | null>(null);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [shipmentDate, setShipmentDate] = useState("");
  const [freightCost, setFreightCost] = useState("");
  const [items, setItems] = useState<ParsedProduct[]>([]);

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
      setItems(data.items);
    }
    setUploading(false);
  };

  const updateItem = (index: number, field: keyof ParsedProduct, value: string) => {
    const updated = [...items];
    if (field === "price") updated[index] = { ...updated[index], price: parseFloat(value) || null };
    else if (field === "qtyPerBox") updated[index] = { ...updated[index], qtyPerBox: parseInt(value) || null };
    else if (field === "name") updated[index] = { ...updated[index], name: value };
    setItems(updated);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, { name: "", price: null, qtyPerBox: 1, warnings: [] }]);
  };

  const handleCreate = async () => {
    if (!name || !deadline || !shipmentDate) return;

    setCreating(true);
    const validItems = items.filter((i) => i.name && i.price && i.price > 0);

    const res = await fetch("/api/admin/shipments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        deadline,
        shipmentDate,
        freightCost: parseFloat(freightCost) || 0,
        products: validItems.map((i) => ({ name: i.name, price: i.price, qtyPerBox: i.qtyPerBox || 1 })),
      }),
    });

    if (res.ok) router.push("/admin/shipments");
    setCreating(false);
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
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
              onClick={() => setParsed({ name: null, shipmentDate: null, deadline: null, freightCost: null, items: [], warnings: [] })}
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

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
            <h3 className="text-white font-semibold mb-4">Shipment Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!name ? "border-red-500/50" : "border-white/10"}`} />
              </div>
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Freight Cost (£)</label>
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
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b border-white/10">
              <h3 className="text-white font-semibold">Products ({items.length})</h3>
              <button onClick={addItem} className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all">
                + Add Item
              </button>
            </div>

            <div className="px-6 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Name</p></div>
              <div className="w-28"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price (£)</p></div>
              <div className="w-28"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty/Box</p></div>
              <div className="w-16"></div>
            </div>

            <div className="max-h-[500px] overflow-auto">
              {items.map((item, index) => (
                <div key={index} className="px-6 py-3 flex items-center gap-4 border-b border-white/5">
                  <div className="flex-1">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${!item.name ? "border-red-500/50" : "border-white/10"}`}
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      step="0.01"
                      value={item.price ?? ""}
                      onChange={(e) => updateItem(index, "price", e.target.value)}
                      className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.price === null ? "border-red-500/50" : "border-white/10"}`}
                    />
                  </div>
                  <div className="w-28">
                    <input
                      type="number"
                      value={item.qtyPerBox ?? ""}
                      onChange={(e) => updateItem(index, "qtyPerBox", e.target.value)}
                      className={`w-full px-3 py-1.5 bg-white/5 border rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 ${item.qtyPerBox === null ? "border-amber-500/50" : "border-white/10"}`}
                    />
                  </div>
                  <div className="w-16 text-right">
                    <button onClick={() => removeItem(index)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => { setParsed(null); setItems([]); }} className="text-white/50 hover:text-white text-sm font-medium transition-colors">
              Start Over
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !name || !deadline || !shipmentDate || items.filter((i) => i.name && i.price).length === 0}
              className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all"
            >
              {creating ? "Creating..." : `Create Shipment (${items.filter((i) => i.name && i.price).length} products)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
