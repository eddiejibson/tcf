"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserListItem } from "@/app/lib/types";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newRole, setNewRole] = useState("USER");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [creditUserId, setCreditUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [creditSaving, setCreditSaving] = useState(false);
  const [editCompanyUserId, setEditCompanyUserId] = useState<string | null>(null);
  const [editCompanyName, setEditCompanyName] = useState("");

  // Search & pagination
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 25;

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    params.set("page", String(page));
    params.set("limit", String(LIMIT));
    const res = await fetch(`/api/admin/users?${params}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
      body: JSON.stringify({ email: newEmail, companyName: newCompanyName, role: newRole }),
    });
    if (res.ok) {
      setNewEmail("");
      setNewCompanyName("");
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
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) fetchUsers();
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

  const handleCreditAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creditUserId || !creditAmount) return;
    setCreditSaving(true);
    const res = await fetch(`/api/admin/users/${creditUserId}/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parseFloat(creditAmount), description: creditDescription }),
    });
    if (res.ok) {
      setCreditUserId(null);
      setCreditAmount("");
      setCreditDescription("");
      fetchUsers();
    }
    setCreditSaving(false);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-white/50 text-sm mt-1">Manage trade portal accounts</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all"
        >
          Add User
        </button>
      </div>

      {showCreate && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6">
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
            <div className="md:w-48">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Company Name{newRole !== "ADMIN" && " *"}</label>
              <input
                type="text"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm"
                placeholder={newRole === "ADMIN" ? "Optional" : "Company name"}
                required={newRole !== "ADMIN"}
              />
            </div>
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

      {creditUserId && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Adjust Credit for {users.find((u) => u.id === creditUserId)?.email}</p>
          <form onSubmit={handleCreditAdjust} className="flex flex-wrap items-end gap-3 md:gap-4">
            <div className="w-36">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Amount</label>
              <input
                type="number"
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm"
                placeholder="10.00"
                required
                autoFocus
              />
            </div>
            <div className="flex-1">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Description</label>
              <input
                type="text"
                value={creditDescription}
                onChange={(e) => setCreditDescription(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm"
                placeholder="Reason for adjustment..."
              />
            </div>
            <button
              type="submit"
              disabled={creditSaving || !creditAmount}
              className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
            >
              {creditSaving ? "Saving..." : "Apply"}
            </button>
            <button
              type="button"
              onClick={() => { setCreditUserId(null); setCreditAmount(""); setCreditDescription(""); }}
              className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </form>
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
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
          <div className="min-w-[640px] px-4 md:px-6 py-3 grid grid-cols-[3fr_1fr_1fr_1.5fr_2fr_1.5fr_auto] items-center gap-4 border-b border-white/10 bg-white/[0.02]">
            <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">User</p></div>
            <div className="text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Role</p></div>
            <div className="text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Orders</p></div>
            <div className="text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Credit</p></div>
            <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Last Login</p></div>
            <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Created</p></div>
            <div className="w-14"></div>
          </div>
          {users.map((u) => (
            <div key={u.id} className="min-w-[640px] px-4 md:px-6 py-4 grid grid-cols-[3fr_1fr_1fr_1.5fr_2fr_1.5fr_auto] items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
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
                  <div className="flex items-center gap-2 group/name">
                    <div className="min-w-0">
                      <p className="text-white/90 text-sm font-medium truncate">{u.companyName || u.email}</p>
                      {u.companyName && <p className="text-white/40 text-xs truncate">{u.email}</p>}
                    </div>
                    {u.role !== "ADMIN" && (
                      <button
                        onClick={() => { setEditCompanyUserId(u.id); setEditCompanyName(u.companyName || ""); }}
                        className="opacity-0 group-hover/name:opacity-100 text-white/30 hover:text-white/60 transition-all shrink-0"
                        title="Edit company name"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    )}
                  </div>
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
              <div className="flex items-center justify-end gap-2">
                <span className={`text-sm font-medium tabular-nums ${u.creditBalance > 0 ? "text-emerald-400" : "text-white/40"}`}>
                  {formatPrice(u.creditBalance)}
                </span>
                {u.role !== "ADMIN" && (
                  <button
                    onClick={() => setCreditUserId(creditUserId === u.id ? null : u.id)}
                    className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-md text-[10px] text-white/50 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Adjust
                  </button>
                )}
              </div>
              <div><p className="text-white/40 text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}</p></div>
              <div><p className="text-white/40 text-xs">{new Date(u.createdAt).toLocaleDateString("en-GB")}</p></div>
              <div className="w-14 text-right">
                <button onClick={() => handleDelete(u.id)} className="text-red-400/60 hover:text-red-400 text-xs font-medium transition-colors">Delete</button>
              </div>
            </div>
          ))}
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
