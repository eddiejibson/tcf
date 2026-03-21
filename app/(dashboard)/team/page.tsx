"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { ALL_PERMISSIONS, PERMISSION_LABELS, Permission } from "@/app/lib/permissions";

interface TeamMember {
  id: string;
  email: string;
  companyRole: "OWNER" | "MEMBER" | null;
  permissions: string[] | null;
  lastLogin: string | null;
  createdAt: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Invite modal
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePerms, setInvitePerms] = useState<string[]>([...ALL_PERMISSIONS]);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  // Edit modal
  const [editId, setEditId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Remove confirmation
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const isAdmin = user?.companyRole === "OWNER" || (!!user?.companyName && user?.companyRole !== "MEMBER");

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team");
      if (!res.ok) throw new Error();
      setMembers(await res.json());
      setError("");
    } catch {
      setError("Failed to load team members");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) fetchMembers();
    else setLoading(false);
  }, [isAdmin, fetchMembers]);

  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50">You don&apos;t have access to team management.</p>
        </div>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, permissions: invitePerms }),
      });
      if (res.ok) {
        setShowInvite(false);
        setInviteEmail("");
        setInvitePerms([...ALL_PERMISSIONS]);
        fetchMembers();
      } else {
        const data = await res.json();
        setInviteError(data.error || "Failed to invite member");
      }
    } catch {
      setInviteError("Failed to invite member");
    }
    setInviting(false);
  };

  const handleSavePerms = async () => {
    if (!editId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/team/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editPerms }),
      });
      if (res.ok) {
        setEditId(null);
        fetchMembers();
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleRemove = async () => {
    if (!removeId) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/team/${removeId}`, { method: "DELETE" });
      if (res.ok) {
        setRemoveId(null);
        fetchMembers();
      }
    } catch { /* ignore */ }
    setRemoving(false);
  };

  const togglePerm = (perms: string[], perm: string) =>
    perms.includes(perm) ? perms.filter((p) => p !== perm) : [...perms, perm];

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-white/50 text-sm mt-1">Manage company members and their permissions</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all"
        >
          Invite Member
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
          <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-4">Invite Team Member</h2>
            <form onSubmit={handleInvite}>
              <div className="mb-4">
                <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 text-sm"
                  placeholder="member@example.com"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-5">
                <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-3">Permissions</label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map((perm) => (
                    <label key={perm} className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={invitePerms.includes(perm)}
                        onChange={() => setInvitePerms(togglePerm(invitePerms, perm))}
                        className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#0984E3] focus:ring-[#0984E3]/50 cursor-pointer"
                      />
                      <div>
                        <p className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">{PERMISSION_LABELS[perm as Permission].label}</p>
                        <p className="text-white/40 text-xs">{PERMISSION_LABELS[perm as Permission].description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {inviteError && <p className="text-red-400 text-sm mb-3">{inviteError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={inviting}
                  className="flex-1 px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
                >
                  {inviting ? "Inviting..." : "Send Invite"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditId(null)}>
          <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-1">Edit Permissions</h2>
            <p className="text-white/40 text-sm mb-4">{members.find((m) => m.id === editId)?.email}</p>
            <div className="space-y-2 mb-5">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={editPerms.includes(perm)}
                    onChange={() => setEditPerms(togglePerm(editPerms, perm))}
                    className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-[#0984E3] focus:ring-[#0984E3]/50 cursor-pointer"
                  />
                  <div>
                    <p className="text-white/80 text-sm font-medium group-hover:text-white transition-colors">{PERMISSION_LABELS[perm as Permission].label}</p>
                    <p className="text-white/40 text-xs">{PERMISSION_LABELS[perm as Permission].description}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSavePerms}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
              >
                {saving ? "Saving..." : "Save Permissions"}
              </button>
              <button
                onClick={() => setEditId(null)}
                className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {removeId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setRemoveId(null)}>
          <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-white mb-2">Remove Member</h2>
            <p className="text-white/50 text-sm mb-5">
              Remove <span className="text-white font-medium">{members.find((m) => m.id === removeId)?.email}</span> from the team? Their order history will be preserved.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRemove}
                disabled={removing}
                className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-500/90 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
              >
                {removing ? "Removing..." : "Remove"}
              </button>
              <button
                onClick={() => setRemoveId(null)}
                className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50 mb-4">{error}</p>
          <button onClick={fetchMembers} className="px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white text-sm font-medium rounded-xl transition-all">
            Retry
          </button>
        </div>
      ) : (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[640px] px-4 md:px-6 py-3 grid grid-cols-[2fr_1fr_2fr_1.5fr_auto] items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Member</p></div>
              <div className="text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Role</p></div>
              <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Permissions</p></div>
              <div><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Last Login</p></div>
              <div className="w-28"></div>
            </div>
            {members.map((m) => (
              <div key={m.id} className="min-w-[640px] px-4 md:px-6 py-4 grid grid-cols-[2fr_1fr_2fr_1.5fr_auto] items-center gap-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <div className="min-w-0">
                  <p className="text-white/90 text-sm font-medium truncate">{m.email}</p>
                  <p className="text-white/40 text-xs">Joined {new Date(m.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
                <div className="text-center">
                  {m.companyRole === "OWNER" ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-400">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Owner
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-white/10 text-white/60">
                      Member
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  {m.companyRole === "OWNER" ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#0984E3]/15 text-[#0984E3]">All Access</span>
                  ) : (
                    (m.permissions || []).slice(0, 3).map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/10 text-white/50">
                        {PERMISSION_LABELS[p as Permission]?.label || p}
                      </span>
                    ))
                  )}
                  {m.companyRole !== "OWNER" && (m.permissions || []).length > 3 && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/10 text-white/40">
                      +{(m.permissions || []).length - 3}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-white/40 text-xs">
                    {m.lastLogin ? new Date(m.lastLogin).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never"}
                  </p>
                </div>
                <div className="w-28 flex justify-end gap-2">
                  {m.companyRole !== "OWNER" && (
                    <>
                      <button
                        onClick={() => { setEditId(m.id); setEditPerms([...(m.permissions || [])]); }}
                        className="text-[#0984E3] text-xs font-medium hover:text-[#0984E3]/80 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setRemoveId(m.id)}
                        className="text-red-400/60 hover:text-red-400 text-xs font-medium transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="py-12 text-center text-white/40">
                No team members yet. Invite someone to get started.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
