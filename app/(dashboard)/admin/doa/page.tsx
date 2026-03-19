"use client";

import { useState, useEffect, useCallback } from "react";
import type { DoaShipmentGroup, DoaReportDetail } from "@/app/lib/types";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  REVIEWED: "bg-blue-500/20 text-blue-400",
  REPORTED: "bg-green-500/20 text-green-400",
};

export default function AdminDoaPage() {
  const [groups, setGroups] = useState<DoaShipmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedShipments, setExpandedShipments] = useState<Set<string>>(new Set());
  const [expandedClaims, setExpandedClaims] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [reports, setReports] = useState<Record<string, DoaReportDetail>>({});
  const [reportPanelShipment, setReportPanelShipment] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/doa");
      if (!res.ok) throw new Error();
      setGroups(await res.json());
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const toggleShipment = (id: string) => {
    setExpandedShipments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleClaim = (id: string) => {
    setExpandedClaims((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleToggleApproval = async (claimId: string, itemId: string, approved: boolean) => {
    setActionLoading(itemId);
    await fetch(`/api/admin/doa/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvals: [{ itemId, approved }] }),
    });
    await fetchGroups();
    setActionLoading(null);
  };

  const handleApproveAll = async (claimId: string) => {
    setActionLoading(claimId);
    await fetch(`/api/admin/doa/${claimId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approveAll: true }),
    });
    await fetchGroups();
    setActionLoading(null);
  };

  const handleGenerateReport = async (shipmentId: string) => {
    setActionLoading(`report-${shipmentId}`);
    const res = await fetch("/api/admin/doa/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipmentId }),
    });
    if (res.ok) {
      const report = await res.json();
      const detailRes = await fetch(`/api/admin/doa/report/${report.id}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setReports((prev) => ({ ...prev, [shipmentId]: detail }));
        setReportPanelShipment(shipmentId);
      }
      await fetchGroups();
    }
    setActionLoading(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-8">DOA Claims</h1>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load DOA claims</p>
          <button onClick={fetchGroups} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-8">DOA Claims</h1>

      {groups.length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-[20px] p-12 text-center">
          <p className="text-white/40">No DOA claims yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.shipment.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
              <div
                onClick={() => toggleShipment(group.shipment.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <svg
                    className={`w-4 h-4 text-white/40 transition-transform ${expandedShipments.has(group.shipment.id) ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <div className="text-left">
                    <p className="text-white font-semibold">{group.shipment.name}</p>
                    <p className="text-white/40 text-xs">{group.claims.length} claim{group.claims.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {group.hasReport && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">Report sent</span>
                  )}
                  {!group.hasReport && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleGenerateReport(group.shipment.id); }}
                      disabled={actionLoading === `report-${group.shipment.id}`}
                      className="px-3 py-1.5 bg-[#0984E3]/10 text-[#0984E3] rounded-lg text-xs font-medium hover:bg-[#0984E3]/20 transition-all disabled:opacity-50"
                    >
                      {actionLoading === `report-${group.shipment.id}` ? "Generating..." : "Send to Exporter"}
                    </button>
                  )}
                </div>
              </div>

              {expandedShipments.has(group.shipment.id) && (
                <div className="border-t border-white/5">
                  {group.claims.map((claim) => (
                    <div key={claim.id} className="border-b border-white/5 last:border-b-0">
                      <button
                        onClick={() => toggleClaim(claim.id)}
                        className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className={`w-3 h-3 text-white/30 transition-transform ${expandedClaims.has(claim.id) ? "rotate-90" : ""}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                          <p className="text-white/80 text-sm">
                            Order #{claim.order?.id?.slice(0, 8).toUpperCase() || "???"} — {claim.order?.user?.email || "Unknown"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 text-xs">{claim.items.length} item{claim.items.length !== 1 ? "s" : ""}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColors[claim.status] || "bg-white/10 text-white/40"}`}>
                            {claim.status}
                          </span>
                        </div>
                      </button>

                      {expandedClaims.has(claim.id) && (
                        <div className="px-6 pb-4">
                          <div className="flex justify-end mb-3">
                            <button
                              onClick={() => handleApproveAll(claim.id)}
                              disabled={actionLoading === claim.id}
                              className="px-3 py-1 bg-green-500/10 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/20 transition-all disabled:opacity-50"
                            >
                              {actionLoading === claim.id ? "Approving..." : "Approve All"}
                            </button>
                          </div>
                          <div className="space-y-3">
                            {claim.items.map((item) => (
                              <div key={item.id} className="bg-white/[0.03] rounded-xl p-3">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white/90 text-sm font-medium">{item.orderItem?.name || "Item"}</p>
                                    <p className="text-white/50 text-xs">Qty DOA: {item.quantity}</p>
                                  </div>
                                  <button
                                    onClick={() => handleToggleApproval(claim.id, item.id, !item.approved)}
                                    disabled={actionLoading === item.id}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                                      item.approved
                                        ? "bg-green-500/20 text-green-400 hover:bg-red-500/20 hover:text-red-400"
                                        : "bg-white/10 text-white/40 hover:bg-green-500/20 hover:text-green-400"
                                    }`}
                                  >
                                    {actionLoading === item.id ? "..." : item.approved ? "Approved" : "Approve"}
                                  </button>
                                </div>
                                {item.imageUrls?.length > 0 && (
                                  <div className="flex gap-2 mt-2 flex-wrap">
                                    {item.imageUrls.map((url: string, i: number) => (
                                      <button key={i} onClick={() => setLightboxUrl(url)} className="shrink-0">
                                        <img src={url} alt="DOA evidence" className="w-20 h-20 object-cover rounded-lg hover:opacity-80 transition-opacity cursor-pointer" />
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {reportPanelShipment === group.shipment.id && reports[group.shipment.id] && (
                    <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02]">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-white font-semibold text-sm">Generated Report</h4>
                        {reports[group.shipment.id].downloadUrl && (
                          <a
                            href={reports[group.shipment.id].downloadUrl!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-[#0984E3] text-white rounded-lg text-xs font-medium hover:bg-[#0984E3]/80 transition-all flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download ZIP
                          </a>
                        )}
                      </div>
                      <pre className="bg-black/30 rounded-lg p-4 text-white/70 text-xs font-mono whitespace-pre-wrap overflow-auto max-h-64">
                        {reports[group.shipment.id].reportText}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl max-h-full">
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img src={lightboxUrl} alt="Full size DOA evidence" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
          </div>
        </div>
      )}
    </div>
  );
}
