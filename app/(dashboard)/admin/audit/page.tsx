"use client";

import { useState, useEffect, useCallback } from "react";
import { SkeletonTable } from "@/app/components/dashboard/Skeleton";

interface AuditLogRow {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorEmail: string | null;
  meta: Record<string, unknown> | null;
}

interface Facets {
  actions: string[];
  entityTypes: string[];
  actors: { actorId: string; actorEmail: string | null }[];
}

const ACTION_COLORS: Record<string, string> = {
  delete: "bg-red-500/10 text-red-400 border-red-500/20",
  remove: "bg-red-500/10 text-red-400 border-red-500/20",
  reject: "bg-red-500/10 text-red-400 border-red-500/20",
  create: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  restore: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  approve: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  accept: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  login: "bg-[#0984E3]/10 text-[#0984E3] border-[#0984E3]/20",
  sudo: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

function actionColor(action: string) {
  const verb = action.split(".").pop() || "";
  for (const key of Object.keys(ACTION_COLORS)) {
    if (verb.includes(key)) return ACTION_COLORS[key];
  }
  return "bg-white/5 text-white/60 border-white/10";
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [facets, setFacets] = useState<Facets>({ actions: [], entityTypes: [], actors: [] });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Filters & pagination
  const [actorId, setActorId] = useState("");
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams();
      if (actorId) params.set("actorId", actorId);
      if (action) params.set("action", action);
      if (entityType) params.set("entityType", entityType);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      const res = await fetch(`/api/admin/audit?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLogs(data.logs);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setFacets(data.facets);
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [actorId, action, entityType, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const hasFilters = actorId || action || entityType;

  const selectClass = "appearance-none px-4 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 cursor-pointer";
  const chevron = (
    <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
          <p className="text-white/40 text-sm mt-1">Every action on the portal — who did what, and when.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <select value={actorId} onChange={(e) => { setActorId(e.target.value); setPage(1); }} className={selectClass}>
            <option value="" className="bg-[#1a1f26] text-white">All users</option>
            {facets.actors.map((a) => (
              <option key={a.actorId} value={a.actorId} className="bg-[#1a1f26] text-white">{a.actorEmail || a.actorId}</option>
            ))}
          </select>
          {chevron}
        </div>
        <div className="relative">
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={selectClass}>
            <option value="" className="bg-[#1a1f26] text-white">All actions</option>
            {facets.actions.map((a) => (
              <option key={a} value={a} className="bg-[#1a1f26] text-white">{a}</option>
            ))}
          </select>
          {chevron}
        </div>
        <div className="relative">
          <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} className={selectClass}>
            <option value="" className="bg-[#1a1f26] text-white">All record types</option>
            {facets.entityTypes.map((t) => (
              <option key={t} value={t} className="bg-[#1a1f26] text-white">{t}</option>
            ))}
          </select>
          {chevron}
        </div>
        {hasFilters && (
          <button
            onClick={() => { setActorId(""); setAction(""); setEntityType(""); setPage(1); }}
            className="px-3 py-2 text-white/40 hover:text-white/70 text-xs font-medium transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <SkeletonTable />
      ) : fetchError ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load audit log</p>
          <button onClick={() => fetchLogs()} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] shadow-2xl shadow-black/40 overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="px-4 md:px-6 py-3 grid grid-cols-[10rem_2.5fr_2fr_1.5fr_3fr] items-center gap-4 border-b border-white/10 bg-white/[0.02]">
                <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">When</p></div>
                <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Who</p></div>
                <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Action</p></div>
                <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Record</p></div>
                <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Details</p></div>
              </div>
              {logs.map((l) => (
                <div key={l.id}>
                  <div
                    onClick={() => setExpanded(expanded === l.id ? null : l.id)}
                    className="px-4 md:px-6 py-3 grid grid-cols-[10rem_2.5fr_2fr_1.5fr_3fr] items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="text-white/60 text-xs tabular-nums">
                        {new Date(l.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white/80 text-sm truncate">{l.actorEmail || <span className="text-white/30 italic">system / anonymous</span>}</p>
                    </div>
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-medium ${actionColor(l.action)}`}>{l.action}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white/50 text-xs truncate">
                        {l.entityType}
                        {l.entityId ? <span className="text-white/25"> · {l.entityId.slice(0, 8)}</span> : null}
                      </p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white/40 text-xs truncate font-mono">
                        {l.meta ? JSON.stringify(l.meta) : "—"}
                      </p>
                    </div>
                  </div>
                  {expanded === l.id && l.meta && (
                    <div className="px-4 md:px-6 py-3 border-b border-white/5 bg-black/20">
                      <pre className="text-white/60 text-xs font-mono whitespace-pre-wrap break-all">{JSON.stringify(l.meta, null, 2)}</pre>
                      {l.entityId && <p className="text-white/30 text-[11px] mt-2 font-mono">record id: {l.entityId}</p>}
                      {l.actorId && <p className="text-white/30 text-[11px] font-mono">actor id: {l.actorId}</p>}
                    </div>
                  )}
                </div>
              ))}
              {logs.length === 0 && (
                <div className="py-16 text-center text-white/40 text-sm">
                  {hasFilters ? "No audit entries match your filters" : "No audit entries yet"}
                </div>
              )}
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 md:px-6 py-3 border-t border-white/10 flex items-center justify-between">
              <p className="text-white/40 text-xs">
                {total} entr{total !== 1 ? "ies" : "y"} total
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
