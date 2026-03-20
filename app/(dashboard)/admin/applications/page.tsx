"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ApplicationListItem } from "@/app/lib/types";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  APPROVED: "bg-green-500/20 text-green-400",
  REJECTED: "bg-red-500/20 text-red-400",
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
      <div className="flex gap-2 mb-4">
        {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-[#0984E3]/20 text-[#0984E3]"
                : "bg-white/5 text-white/50 hover:text-white/80 hover:bg-white/10"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : fetchError ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load applications</p>
          <button onClick={fetchApplications} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px] px-4 md:px-6 py-3 grid grid-cols-[2fr_1.5fr_2fr_1fr_1.5fr] items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Company</p></div>
              <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Contact</p></div>
              <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Email</p></div>
              <div className="text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Status</p></div>
              <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Date</p></div>
            </div>
            {applications.map((a) => (
              <div
                key={a.id}
                onClick={() => router.push(`/admin/applications/${a.id}`)}
                className="min-w-[640px] px-4 md:px-6 py-4 grid grid-cols-[2fr_1.5fr_2fr_1fr_1.5fr] items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div><p className="text-white/90 text-sm font-medium truncate">{a.companyName}</p></div>
                <div><p className="text-white/60 text-sm truncate">{a.contactName}</p></div>
                <div><p className="text-white/60 text-sm truncate">{a.contactEmail}</p></div>
                <div className="text-center">
                  <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${statusColors[a.status] || ""}`}>
                    {a.status}
                  </span>
                </div>
                <div><p className="text-white/40 text-xs">{new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p></div>
              </div>
            ))}
            {applications.length === 0 && (
              <div className="py-12 text-center text-white/40">
                {statusFilter ? "No applications with this status" : "No applications yet"}
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="px-4 md:px-6 py-3 border-t border-white/10 flex items-center justify-between">
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
