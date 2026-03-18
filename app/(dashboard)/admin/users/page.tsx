"use client";

import { useState, useEffect, useCallback } from "react";
import type { UserListItem } from "@/app/lib/types";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("USER");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, role: newRole }),
    });
    if (res.ok) {
      setNewEmail("");
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

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
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
          <form onSubmit={handleCreate} className="flex items-end gap-4">
            <div className="flex-1">
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
            <div className="w-40">
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
              </select>
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

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Email</p></div>
            <div className="w-24 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Role</p></div>
            <div className="w-20 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Orders</p></div>
            <div className="w-32"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Created</p></div>
            <div className="w-24"></div>
          </div>
          {users.map((u) => (
            <div key={u.id} className="px-6 py-4 flex items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <div className="flex-1"><p className="text-white/90 text-sm font-medium">{u.email}</p></div>
              <div className="w-24 text-center">
                <button
                  onClick={() => handleRoleToggle(u.id, u.role)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    u.role === "ADMIN"
                      ? "bg-[#0984E3]/20 text-[#0984E3]"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {u.role}
                </button>
              </div>
              <div className="w-20 text-center"><p className="text-white/60 text-sm">{u.orderCount}</p></div>
              <div className="w-32"><p className="text-white/40 text-xs">{new Date(u.createdAt).toLocaleDateString("en-GB")}</p></div>
              <div className="w-24 text-right">
                <button onClick={() => handleDelete(u.id)} className="text-red-400/60 hover:text-red-400 text-xs font-medium transition-colors">Delete</button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="py-12 text-center text-white/40">No users found</div>
          )}
        </div>
      )}
    </div>
  );
}
