"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { AdminShipmentListItem } from "@/app/lib/types";
import { AnimatedList, AnimatedListItem } from "@/app/components/dashboard/AnimatedList";
import { SkeletonOrderList } from "@/app/components/dashboard/Skeleton";

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/60",
  ACTIVE: "bg-green-500/20 text-green-400",
  CLOSED: "bg-red-500/20 text-red-400",
};

export default function AdminShipmentsPage() {
  const [shipments, setShipments] = useState<AdminShipmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchShipments = useCallback(async (p: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/admin/shipments?page=${p}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setShipments(data.shipments || []);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchShipments(page); }, [fetchShipments, page]);

  const handleStatusChange = async (id: string, status: string) => {
    setShipments((prev) => prev.map((s) => s.id === id ? { ...s, status: status as AdminShipmentListItem["status"] } : s));
    await fetch(`/api/admin/shipments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This will permanently delete all products, orders, and claims associated with this shipment.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/shipments/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchShipments(page);
    }
    setDeleting(null);
  };

  return (
    <div className="p-4 md:p-8">
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
        <SkeletonOrderList />
      ) : error ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load shipments</p>
          <button onClick={() => fetchShipments(page)} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <>
          <AnimatedList className="space-y-4">
            {shipments.map((s) => (
              <AnimatedListItem key={s.id}>
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center justify-between">
                  <Link href={`/admin/shipments/${s.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-[#0984E3]/20 flex items-center justify-center shrink-0">
                      <svg className="w-6 h-6 text-[#0984E3]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-white font-semibold truncate">{s.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-1">
                        <span className="text-amber-400 text-sm">Deadline: {new Date(s.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <span className="text-white/40 text-sm">{s.productCount} products</span>
                        <span className="text-white/40 text-sm">{s.orderCount} orders</span>
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
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
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      disabled={deleting === s.id}
                      className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Delete shipment"
                    >
                      {deleting === s.id ? (
                        <div className="w-5 h-5 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      )}
                    </button>
                    <Link href={`/admin/shipments/${s.id}`}>
                      <svg className="w-5 h-5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </Link>
                  </div>
                </div>
              </div>
              </AnimatedListItem>
            ))}
          </AnimatedList>
            {shipments.length === 0 && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center text-white/40">
                No shipments yet. Upload an Excel file to create one.
              </div>
            )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-white/40 text-sm px-3">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
