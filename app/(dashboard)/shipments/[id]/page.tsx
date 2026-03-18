"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ShipmentDetail } from "@/app/lib/types";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toTitleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [submitting, setSubmitting] = useState(false);

  const fetchShipment = useCallback(async () => {
    const res = await fetch(`/api/shipments/${params.id}`);
    if (res.ok) setShipment(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchShipment(); }, [fetchShipment]);

  const getQty = (id: string) => cart.get(id) || 0;

  const updateQty = (id: string, delta: number) => {
    const newCart = new Map(cart);
    const current = newCart.get(id) || 0;
    const next = Math.max(0, current + delta);
    if (next === 0) newCart.delete(id); else newCart.set(id, next);
    setCart(newCart);
  };

  const setQty = (id: string, qty: number) => {
    const newCart = new Map(cart);
    if (qty <= 0) newCart.delete(id); else newCart.set(id, qty);
    setCart(newCart);
  };

  const subtotal = shipment?.products.reduce((sum, p) => sum + getQty(p.id) * Number(p.price), 0) || 0;

  const totalBoxes = shipment?.products.reduce((sum, p) => {
    const qty = getQty(p.id);
    if (qty === 0) return sum;
    return sum + Math.ceil(qty / p.qtyPerBox);
  }, 0) || 0;

  const estimatedFreight = totalBoxes > 0 && shipment ? (Number(shipment.freightCost) / Math.max(totalBoxes, 1)) * totalBoxes : 0;
  const vat = subtotal * 0.2;
  const total = subtotal + vat;

  const handleSubmit = async () => {
    if (!shipment || cart.size === 0) return;
    setSubmitting(true);

    const items = shipment.products
      .filter((p) => getQty(p.id) > 0)
      .map((p) => ({
        productId: p.id,
        name: p.name,
        quantity: getQty(p.id),
        unitPrice: Number(p.price),
      }));

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
        body: JSON.stringify({ action: "submit" }),
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

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
        <div className="px-5 py-2 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
          <div className="min-w-0 flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
          <div className="text-right shrink-0 w-16"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
          <div className="shrink-0 w-[86px] text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty</p></div>
          <div className="text-right shrink-0 w-20"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
        </div>

        <div className="divide-y divide-white/5">
          {shipment.products.map((product) => {
            const qty = getQty(product.id);
            const lineTotal = qty * Number(product.price);
            return (
              <div key={product.id} className={`px-5 py-3 flex items-center gap-4 transition-colors ${qty > 0 ? "bg-[#0984E3]/5" : "hover:bg-white/[0.02]"}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-white/90 text-[13px] leading-snug font-semibold">{toTitleCase(product.name)}</p>
                  {product.qtyPerBox > 1 && <p className="text-white/30 text-[11px] mt-0.5">{product.qtyPerBox} per box</p>}
                </div>
                <div className="text-right shrink-0 w-16">
                  <p className="text-white/60 text-xs tabular-nums">{formatPrice(Number(product.price))}</p>
                </div>
                <div className="flex items-center shrink-0">
                  <button onClick={() => updateQty(product.id, -1)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                    <span className="text-sm font-medium">−</span>
                  </button>
                  <input
                    type="number"
                    value={qty}
                    onChange={(e) => setQty(product.id, parseInt(e.target.value) || 0)}
                    className="w-8 h-7 bg-transparent text-white text-center text-xs font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => updateQty(product.id, 1)} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all">
                    <span className="text-sm font-medium">+</span>
                  </button>
                </div>
                <div className="text-right shrink-0 w-20">
                  {qty > 0 ? (
                    <p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(lineTotal)}</p>
                  ) : (
                    <p className="text-white/20 text-sm tabular-nums">—</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {subtotal > 0 && (
          <div className="border-t border-white/10 bg-white/[0.02] p-4 space-y-2">
            <div className="flex items-center justify-between text-white/60 text-sm">
              <span>Subtotal ({cart.size} items)</span>
              <span className="tabular-nums">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-white/60 text-sm">
              <span>VAT (20%)</span>
              <span className="tabular-nums">{formatPrice(vat)}</span>
            </div>
            {estimatedFreight > 0 && (
              <div className="flex items-center justify-between text-white/40 text-sm">
                <span>Est. freight ({totalBoxes} boxes)</span>
                <span className="tabular-nums">~{formatPrice(estimatedFreight)}</span>
              </div>
            )}
            <div className="h-px bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Total</span>
              <span className="text-[#0984E3] font-bold text-lg tabular-nums">{formatPrice(total)}</span>
            </div>
          </div>
        )}
      </div>

      {cart.size > 0 && (
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all flex items-center gap-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>Send Draft Order</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
