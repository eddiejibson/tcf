"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AdminOrderListItem } from "@/app/lib/types";
import { AnimatedList, AnimatedListItem } from "@/app/components/dashboard/AnimatedList";
import { SkeletonTable } from "@/app/components/dashboard/Skeleton";

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
  const [error, setError] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error();
      setOrders(await res.json());
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleDelete = async (id: string) => {
    const ref = `#${id.slice(0, 8).toUpperCase()}`;
    if (!confirm(`Delete order ${ref}? This will permanently delete its items, payments, DOA claims, and credit transactions.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      setOrders((prev) => prev.filter((o) => o.id !== id));
    }
    setDeleting(null);
  };

  return (
    <div className="p-4 md:p-8">
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
        <SkeletonTable />
      ) : error ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load orders</p>
          <button onClick={() => fetchOrders()} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[760px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
            <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Order #</p></div>
            <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Customer</p></div>
            <div className="w-40"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Shipment</p></div>
            <div className="w-20 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Items</p></div>
            <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
            <div className="w-36 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Status</p></div>
            <div className="w-24"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Date</p></div>
            <div className="w-10"></div>
          </div>
          <AnimatedList>
          {orders.map((o) => (
            <AnimatedListItem key={o.id}>
            <div className="min-w-[760px] border-b border-white/5 hover:bg-white/[0.02] transition-colors flex items-center">
              <Link href={`/admin/orders/${o.id}`} className="flex-1 px-4 md:px-6 py-4 flex items-center gap-4">
                <div className="w-24"><p className="text-white/60 text-sm font-mono">#{o.id.slice(0, 8).toUpperCase()}</p></div>
                <div className="flex-1">
                  <p className="text-white/90 text-sm font-medium">{o.userCompanyName || o.userEmail || <span className="text-white/30 italic">No customer</span>}</p>
                  {o.userCompanyName && o.userEmail && <p className="text-white/40 text-xs">{o.userEmail}</p>}
                </div>
                <div className="w-40"><p className="text-white/60 text-sm truncate">{o.shipmentName || "Direct Order"}</p></div>
                <div className="w-20 text-center"><p className="text-white/60 text-sm">{o.itemCount}</p></div>
                <div className="w-24 text-right"><p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(o.total)}</p></div>
                <div className="w-36 text-center">
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${statusColors[o.status] || "bg-white/10 text-white/60"}`}>{statusLabels[o.status] || o.status}</span>
                </div>
                <div className="w-24"><p className="text-white/40 text-xs">{new Date(o.createdAt).toLocaleDateString("en-GB")}</p></div>
              </Link>
              <button
                onClick={() => handleDelete(o.id)}
                disabled={deleting === o.id}
                className="w-10 mr-4 md:mr-6 p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                title="Delete order"
              >
                {deleting === o.id ? (
                  <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                )}
              </button>
            </div>
            </AnimatedListItem>
          ))}
          </AnimatedList>
          {orders.length === 0 && (
            <div className="py-12 text-center text-white/40">No orders yet</div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
