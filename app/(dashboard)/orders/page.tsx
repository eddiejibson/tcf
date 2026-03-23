"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { UserOrderListItem } from "@/app/lib/types";
import { AnimatedList, AnimatedListItem } from "@/app/components/dashboard/AnimatedList";
import { SkeletonOrderList } from "@/app/components/dashboard/Skeleton";

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<UserOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const fetchOrders = () => {
    setLoading(true);
    setError(false);
    setForbidden(false);
    fetch("/api/orders")
      .then((res) => {
        if (res.status === 401 || res.status === 403) { setForbidden(true); return []; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setOrders)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(); }, []);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">My Orders</h1>
        <p className="text-white/50 text-sm mt-1">View your order history</p>
      </div>

      {loading ? (
        <SkeletonOrderList />
      ) : forbidden ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50">You don&apos;t have permission to view orders.</p>
          <p className="text-white/30 text-sm mt-2">Contact your company admin to request access.</p>
        </div>
      ) : error ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load orders</p>
          <button onClick={fetchOrders} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <AnimatedList className="space-y-4">
          {orders.map((o) => (
            <AnimatedListItem key={o.id}>
            <Link href={`/orders/${o.id}`} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6 hover:bg-white/[0.07] transition-all block">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-sm font-mono">#{o.id.slice(0, 8).toUpperCase()}</span>
                    <h3 className="text-white font-semibold">{o.shipmentName || "Direct Order"}</h3>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-white/40 text-sm">{o.itemCount} items</span>
                    <span className="text-white/40 text-sm">{new Date(o.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[#0984E3] font-semibold tabular-nums whitespace-nowrap">{formatPrice(o.total)}</span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${statusColors[o.status] || "bg-white/10 text-white/60"}`}>{statusLabels[o.status] || o.status}</span>
                </div>
              </div>
            </Link>
            </AnimatedListItem>
          ))}
          {orders.length === 0 && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
              <p className="text-white/40 mb-4">No orders yet</p>
              <div className="flex items-center justify-center gap-4">
                <Link href="/shipments" className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm font-medium transition-colors">Browse Shipments</Link>
                <span className="text-white/20">|</span>
                <Link href="/catalog" className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm font-medium transition-colors">Browse Catalog</Link>
              </div>
            </div>
          )}
        </AnimatedList>
      )}
    </div>
  );
}
