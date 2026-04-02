"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

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
  createdAt: string;
}

interface CompanyUser {
  id: string;
  email: string;
  companyRole: string | null;
}

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
  company: { id: string; name: string; companyNumber: string | null; discount: number; users: CompanyUser[] } | null;
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
  const [editing, setEditing] = useState(false);
  const [editEmail, setEditEmail] = useState("");

  const fetchUser = useCallback(async () => {
    const res = await fetch(`/api/admin/users/${params.id}`);
    if (res.ok) setUser(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const startEditing = () => {
    if (!user) return;
    setEditEmail(user.email);
    setEditing(true);
  };

  const saveEdits = async () => {
    if (!user) return;
    setSaving(true);
    const res = await fetch(`/api/admin/users/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: editEmail }),
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
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Orders</p>
                <p className="text-white text-sm font-semibold">{user.orderCount}</p>
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Last Login</p>
                <p className="text-white/60 text-sm">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Never"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Connected Company */}
        {user.company ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Company</h3>
              <Link href={`/admin/companies/${user.company.id}`} className="text-[#0984E3] text-xs font-medium hover:text-[#0984E3]/80 transition-colors flex items-center gap-1">
                Edit Company
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Name</p>
                <p className="text-white text-sm font-medium">{user.company.name}</p>
              </div>
              {user.company.companyNumber && (
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Company Number</p>
                  <p className="text-white/70 text-sm">{user.company.companyNumber}</p>
                </div>
              )}
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Discount</p>
                <p className={`text-sm font-medium ${user.company.discount > 0 ? "text-[#0984E3]" : "text-white/40"}`}>{user.company.discount}%</p>
              </div>
              {/* Team members */}
              <div className="pt-3 border-t border-white/5">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-2">Team ({user.company.users.length})</p>
                <div className="space-y-1.5">
                  {user.company.users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between">
                      <Link href={`/admin/users/${u.id}`} className={`text-sm hover:text-white transition-colors ${u.id === user.id ? "text-white font-medium" : "text-white/60"}`}>
                        {u.email}
                      </Link>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${u.companyRole === "OWNER" ? "bg-[#0984E3]/15 text-[#0984E3]" : "bg-white/5 text-white/40"}`}>
                        {u.companyRole || "MEMBER"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {/* Addresses preview */}
              {user.addresses.length > 0 && (
                <div className="pt-3 border-t border-white/5">
                  <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-2">Addresses</p>
                  <div className="space-y-2">
                    {user.addresses.map((addr) => (
                      <div key={addr.id}>
                        <p className="text-white/30 text-[10px] uppercase tracking-wider mb-0.5">{addr.type}</p>
                        <p className="text-white/60 text-xs leading-relaxed">{formatAddress(addr)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : user.role !== "ADMIN" ? (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
            <h3 className="text-white font-semibold mb-4">Company</h3>
            <p className="text-white/30 text-sm mb-3">No company linked to this user</p>
            <Link href={`/admin/companies/new?email=${encodeURIComponent(user.email)}&userId=${user.id}`} className="text-[#0984E3] text-sm font-medium hover:text-[#0984E3]/80 transition-colors">+ Add Company</Link>
          </div>
        ) : null}

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
                }`}>{user.application.status}</span>
                <Link href={`/admin/applications/${user.application.id}`} className="text-[#0984E3] text-xs font-medium hover:text-[#0984E3]/80 transition-colors">View Full Application</Link>
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
