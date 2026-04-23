"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserListItem } from "@/app/lib/types";
import { AnimatedList, AnimatedListItem } from "@/app/components/dashboard/AnimatedList";
import { SkeletonTable } from "@/app/components/dashboard/Skeleton";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newCompanyId, setNewCompanyId] = useState("");
  const [newRole, setNewRole] = useState("USER");
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [editCompanyUserId, setEditCompanyUserId] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");

  // Search & pagination
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;

  const [fetchError, setFetchError] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(LIMIT));
      const res = await fetch(`/api/admin/users?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      setFetchError(true);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    fetch("/api/admin/companies").then((r) => r.ok ? r.json() : []).then((data) => setCompanies(data.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name }))));
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setSearch(searchInput);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, companyId: newRole === "ADMIN" ? undefined : (newCompanyId || undefined), role: newRole }),
    });
    if (res.ok) {
      setNewEmail("");
      setNewCompanyId("");
      setNewRole("USER");
      setShowCreate(false);
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error || "Failed to create user");
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this user? This action cannot be undone.")) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed to delete user");
    }
  };

  const handleSudo = async (id: string, email: string) => {
    if (!confirm(`Switch into ${email}'s account? You can return to admin from the banner at the top.`)) return;
    const res = await fetch(`/api/admin/users/${id}/sudo`, { method: "POST" });
    if (res.ok) {
      window.location.href = "/orders";
    } else {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed to switch user");
    }
  };

  const handleRoleToggle = async (id: string, currentRole: string) => {
    const newRole = currentRole === "ADMIN" ? "USER" : "ADMIN";
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) fetchUsers();
  };

  const handleCompanyNameSave = async (id: string) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: editCompanyName || null }),
    });
    if (res.ok) {
      setEditCompanyUserId(null);
      setEditCompanyName("");
      fetchUsers();
    }
  };



  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-white/50 text-sm mt-1">Manage trade portal accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/companies/new"
            className="px-4 py-2.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
          >
            Add Company
          </Link>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all"
          >
            Add User
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6 overflow-visible relative z-20">
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-end gap-3 md:gap-4">
            <div className="flex-1 sm:col-span-2 md:col-span-1">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm"
                placeholder="user@example.com"
                required
                autoFocus
              />
            </div>
            {newRole !== "ADMIN" && (
              <div className="md:w-56 relative">
                <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Company *</label>
                <button
                  type="button"
                  onClick={() => { setCompanyDropdownOpen(!companyDropdownOpen); setCompanySearch(""); }}
                  className={`w-full px-4 py-2.5 bg-white/5 border rounded-xl text-sm text-left flex items-center justify-between gap-2 transition-all ${companyDropdownOpen ? "border-[#0984E3]/50 ring-1 ring-[#0984E3]/20" : "border-white/10 hover:border-white/20"}`}
                >
                  <span className={newCompanyId ? "text-white" : "text-white/30"}>
                    {newCompanyId ? companies.find((c) => c.id === newCompanyId)?.name || "Select..." : "Select company..."}
                  </span>
                  <svg className={`w-4 h-4 text-white/30 transition-transform ${companyDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {companyDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setCompanyDropdownOpen(false)} />
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[#1a1f26] border border-white/10 rounded-xl shadow-2xl shadow-black/40 overflow-hidden">
                      <div className="p-2">
                        <input
                          type="text"
                          value={companySearch}
                          onChange={(e) => setCompanySearch(e.target.value)}
                          placeholder="Search..."
                          autoFocus
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50"
                        />
                      </div>
                      <div className="max-h-48 overflow-auto">
                        {companies
                          .filter((c) => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase()))
                          .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setNewCompanyId(c.id); setCompanyDropdownOpen(false); }}
                            className={`w-full px-3 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${newCompanyId === c.id ? "bg-[#0984E3]/10 text-[#0984E3]" : "text-white/80 hover:bg-white/5"}`}
                          >
                            {newCompanyId === c.id && (
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                            <span className="truncate">{c.name}</span>
                          </button>
                        ))}
                        {companies.filter((c) => !companySearch || c.name.toLowerCase().includes(companySearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-3 text-white/30 text-xs text-center">No companies found</p>
                        )}
                      </div>
                      <div className="border-t border-white/5 p-1.5">
                        <button
                          type="button"
                          onClick={() => router.push("/admin/companies/new")}
                          className="w-full px-3 py-2.5 text-left text-sm text-[#0984E3] hover:bg-[#0984E3]/10 rounded-lg transition-colors flex items-center gap-2 font-medium"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          Add New Company
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="md:w-40">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Role</label>
              <div className="relative">
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full appearance-none px-4 pr-9 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 cursor-pointer"
                >
                  <option value="USER" className="bg-[#1a1f26] text-white">User</option>
                  <option value="ADMIN" className="bg-[#1a1f26] text-white">Admin</option>
                </select>
                <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </form>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        </div>
      )}

      {/* Search bar */}
      <div className="mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email or company name..."
            className="w-full pl-11 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm"
          />
          {searchInput && (
            <button
              onClick={() => { setSearchInput(""); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonTable />
      ) : fetchError ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">Failed to load users</p>
          <button onClick={() => fetchUsers()} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[640px] px-4 md:px-6 py-3 grid grid-cols-[3fr_1fr_1fr_2fr_1.5fr_7rem] items-center gap-4 border-b border-white/10 bg-white/[0.02]">
            <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">User</p></div>
            <div className="text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Role</p></div>
            <div className="text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Orders</p></div>
            <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Last Login</p></div>
            <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Created</p></div>
            <div></div>
          </div>
          <AnimatedList>
          {users.map((u) => (
            <AnimatedListItem key={u.id}>
            <div className="min-w-[640px] px-4 md:px-6 py-4 grid grid-cols-[3fr_1fr_1fr_2fr_1.5fr_7rem] items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="min-w-0">
                {editCompanyUserId === u.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editCompanyName}
                      onChange={(e) => setEditCompanyName(e.target.value)}
                      placeholder="Company name"
                      className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50"
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Enter") handleCompanyNameSave(u.id); if (e.key === "Escape") setEditCompanyUserId(null); }}
                    />
                    <button onClick={() => handleCompanyNameSave(u.id)} className="text-[#0984E3] text-xs font-medium">Save</button>
                    <button onClick={() => setEditCompanyUserId(null)} className="text-white/40 text-xs">Cancel</button>
                  </div>
                ) : (
                  <Link href={`/admin/users/${u.id}`} className="flex items-center gap-2 group/name hover:opacity-80 transition-opacity">
                    <div className="min-w-0">
                      <p className="text-white/90 text-sm font-medium truncate">{u.companyName || u.email}</p>
                      {u.companyName && <p className="text-white/40 text-xs truncate">{u.email}</p>}
                    </div>
                    <svg className="w-4 h-4 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                )}
              </div>
              <div className="text-center">
                <button
                  onClick={() => handleRoleToggle(u.id, u.role)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    u.role === "ADMIN"
                      ? "bg-[#0984E3]/20 text-[#0984E3]"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {u.role}
                </button>
              </div>
              <div className="text-center"><p className="text-white/60 text-sm">{u.orderCount}</p></div>
              <div><p className="text-white/40 text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}</p></div>
              <div><p className="text-white/40 text-xs">{new Date(u.createdAt).toLocaleDateString("en-GB")}</p></div>
              <div className="w-28 flex items-center justify-end gap-3">
                <button onClick={() => handleSudo(u.id, u.email)} className="text-[#0984E3]/70 hover:text-[#0984E3] text-xs font-medium transition-colors">Sudo</button>
                <button onClick={() => handleDelete(u.id)} className="text-red-400/60 hover:text-red-400 text-xs font-medium transition-colors">Delete</button>
              </div>
            </div>
            </AnimatedListItem>
          ))}
          </AnimatedList>
          {users.length === 0 && (
            <div className="py-12 text-center text-white/40">
              {search ? "No users match your search" : "No users found"}
            </div>
          )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 md:px-6 py-3 border-t border-white/10 flex items-center justify-between">
              <p className="text-white/40 text-xs">
                {total} user{total !== 1 ? "s" : ""} total
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
