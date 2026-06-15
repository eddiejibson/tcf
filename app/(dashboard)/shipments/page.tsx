"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ShipmentListItem } from "@/app/lib/types";
import { AnimatedList, AnimatedListItem } from "@/app/components/dashboard/AnimatedList";
import { SkeletonShipmentGrid } from "@/app/components/dashboard/Skeleton";

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const fetchShipments = () => {
    setLoading(true);
    setError(false);
    setForbidden(false);
    fetch("/api/shipments")
      .then((res) => {
        if (res.status === 401 || res.status === 403) { setForbidden(true); return []; }
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(setShipments)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchShipments(); }, []);

  const daysUntil = (date: string) => {
    const d = Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return d;
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Available Shipments</h1>
        <p className="text-white/50 text-sm mt-1">Browse upcoming shipments and place your order</p>
      </div>

      {loading ? (
        <SkeletonShipmentGrid />
      ) : forbidden ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 py-16 text-center">
          <p className="text-white/50">You don&apos;t have permission to view shipments.</p>
          <p className="text-white/30 text-sm mt-2">Contact your company admin to request access.</p>
        </div>
      ) : error ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load shipments</p>
          <button onClick={fetchShipments} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <AnimatedList className="grid gap-4">
          {shipments.map((s) => {
            const days = daysUntil(s.deadline);
            return (
              <AnimatedListItem key={s.id}>
              <Link href={`/shipments/${s.id}`} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 p-6 block">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#0984E3]/20 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-[#0984E3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{s.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${days <= 3 ? "text-rose-300 bg-rose-400/10 ring-rose-400/20" : days <= 7 ? "text-amber-300 bg-amber-400/10 ring-amber-400/20" : "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${days <= 3 ? "bg-rose-400" : days <= 7 ? "bg-amber-400" : "bg-emerald-400"}`} />
                          {days <= 0 ? "Due today" : `${days} day${days !== 1 ? "s" : ""} left`}
                        </span>
                        <span className="text-white/40 text-sm">{s.productCount} products</span>
                        <span className="text-white/40 text-sm">Arrives {new Date(s.shipmentDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
              </AnimatedListItem>
            );
          })}
          {shipments.length === 0 && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 py-16 text-center text-white/40">
              No shipments available right now. Check back soon.
            </div>
          )}
        </AnimatedList>
      )}
    </div>
  );
}
