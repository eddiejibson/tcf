"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AdminShipmentListItem } from "@/app/lib/types";

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/60",
  ACTIVE: "bg-green-500/20 text-green-400",
  CLOSED: "bg-red-500/20 text-red-400",
};

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<AdminShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShipments = useCallback(async () => {
    const res = await fetch("/api/admin/shipments");
    if (res.ok) setShipments(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchShipments(); }, [fetchShipments]);

  const handleStatusChange = async (id: string, status: string) => {
    setShipments((prev) => prev.map((s) => s.id === id ? { ...s, status: status as AdminShipmentListItem["status"] } : s));
    await fetch(`/api/admin/shipments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Shipments</h1>
          <p className="text-white/50 text-sm mt-1">Manage incoming shipments and products</p>
        </div>
        <Link
          href="/admin/shipments/new"
          className="px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all"
        >
          Create Shipment
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {shipments.map((s) => (
            <Link key={s.id} href={`/admin/shipments/${s.id}`} className="block bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 hover:bg-white/[0.07] transition-colors">
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
                      <span className="text-amber-400 text-sm">Deadline: {new Date(s.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                      <span className="text-white/40 text-sm">{s.productCount} products</span>
                      <span className="text-white/40 text-sm">{s.orderCount} orders</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative" onClick={(e) => e.preventDefault()}>
                    <select
                      value={s.status}
                      onChange={(e) => { e.preventDefault(); handleStatusChange(s.id, e.target.value); }}
                      className={`appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium border-0 focus:outline-none cursor-pointer ${statusColors[s.status]}`}
                    >
                      <option value="DRAFT" className="bg-[#1a1f26] text-white">DRAFT</option>
                      <option value="ACTIVE" className="bg-[#1a1f26] text-white">ACTIVE</option>
                      <option value="CLOSED" className="bg-[#1a1f26] text-white">CLOSED</option>
                    </select>
                    <svg className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            </Link>
          ))}
          {shipments.length === 0 && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center text-white/40">
              No shipments yet. Upload an Excel file to create one.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
