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

interface ApplicationData {
  id: string;
  companyName: string;
  companyNumber: string | null;
  contactName: string;
  contactEmail: string;
  phone: string | null;
  accountsName: string | null;
  accountsEmail: string | null;
  additionalInfo: string | null;
  status: string;
  billingAddress: { line1: string; line2?: string; city: string; county?: string; postcode: string; country: string } | null;
  shippingAddress: { line1: string; line2?: string; city: string; county?: string; postcode: string; country: string } | null;
  createdAt: string;
}

interface UserDetail {
  id: string;
  email: string;
  role: string;
  companyName: string | null;
  companyId: string | null;
  companyRole: string | null;
  creditBalance: number;
  lastLogin: string | null;
  createdAt: string;
  orderCount: number;
  company: { id: string; name: string; companyNumber: string | null } | null;
  addresses: AddressData[];
  application: ApplicationData | null;
}

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatAddress(a: { line1: string; line2?: string | null; city: string; county?: string | null; postcode: string; country: string }) {
  return [a.line1, a.line2, a.city, a.county, a.postcode, a.country].filter(Boolean).join(", ");
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editCompanyNumber, setEditCompanyNumber] = useState("");
  const [editAddresses, setEditAddresses] = useState<AddressData[]>([]);

  const fetchUser = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${params.id}`);
    if (res.ok) {
      const data = await res.json();
      setUser(data);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const startEditing = () => {
    if (!user) return;
    setEditEmail(user.email);
    setEditCompanyName(user.companyName || "");
    setEditCompanyNumber(user.company?.companyNumber || "");
    setEditAddresses(user.addresses.map((a) => ({ ...a })));
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const updateAddress = (index: number, field: keyof AddressData, value: string) => {
    setEditAddresses((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const saveEdits = async () => {
    if (!user) return;
    setSaving(true);
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: editEmail,
        companyName: editCompanyName || null,
        companyNumber: editCompanyNumber || null,
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
      await fetchUser();
      setEditing(false);
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!user) return <div className="p-4 md:p-8 text-white/40">User not found</div>;

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/users")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Users
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">{user.companyName || user.email}</h1>
          {user.companyName && <p className="text-white/50 text-sm mt-1">{user.email}</p>}
          <div className="flex items-center gap-3 mt-2">
            <span className={`px-3 py-1 rounded-lg text-xs font-medium ${user.role === "ADMIN" ? "bg-[#0984E3]/20 text-[#0984E3]" : "bg-white/10 text-white/60"}`}>
              {user.role}
            </span>
            {user.companyRole && (
              <span className="text-white/40 text-xs">{user.companyRole === "OWNER" ? "Company Admin" : "Team Member"}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <button onClick={startEditing} className="px-4 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-lg hover:bg-[#0984E3]/30 transition-all">
              Edit
            </button>
          ) : (
            <>
              <button onClick={saveEdits} disabled={saving} className="px-4 py-1.5 bg-[#0984E3] text-white text-sm font-medium rounded-lg hover:bg-[#0984E3]/90 disabled:bg-white/10 transition-all">
                {saving ? "Saving..." : "Save"}
              </button>
              <button onClick={cancelEditing} className="px-4 py-1.5 text-white/50 hover:text-white text-sm transition-colors">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Account Details */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-4">Account Details</h3>
          <div className="space-y-4">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Email</p>
              {editing ? (
                <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
              ) : (
                <p className="text-white text-sm">{user.email}</p>
              )}
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Company Name</p>
              {editing ? (
                <input value={editCompanyName} onChange={(e) => setEditCompanyName(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
              ) : (
                <p className="text-white text-sm">{user.companyName || "—"}</p>
              )}
            </div>
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Company Number</p>
              {editing ? (
                <input value={editCompanyNumber} onChange={(e) => setEditCompanyNumber(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" placeholder="e.g. 12345678" />
              ) : (
                <p className="text-white text-sm">{user.company?.companyNumber || "—"}</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-white/5">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Orders</p>
                <p className="text-white text-sm font-semibold">{user.orderCount}</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Credit</p>
                <p className={`text-sm font-semibold ${user.creditBalance > 0 ? "text-emerald-400" : "text-white/40"}`}>
                  {formatPrice(user.creditBalance)}
                </p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Last Login</p>
                <p className="text-white/60 text-sm">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-4">Addresses</h3>
          {user.addresses.length === 0 && !editing ? (
            <p className="text-white/30 text-sm">No addresses on file</p>
          ) : (
            <div className="space-y-5">
              {(editing ? editAddresses : user.addresses).map((addr, i) => (
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

        {/* Application Info */}
        {user.application && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Application</h3>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  user.application.status === "APPROVED" ? "bg-green-500/20 text-green-400" :
                  user.application.status === "REJECTED" ? "bg-red-500/20 text-red-400" :
                  "bg-amber-500/20 text-amber-400"
                }`}>
                  {user.application.status}
                </span>
                <Link href={`/admin/applications/${user.application.id}`} className="text-[#0984E3] text-xs font-medium hover:text-[#0984E3]/80 transition-colors">
                  View Full Application
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Contact Name</p>
                <p className="text-white text-sm">{user.application.contactName}</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Contact Email</p>
                <p className="text-white text-sm">{user.application.contactEmail}</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Phone</p>
                <p className="text-white text-sm">{user.application.phone || "—"}</p>
              </div>
              {user.application.accountsName && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Accounts Contact</p>
                  <p className="text-white text-sm">{user.application.accountsName}</p>
                </div>
              )}
              {user.application.accountsEmail && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Accounts Email</p>
                  <p className="text-white text-sm">{user.application.accountsEmail}</p>
                </div>
              )}
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Applied</p>
                <p className="text-white/60 text-sm">{new Date(user.application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              {user.application.additionalInfo && (
                <div className="sm:col-span-2 md:col-span-3">
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Additional Info</p>
                  <p className="text-white/70 text-sm">{user.application.additionalInfo}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
