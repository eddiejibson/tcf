"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationListItem } from "@/app/lib/types";
import { AnimatedList, AnimatedListItem } from "@/app/components/dashboard/AnimatedList";
import { SkeletonTable } from "@/app/components/dashboard/Skeleton";

const statusStyles: Record<string, { cls: string; dot: string }> = {
  PENDING: { cls: "text-amber-300 bg-amber-400/10 ring-amber-400/20", dot: "bg-amber-400" },
  APPROVED: { cls: "text-emerald-300 bg-emerald-400/10 ring-emerald-400/20", dot: "bg-emerald-400" },
  REJECTED: { cls: "text-rose-300 bg-rose-400/10 ring-rose-400/20", dot: "bg-rose-400" },
};

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<ApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "25");
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/applications?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApplications(data.applications);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [page, statusFilter]);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Applications</h1>
          <p className="text-white/50 text-sm mt-1">Review trade account applications</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="mb-5 inline-flex items-center gap-0.5 rounded-lg border border-white/[0.07] bg-white/[0.02] p-0.5">
        {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-white/[0.08] text-white shadow-sm"
                : "text-white/45 hover:text-white/80"
            }`}
          >
            {s ? s.charAt(0) + s.slice(1).toLowerCase() : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonTable />
      ) : fetchError ? (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] shadow-2xl shadow-black/40 py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load applications</p>
          <button onClick={fetchApplications} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] shadow-2xl shadow-black/40 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px] px-4 md:px-6 py-2.5 grid grid-cols-[2fr_1.5fr_2fr_1fr_1.5fr] items-center gap-4 border-b border-white/[0.07]">
              <div><p className="text-white/35 text-[11px] uppercase tracking-[0.08em] font-medium">Company</p></div>
              <div><p className="text-white/35 text-[11px] uppercase tracking-[0.08em] font-medium">Contact</p></div>
              <div><p className="text-white/35 text-[11px] uppercase tracking-[0.08em] font-medium">Email</p></div>
              <div className="text-center"><p className="text-white/35 text-[11px] uppercase tracking-[0.08em] font-medium">Status</p></div>
              <div><p className="text-white/35 text-[11px] uppercase tracking-[0.08em] font-medium">Date</p></div>
            </div>
            <AnimatedList>
            {applications.map((a) => {
              const st = statusStyles[a.status] || { cls: "text-white/50 bg-white/5 ring-white/10", dot: "bg-white/40" };
              return (
              <AnimatedListItem key={a.id}>
              <div
                onClick={() => router.push(`/admin/applications/${a.id}`)}
                className="group min-w-[640px] px-4 md:px-6 py-3.5 grid grid-cols-[2fr_1.5fr_2fr_1fr_1.5fr] items-center gap-4 border-b border-white/[0.05] last:border-b-0 hover:bg-white/[0.035] transition-colors cursor-pointer"
              >
                <div><p className="text-white text-sm font-medium truncate">{a.companyName}</p></div>
                <div><p className="text-white/55 text-sm truncate">{a.contactName}</p></div>
                <div><p className="text-white/55 text-sm truncate">{a.contactEmail}</p></div>
                <div className="text-center">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${st.cls}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                    {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                  </span>
                </div>
                <div><p className="text-white/45 text-xs tabular-nums">{new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div>
              </div>
              </AnimatedListItem>
              );
            })}
            </AnimatedList>
            {applications.length === 0 && (
              <div className="py-12 text-center text-white/40">
                {statusFilter ? "No applications with this status" : "No applications yet"}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="px-4 md:px-6 py-3 border-t border-white/[0.07] flex items-center justify-between">
              <p className="text-white/40 text-xs">
                {total} application{total !== 1 ? "s" : ""} total
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 text-xs font-medium hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="text-white/50 text-xs tabular-nums">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 text-xs font-medium hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
