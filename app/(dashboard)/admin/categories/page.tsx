"use client";

import { useState, useEffect, useCallback } from "react";
import type { CategoryNode } from "@/app/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState("");
  const [newParentName, setNewParentName] = useState("");
  const [newChildName, setNewChildName] = useState("");
  const [newChildParentId, setNewChildParentId] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/admin/categories");
    if (res.ok) setCategories(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    await fetch(`/api/admin/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, sortOrder: parseInt(editSort) || 0 }),
    });
    setEditingId(null);
    await fetchCategories();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/categories/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "Cannot delete category");
      return;
    }
    await fetchCategories();
  };

  const handleAddParent = async () => {
    if (!newParentName) return;
    setSaving(true);
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newParentName, sortOrder: categories.length }),
    });
    setNewParentName("");
    await fetchCategories();
    setSaving(false);
  };

  const handleAddChild = async () => {
    if (!newChildName || !newChildParentId) return;
    setSaving(true);
    const parent = categories.find((c) => c.id === newChildParentId);
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newChildName, parentId: newChildParentId, sortOrder: parent?.children.length || 0 }),
    });
    setNewChildName("");
    setNewChildParentId("");
    await fetchCategories();
    setSaving(false);
  };

  const startEdit = (cat: CategoryNode) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditSort(String(cat.sortOrder));
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Categories</h1>
        <p className="text-white/50 text-sm mt-1">Manage product categories</p>
      </div>

      <div className="space-y-6">
        {categories.map((parent) => (
          <div key={parent.id} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
              {editingId === parent.id ? (
                <div className="flex items-center gap-3 flex-1">
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                  <input type="number" value={editSort} onChange={(e) => setEditSort(e.target.value)} placeholder="Sort" className="w-16 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50" />
                  <button onClick={() => handleSaveEdit(parent.id)} disabled={saving} className="text-[#0984E3] text-xs font-medium">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-white/40 text-xs">Cancel</button>
                </div>
              ) : (
                <>
                  <h3 className="text-white font-semibold">{parent.name}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(parent)} className="text-white/40 hover:text-white text-xs transition-colors">Edit</button>
                    <button onClick={() => handleDelete(parent.id)} className="text-red-400/40 hover:text-red-400 text-xs transition-colors">Delete</button>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 space-y-1">
              {parent.children.map((child) => (
                <div key={child.id} className="flex items-center justify-between px-4 py-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                  {editingId === child.id ? (
                    <div className="flex items-center gap-3 flex-1">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
                      <input type="number" value={editSort} onChange={(e) => setEditSort(e.target.value)} placeholder="Sort" className="w-16 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50" />
                      <button onClick={() => handleSaveEdit(child.id)} disabled={saving} className="text-[#0984E3] text-xs font-medium">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-white/40 text-xs">Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span className="text-white/70 text-sm">{child.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white/20 text-xs tabular-nums">#{child.sortOrder}</span>
                        <button onClick={() => startEdit(child)} className="text-white/30 hover:text-white text-xs transition-colors">Edit</button>
                        <button onClick={() => handleDelete(child.id)} className="text-red-400/30 hover:text-red-400 text-xs transition-colors">Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {parent.children.length === 0 && (
                <p className="text-white/20 text-sm px-4 py-2">No sub-categories</p>
              )}
            </div>
          </div>
        ))}

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 space-y-5">
          <h3 className="text-white font-semibold">Add Category</h3>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">New Parent Category</label>
            <div className="flex gap-3">
              <input value={newParentName} onChange={(e) => setNewParentName(e.target.value)} placeholder="Category name" className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50" />
              <button onClick={handleAddParent} disabled={saving || !newParentName} className="px-4 py-2.5 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-xl hover:bg-[#0984E3]/30 disabled:opacity-30 transition-all">Add</button>
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">New Sub-Category</label>
            <div className="flex gap-3">
              <select value={newChildParentId} onChange={(e) => setNewChildParentId(e.target.value)} className="w-40 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 [&>option]:bg-[#1a1f2e] [&>option]:text-white">
                <option value="">Parent...</option>
                {categories.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input value={newChildName} onChange={(e) => setNewChildName(e.target.value)} placeholder="Sub-category name" className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50" />
              <button onClick={handleAddChild} disabled={saving || !newChildName || !newChildParentId} className="px-4 py-2.5 bg-[#0984E3]/20 text-[#0984E3] text-sm font-medium rounded-xl hover:bg-[#0984E3]/30 disabled:opacity-30 transition-all">Add</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
