"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { UserOrderDetail } from "@/app/lib/types";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/60",
  SUBMITTED: "bg-blue-500/20 text-blue-400",
  APPROVED: "bg-green-500/20 text-green-400",
  REJECTED: "bg-red-500/20 text-red-400",
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<UserOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${params.id}`);
    if (res.ok) setOrder(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!order) return <div className="p-8 text-white/40">Order not found</div>;

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={() => router.push("/orders")} className="text-white/50 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Orders
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-white/50 text-sm mt-1">{order.shipment.name}</p>
        </div>
        <span className={`px-4 py-1.5 rounded-lg text-sm font-medium ${statusColors[order.status]}`}>{order.status}</span>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
        <div className="px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
          <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
          <div className="w-16 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty</p></div>
          <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
        </div>
        {order.items.map((item) => (
          <div key={item.id} className="px-6 py-3 flex items-center gap-4 border-b border-white/5">
            <div className="flex-1"><p className="text-white/90 text-sm font-medium">{item.name}</p></div>
            <div className="w-24 text-right"><p className="text-white/60 text-sm tabular-nums">{formatPrice(Number(item.unitPrice))}</p></div>
            <div className="w-16 text-center"><p className="text-white/60 text-sm">{item.quantity}</p></div>
            <div className="w-24 text-right"><p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(item.quantity * Number(item.unitPrice))}</p></div>
          </div>
        ))}
        <div className="p-6 space-y-2">
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPrice(order.totals.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>VAT (20%)</span>
            <span className="tabular-nums">{formatPrice(order.totals.vat)}</span>
          </div>
          {order.includeShipping && (
            <div className="flex items-center justify-between text-white/60 text-sm">
              <span>Shipping</span>
              <span className="tabular-nums">{formatPrice(order.totals.shipping)}</span>
            </div>
          )}
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">Grand Total</span>
            <span className="text-[#0984E3] font-bold text-lg tabular-nums">{formatPrice(order.totals.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
