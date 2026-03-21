"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ShipmentListItem } from "@/app/lib/types";

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
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : forbidden ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50">You don&apos;t have permission to view shipments.</p>
          <p className="text-white/30 text-sm mt-2">Contact your company admin to request access.</p>
        </div>
      ) : error ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load shipments</p>
          <button onClick={fetchShipments} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {shipments.map((s) => {
            const days = daysUntil(s.deadline);
            return (
              <Link key={s.id} href={`/shipments/${s.id}`} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 hover:bg-white/[0.07] transition-all block">
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
                        <span className={`text-sm font-medium ${days <= 3 ? "text-red-400" : days <= 7 ? "text-amber-400" : "text-green-400"}`}>
                          {days} day{days !== 1 ? "s" : ""} left
                        </span>
                        <span className="text-white/40 text-sm">{s.productCount} products</span>
                        <span className="text-white/40 text-sm">Ships {new Date(s.shipmentDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
                      </div>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            );
          })}
          {shipments.length === 0 && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center text-white/40">
              No shipments available right now. Check back soon.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
