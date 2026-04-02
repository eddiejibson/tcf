"use client";

import { useState, useEffect, useCallback } from "react";

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

interface CompanyData {
  id: string;
  name: string;
  companyNumber: string | null;
  addresses: AddressData[];
}

function formatAddress(a: { line1: string; line2?: string | null; city: string; county?: string | null; postcode: string; country: string }) {
  return [a.line1, a.line2, a.city, a.county, a.postcode, a.country].filter(Boolean).join(", ");
}

export default function CompanyPage() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editAddresses, setEditAddresses] = useState<AddressData[]>([]);

  const fetchCompany = useCallback(async () => {
    const res = await fetch("/api/company");
    if (res.ok) {
      setCompany(await res.json());
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCompany(); }, [fetchCompany]);

  const startEditing = () => {
    if (!company) return;
    setEditAddresses(company.addresses.map((a) => ({ ...a })));
    setEditing(true);
  };

  const updateAddress = (index: number, field: keyof AddressData, value: string) => {
    setEditAddresses((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const saveEdits = async () => {
    setSaving(true);
    const res = await fetch("/api/company", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: editAddresses.map((a) => ({
          id: a.id,
          line1: a.line1,
          line2: a.line2,
          city: a.city,
          county: a.county,
          postcode: a.postcode,
          country: a.country,
        })),
      }),
    });
    if (res.ok) {
      await fetchCompany();
      setEditing(false);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  if (error || !company) return (
    <div className="p-4 md:p-8">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
        <p className="text-white/40">No company linked to your account.</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{company.name}</h1>
          {company.companyNumber && <p className="text-white/40 text-sm mt-1">Company #{company.companyNumber}</p>}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button onClick={startEditing} className="px-4 py-2 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-xl hover:bg-[#0984E3]/30 transition-all">
              Edit Addresses
            </button>
          ) : (
            <>
              <button onClick={saveEdits} disabled={saving} className="px-4 py-2 bg-[#0984E3] text-white text-sm font-medium rounded-xl hover:bg-[#0984E3]/90 disabled:bg-white/10 transition-all">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={() => setEditing(false)} className="px-4 py-2 text-white/50 hover:text-white text-sm transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {company.addresses.length === 0 && !editing ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/30">No addresses on file. Contact your admin to add addresses.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {(editing ? editAddresses : company.addresses).map((addr, i) => (
            <div key={addr.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
              <p className={`text-[10px] uppercase tracking-wider font-medium mb-3 ${addr.type === "SHIPPING" ? "text-[#0984E3]" : "text-white/50"}`}>
                {addr.type === "BILLING" ? "Billing Address" : "Shipping Address"}
              </p>
              {editing ? (
                <div className="space-y-2">
                  <input value={editAddresses[i]?.line1 || ""} onChange={(e) => updateAddress(i, "line1", e.target.value)} placeholder="Address line 1" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
                  <input value={editAddresses[i]?.line2 || ""} onChange={(e) => updateAddress(i, "line2", e.target.value)} placeholder="Address line 2" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editAddresses[i]?.city || ""} onChange={(e) => updateAddress(i, "city", e.target.value)} placeholder="City" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
                    <input value={editAddresses[i]?.county || ""} onChange={(e) => updateAddress(i, "county", e.target.value)} placeholder="County" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editAddresses[i]?.postcode || ""} onChange={(e) => updateAddress(i, "postcode", e.target.value)} placeholder="Postcode" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
                    <input value={editAddresses[i]?.country || ""} onChange={(e) => updateAddress(i, "country", e.target.value)} placeholder="Country" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
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
  );
}
