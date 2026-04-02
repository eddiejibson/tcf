"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface CompanyRow {
  id: string;
  name: string;
  discount: number;
  creditBalance: number;
  userCount: number;
  createdAt: string;
}

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendDoneId, setResendDoneId] = useState<string | null>(null);
  const [creditCompanyId, setCreditCompanyId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/companies");
      if (!res.ok) throw new Error();
      setCompanies(await res.json());
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const startEdit = (company: CompanyRow) => {
    setEditingId(company.id);
    setEditValue(String(company.discount));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveDiscount = async (id: string) => {
    const num = Number(editValue);
    if (isNaN(num) || num < 0 || num > 100) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/companies/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discount: num }),
      });
      if (res.ok) {
        setCompanies((prev) =>
          prev.map((c) => (c.id === id ? { ...c, discount: num } : c))
        );
        setEditingId(null);
      }
    } catch {
      // ignore
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Companies</h1>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-8">
          <div className="animate-pulse space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Companies</h1>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load companies</p>
          <button
            onClick={fetchCompanies}
            className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Companies</h1>
          <p className="text-white/50 text-sm mt-1">Manage company discounts</p>
        </div>
        <Link href="/admin/companies/new" className="px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
          Add Company
        </Link>
      </div>

      {creditCompanyId && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Adjust Credit for {companies.find((c) => c.id === creditCompanyId)?.name}</p>
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!creditCompanyId || !creditAmount) return;
            setCreditSaving(true);
            const res = await fetch(`/api/admin/companies/${creditCompanyId}/credit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ amount: parseFloat(creditAmount), description: creditDescription }),
            });
            if (res.ok) {
              setCreditCompanyId(null);
              setCreditAmount("");
              setCreditDescription("");
              fetchCompanies();
            }
            setCreditSaving(false);
          }} className="flex flex-wrap items-end gap-3 md:gap-4">
            <div className="w-36">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Amount</label>
              <input type="number" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm" placeholder="10.00" required autoFocus />
            </div>
            <div className="flex-1">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Description</label>
              <input type="text" value={creditDescription} onChange={(e) => setCreditDescription(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm" placeholder="Reason for adjustment..." />
            </div>
            <button type="submit" disabled={creditSaving || !creditAmount} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all">{creditSaving ? "Saving..." : "Apply"}</button>
            <button type="button" onClick={() => { setCreditCompanyId(null); setCreditAmount(""); setCreditDescription(""); }} className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors">Cancel</button>
          </form>
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[1fr_80px_100px_120px_120px_80px] gap-4 px-6 py-3 border-b border-white/10 bg-white/[0.02]">
          <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Company</p>
          <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Users</p>
          <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Discount</p>
          <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Credit</p>
          <p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Created</p>
          <div></div>
        </div>

        {companies.length === 0 ? (
          <div className="px-6 py-12 text-center text-white/30 text-sm">
            No companies found
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {companies.map((company) => (
              <div
                key={company.id}
                className="grid grid-cols-1 md:grid-cols-[1fr_80px_100px_120px_120px_80px] gap-2 md:gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors items-center"
              >
                <Link href={`/admin/companies/${company.id}`} className="block hover:opacity-80 transition-opacity">
                  <p className="text-white/90 text-sm font-semibold">{company.name}</p>
                  <p className="text-white/30 text-xs md:hidden mt-0.5">
                    {company.userCount} user{company.userCount !== 1 ? "s" : ""}
                  </p>
                </Link>
                <p className="hidden md:block text-white/50 text-sm">{company.userCount}</p>
                <div>
                  {editingId === company.id ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveDiscount(company.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        autoFocus
                        className="w-16 px-2 py-1 bg-white/5 border border-white/20 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-white/30 text-xs">%</span>
                      <button
                        onClick={() => saveDiscount(company.id)}
                        disabled={saving}
                        className="w-6 h-6 rounded bg-[#0984E3]/20 text-[#0984E3] flex items-center justify-center hover:bg-[#0984E3]/30 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="w-6 h-6 rounded bg-white/5 text-white/40 flex items-center justify-center hover:bg-white/10 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEdit(company)}
                      className="group flex items-center gap-1.5"
                    >
                      <span className={`text-sm font-medium ${company.discount > 0 ? "text-[#0984E3]" : "text-white/40"}`}>
                        {company.discount}%
                      </span>
                      <svg
                        className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="hidden md:flex items-center gap-1.5">
                  <span className={`text-sm font-medium tabular-nums ${company.creditBalance > 0 ? "text-emerald-400" : "text-white/40"}`}>{formatPrice(company.creditBalance)}</span>
                  <button
                    onClick={() => setCreditCompanyId(creditCompanyId === company.id ? null : company.id)}
                    className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[10px] text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  >Adj</button>
                </div>
                <p className="hidden md:block text-white/30 text-xs">
                  {new Date(company.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <div className="hidden md:block">
                  <button
                    onClick={async () => {
                      setResendingId(company.id);
                      setResendDoneId(null);
                      const res = await fetch(`/api/admin/companies/${company.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ resendWelcome: true }),
                      });
                      if (res.ok) {
                        setResendDoneId(company.id);
                        setTimeout(() => setResendDoneId(null), 2500);
                      }
                      setResendingId(null);
                    }}
                    disabled={resendingId === company.id}
                    className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white hover:bg-white/10 text-[11px] font-medium transition-all flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                  >
                    {resendingId === company.id ? (
                      <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                    ) : resendDoneId === company.id ? (
                      <>
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        <span className="text-emerald-400">Sent</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                        Resend
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
