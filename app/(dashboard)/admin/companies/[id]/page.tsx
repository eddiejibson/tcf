"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface AddressData {
  id: string;
  type: "BILLING" | "SHIPPING";
  line1: string;
  line2: string | null;
  city: string;
  county: string | null;
  postcode: string;
  country: string;
}

interface CompanyDetail {
  id: string;
  name: string;
  companyNumber: string | null;
  discount: number;
  createdAt: string;
  users: { id: string; email: string; companyRole: string | null; lastLogin: string | null }[];
  addresses: AddressData[];
}

function formatAddress(a: { line1: string; line2?: string | null; city: string; county?: string | null; postcode: string; country: string }) {
  return [a.line1, a.line2, a.city, a.county, a.postcode, a.country].filter(Boolean).join(", ");
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [editName, setEditName] = useState("");
  const [editNumber, setEditNumber] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [editAddresses, setEditAddresses] = useState<AddressData[]>([]);

  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const fetchCompany = useCallback(async () => {
    const res = await fetch(`/api/admin/companies/${params.id}`);
    if (res.ok) setCompany(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  const startEditing = () => {
    if (!company) return;
    setEditName(company.name);
    setEditNumber(company.companyNumber || "");
    setEditDiscount(String(company.discount));
    setEditAddresses(company.addresses.map((a) => ({ ...a })));
    setEditing(true);
  };

  const saveEdits = async () => {
    if (!company) return;
    setSaving(true);
    const res = await fetch(`/api/admin/companies/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editName,
        companyNumber: editNumber || null,
        discount: parseFloat(editDiscount) || 0,
        addresses: editAddresses.map((a) => ({ id: a.id, line1: a.line1, line2: a.line2, city: a.city, county: a.county, postcode: a.postcode, country: a.country })),
      }),
    });
    if (res.ok) {
      await fetchCompany();
      setEditing(false);
    }
    setSaving(false);
  };

  const handleResend = async () => {
    setResending(true);
    const res = await fetch(`/api/admin/companies/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resendWelcome: true }),
    });
    if (res.ok) {
      setResendDone(true);
      setTimeout(() => setResendDone(false), 2500);
    }
    setResending(false);
  };

  const updateAddress = (index: number, field: keyof AddressData, value: string) => {
    setEditAddresses((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!company) return <div className="p-4 md:p-8 text-white/40">Company not found</div>;

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/companies")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Companies
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{company.name}</h1>
          {company.companyNumber && <p className="text-white/40 text-sm mt-1">Company #{company.companyNumber}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleResend}
            disabled={resending}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            {resending ? (
              <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
            ) : resendDone ? (
              <>
                <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span className="text-emerald-400">Sent</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                Resend Welcome
              </>
            )}
          </button>
          {!editing ? (
            <button onClick={startEditing} className="px-4 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all">Edit</button>
          ) : (
            <>
              <button onClick={saveEdits} disabled={saving} className="px-4 py-1.5 bg-[#0984E3] text-white text-sm font-medium rounded-lg hover:bg-[#0984E3]/90 disabled:bg-white/10 transition-all">{saving ? "Saving..." : "Save"}</button>
              <button onClick={() => setEditing(false)} className="px-4 py-1.5 text-white/50 hover:text-white text-sm transition-colors">Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-4">Company Details</h3>
          <div className="space-y-4">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Name</p>
              {editing ? <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" /> : <p className="text-white text-sm">{company.name}</p>}
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Company Number</p>
              {editing ? <input value={editNumber} onChange={(e) => setEditNumber(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" placeholder="e.g. 12345678" /> : <p className="text-white text-sm">{company.companyNumber || "—"}</p>}
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Discount</p>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input type="number" min="0" max="100" step="0.01" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <span className="text-white/40 text-sm">%</span>
                </div>
              ) : <p className={`text-sm font-medium ${company.discount > 0 ? "text-[#0984E3]" : "text-white/40"}`}>{company.discount}%</p>}
            </div>
          </div>
        </div>

        {/* Users */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-4">Users ({company.users.length})</h3>
          {company.users.length === 0 ? (
            <p className="text-white/30 text-sm">No users linked</p>
          ) : (
            <div className="space-y-3">
              {company.users.map((u) => (
                <Link key={u.id} href={`/admin/users/${u.id}`} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.06] transition-colors">
                  <div>
                    <p className="text-white/90 text-sm">{u.email}</p>
                    <p className="text-white/30 text-xs mt-0.5">{u.lastLogin ? `Last login ${new Date(u.lastLogin).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Never logged in"}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${u.companyRole === "OWNER" ? "bg-[#0984E3]/20 text-[#0984E3]" : "bg-white/10 text-white/50"}`}>
                    {u.companyRole || "MEMBER"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Addresses */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6 lg:col-span-2">
          <h3 className="text-white font-semibold mb-4">Addresses</h3>
          {company.addresses.length === 0 && !editing ? (
            <p className="text-white/30 text-sm">No addresses on file</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(editing ? editAddresses : company.addresses).map((addr, i) => (
                <div key={addr.id}>
                  <p className="text-[#0984E3] text-[10px] uppercase tracking-wider font-medium mb-2">
                    {addr.type === "BILLING" ? "Billing Address" : "Shipping Address"}
                  </p>
                  {editing ? (
                    <div className="space-y-2">
                      <input value={editAddresses[i]?.line1 || ""} onChange={(e) => updateAddress(i, "line1", e.target.value)} placeholder="Address line 1" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                      <input value={editAddresses[i]?.line2 || ""} onChange={(e) => updateAddress(i, "line2", e.target.value)} placeholder="Address line 2" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editAddresses[i]?.city || ""} onChange={(e) => updateAddress(i, "city", e.target.value)} placeholder="City" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                        <input value={editAddresses[i]?.county || ""} onChange={(e) => updateAddress(i, "county", e.target.value)} placeholder="County" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editAddresses[i]?.postcode || ""} onChange={(e) => updateAddress(i, "postcode", e.target.value)} placeholder="Postcode" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                        <input value={editAddresses[i]?.country || ""} onChange={(e) => updateAddress(i, "country", e.target.value)} placeholder="Country" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-white/80 text-sm leading-relaxed">{formatAddress(addr)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
