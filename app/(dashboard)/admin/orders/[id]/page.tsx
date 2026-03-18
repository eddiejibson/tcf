"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AdminOrderDetail, EditableOrderItem } from "@/app/lib/types";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<EditableOrderItem[]>([]);
  const [includeShipping, setIncludeShipping] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setOrder(data);
      setItems(data.items);
      setIncludeShipping(data.includeShipping);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...items];
    if (field === "quantity") updated[index] = { ...updated[index], quantity: Number(value) || 0 };
    else if (field === "unitPrice") updated[index] = { ...updated[index], unitPrice: Number(value) || 0 };
    else if (field === "name") updated[index] = { ...updated[index], name: String(value) };
    setItems(updated);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const addCustomItem = () => {
    if (!newItemName || !newItemPrice) return;
    setItems([...items, {
      id: "",
      productId: null,
      name: newItemName,
      quantity: parseInt(newItemQty) || 1,
      unitPrice: parseFloat(newItemPrice) || 0,
    }]);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemQty("1");
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/admin/orders/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        includeShipping,
      }),
    });
    await fetchOrder();
    setSaving(false);
  };

  const handleStatusChange = async (status: string) => {
    setSaving(true);
    await fetch(`/api/admin/orders/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, includeShipping }),
    });
    await fetchOrder();
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!order) return <div className="p-8 text-white/40">Order not found</div>;

  const subtotal = items.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0);
  const vat = subtotal * 0.2;
  const shipping = includeShipping ? 25 : 0;
  const total = subtotal + vat + shipping;

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.push("/admin/orders")} className="text-white/50 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Orders
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-white/50 text-sm mt-1">{order.user.email} - {order.shipment.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {order.status === "SUBMITTED" && (
            <>
              <button onClick={() => handleStatusChange("APPROVED")} disabled={saving} className="px-4 py-2 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-sm font-medium rounded-xl transition-all">Approve</button>
              <button onClick={() => handleStatusChange("REJECTED")} disabled={saving} className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-medium rounded-xl transition-all">Reject</button>
            </>
          )}
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden mb-6">
        <div className="px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
          <div className="w-28"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
          <div className="w-20 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty</p></div>
          <div className="w-28 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
          <div className="w-16"></div>
        </div>

        {items.map((item, index) => (
          <div key={index} className="px-6 py-3 flex items-center gap-4 border-b border-white/5">
            <div className="flex-1">
              <input value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
            </div>
            <div className="w-28">
              <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, "unitPrice", e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
            </div>
            <div className="w-20">
              <input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50" />
            </div>
            <div className="w-28 text-right"><p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(item.quantity * Number(item.unitPrice))}</p></div>
            <div className="w-16 text-right">
              <button onClick={() => removeItem(index)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
            </div>
          </div>
        ))}

        <div className="px-6 py-3 flex items-end gap-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex-1">
            <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Custom item name" className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50" />
          </div>
          <div className="w-28">
            <input type="number" step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Price" className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50" />
          </div>
          <div className="w-20">
            <input type="number" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50" />
          </div>
          <div className="w-28"></div>
          <div className="w-16">
            <button onClick={addCustomItem} disabled={!newItemName || !newItemPrice} className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 disabled:opacity-30 transition-all">Add</button>
          </div>
        </div>

        <div className="p-6 space-y-2">
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>VAT (20%)</span>
            <span className="tabular-nums">{formatPrice(vat)}</span>
          </div>
          <div className="flex items-center justify-between text-white/60 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeShipping} onChange={(e) => setIncludeShipping(e.target.checked)} className="rounded" />
              Shipping (£25.00)
            </label>
            <span className="tabular-nums">{formatPrice(shipping)}</span>
          </div>
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">Grand Total</span>
            <span className="text-[#0984E3] font-bold text-lg tabular-nums">{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
