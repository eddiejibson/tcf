"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AdminOrderListItem } from "@/app/lib/types";

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/60",
  SUBMITTED: "bg-blue-500/20 text-blue-400",
  AWAITING_FULFILLMENT: "bg-orange-500/20 text-orange-400",
  ACCEPTED: "bg-green-500/20 text-green-400",
  REJECTED: "bg-red-500/20 text-red-400",
  AWAITING_PAYMENT: "bg-yellow-500/20 text-yellow-400",
  PAID: "bg-emerald-500/20 text-emerald-400",
  EXPIRED: "bg-orange-500/20 text-orange-400",
};

const statusLabels: Record<string, string> = {
  AWAITING_FULFILLMENT: "FULFILLMENT",
  AWAITING_PAYMENT: "AWAITING PAYMENT",
};

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const res = await fetch("/api/admin/orders");
    if (res.ok) setOrders(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          <p className="text-white/50 text-sm mt-1">Review and manage customer orders</p>
        </div>
        <Link
          href="/admin/orders/new"
          className="px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white font-medium rounded-xl text-sm transition-all"
        >
          New Order
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[700px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
            <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Order #</p></div>
            <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Customer</p></div>
            <div className="w-40"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Shipment</p></div>
            <div className="w-20 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Items</p></div>
            <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
            <div className="w-28 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Status</p></div>
            <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Date</p></div>
          </div>
          {orders.map((o) => (
            <Link key={o.id} href={`/admin/orders/${o.id}`} className="min-w-[700px] px-4 md:px-6 py-4 flex items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors block">
              <div className="w-24"><p className="text-white/60 text-sm font-mono">#{o.id.slice(0, 8).toUpperCase()}</p></div>
              <div className="flex-1">
                <p className="text-white/90 text-sm font-medium">{o.userCompanyName || o.userEmail}</p>
                {o.userCompanyName && <p className="text-white/40 text-xs">{o.userEmail}</p>}
              </div>
              <div className="w-40"><p className="text-white/60 text-sm truncate">{o.shipmentName || "Direct Order"}</p></div>
              <div className="w-20 text-center"><p className="text-white/60 text-sm">{o.itemCount}</p></div>
              <div className="w-24 text-right"><p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(o.total)}</p></div>
              <div className="w-28 text-center">
                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${statusColors[o.status] || "bg-white/10 text-white/60"}`}>{statusLabels[o.status] || o.status}</span>
              </div>
              <div className="w-24"><p className="text-white/40 text-xs">{new Date(o.createdAt).toLocaleDateString("en-GB")}</p></div>
            </Link>
          ))}
          {orders.length === 0 && (
            <div className="py-12 text-center text-white/40">No orders yet</div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
