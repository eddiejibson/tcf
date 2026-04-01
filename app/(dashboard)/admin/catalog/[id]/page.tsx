"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { CategoryNode } from "@/app/lib/types";
import CategoryPicker from "@/app/components/CategoryPicker";

interface ImageEntry {
  id?: string;
  imageKey: string;
  imageUrl: string;
  label: string;
}

export default function EditCatalogProductPage() {
  const params = useParams();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [latinName, setLatinName] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState("COLONY");
  const [categoryId, setCategoryId] = useState("");
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [stockMode, setStockMode] = useState("EXACT");
  const [stockQty, setStockQty] = useState("");
  const [stockLevel, setStockLevel] = useState("AVERAGE");
  const [active, setActive] = useState(true);
  const [wysiwyg, setWysiwyg] = useState(false);
  const [surcharge, setSurcharge] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/admin/categories");
    if (res.ok) setCategories(await res.json());
  }, []);

  const fetchProduct = useCallback(async () => {
    const res = await fetch(`/api/admin/catalog/${params.id}`);
    if (res.ok) {
      const p = await res.json();
      setName(p.name);
      setLatinName(p.latinName || "");
      setPrice(String(p.price));
      setType(p.type);
      setCategoryId(p.categoryId);
      setImages(
        (p.images || []).map((img: { id: string; imageKey: string; imageUrl: string; label: string | null }) => ({
          id: img.id,
          imageKey: img.imageKey,
          imageUrl: img.imageUrl,
          label: img.label || "",
        }))
      );
      setStockMode(p.stockMode);
      setStockQty(p.stockQty != null ? String(p.stockQty) : "");
      setStockLevel(p.stockLevel || "AVERAGE");
      setActive(p.active);
      setWysiwyg(p.wysiwyg ?? false);
      setSurcharge(p.surcharge ? String(Number(p.surcharge)) : "");
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleImageUpload = async (files: FileList) => {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "jpg";
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        let key: string;

        if (isLocalhost) {
          const formData = new FormData();
          formData.append("file", file);
          const res = await fetch("/api/upload/signed-url", { method: "POST", body: formData });
          const data = await res.json();
          key = data.key;
        } else {
          const res = await fetch("/api/upload/signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentType: file.type || "image/jpeg", filename: `photo.${ext}`, purpose: "catalog" }),
          });
          const data = await res.json();
          key = data.key;
          await fetch(data.url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/jpeg" } });
        }

        setImages((prev) => [...prev, { imageKey: key, imageUrl: URL.createObjectURL(file), label: "" }]);
      }
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const updateLabel = (idx: number, label: string) => {
    setImages((prev) => prev.map((img, i) => i === idx ? { ...img, label } : img));
  };

  const handleSave = async () => {
    if (!name || !price || !categoryId) return;
    setSaving(true);
    await fetch(`/api/admin/catalog/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        latinName: latinName || null,
        price: parseFloat(price),
        type,
        categoryId,
        images: images.map((img, i) => ({ imageKey: img.imageKey, label: img.label || null, sortOrder: i })),
        stockMode,
        stockQty: stockMode === "EXACT" ? parseInt(stockQty) || 0 : null,
        stockLevel: stockMode === "ROUGH" ? stockLevel : null,
        active,
        wysiwyg,
        surcharge: parseFloat(surcharge) || 0,
      }),
    });
    setSaving(false);
    router.push("/admin/catalog");
  };

  const handleDeactivate = async () => {
    await fetch(`/api/admin/catalog/${params.id}`, { method: "DELETE" });
    router.push("/admin/catalog");
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/catalog")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Catalog
      </button>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">Edit Product</h1>
        {active && (
          <button onClick={handleDeactivate} className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all">
            Deactivate
          </button>
        )}
      </div>

      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 space-y-5 overflow-visible relative z-10">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Latin Name <span className="text-white/20">(optional)</span></label>
            <input value={latinName} onChange={(e) => setLatinName(e.target.value)} placeholder="e.g. Acropora millepora" className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 italic focus:outline-none focus:border-[#0984E3]/50" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Price</label>
              <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
            </div>
            <div>
              <label className="text-amber-400/70 text-xs uppercase tracking-wider font-medium mb-2 block">Surcharge %</label>
              <input type="number" step="0.1" min="0" value={surcharge} onChange={(e) => setSurcharge(e.target.value)} placeholder="0" className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/20 focus:outline-none focus:border-amber-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 [&>option]:bg-[#1a1f2e] [&>option]:text-white">
                <option value="COLONY">Colony</option>
                <option value="FRAG">Frag</option>
                <option value="PER_HEAD">Per Head</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Category</label>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          </div>

          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Images</label>
            {images.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                {images.map((img, idx) => (
                  <div key={idx} className="relative bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                    <img src={img.imageUrl} alt={`Image ${idx + 1}`} className="w-full aspect-square object-cover" />
                    <div className="p-2 space-y-1.5">
                      <input
                        value={img.label}
                        onChange={(e) => updateLabel(idx, e.target.value)}
                        placeholder="Label (optional)"
                        className="w-full px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-xs placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50"
                      />
                      <div className="flex items-center justify-between">
                        <div className="flex gap-1">
                          <button onClick={() => moveImage(idx, -1)} disabled={idx === 0} className="text-white/30 hover:text-white disabled:opacity-20 text-xs transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <button onClick={() => moveImage(idx, 1)} disabled={idx === images.length - 1} className="text-white/30 hover:text-white disabled:opacity-20 text-xs transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </div>
                        <button onClick={() => removeImage(idx)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <label className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 transition-colors">
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              )}
              <span className="text-white/40 text-sm">{uploading ? "Uploading..." : "Upload images"}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) handleImageUpload(e.target.files); e.target.value = ""; }} />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer" />
              <span className="text-white/80 text-sm">Active</span>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">WYSIWYG</p>
              <p className="text-white/30 text-xs mt-0.5">What you see is what you get — exact item shown is what customer receives</p>
            </div>
            <button
              type="button"
              onClick={() => setWysiwyg(!wysiwyg)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${wysiwyg ? "bg-[#0984E3]" : "bg-white/10"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${wysiwyg ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 space-y-5">
          <div>
            <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3 block">Stock Mode</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="stockMode" value="EXACT" checked={stockMode === "EXACT"} onChange={() => setStockMode("EXACT")} className="text-[#0984E3] focus:ring-[#0984E3]/30" />
                <span className="text-white/80 text-sm">Exact Quantity</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="stockMode" value="ROUGH" checked={stockMode === "ROUGH"} onChange={() => setStockMode("ROUGH")} className="text-[#0984E3] focus:ring-[#0984E3]/30" />
                <span className="text-white/80 text-sm">Rough Level</span>
              </label>
            </div>
          </div>

          {stockMode === "EXACT" ? (
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Stock Quantity</label>
              <input type="number" value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
            </div>
          ) : (
            <div>
              <label className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2 block">Stock Level</label>
              <select
                value={stockLevel}
                onChange={(e) => {
                  const newLevel = e.target.value;
                  const wasOutOfStock = stockLevel === "OUT_OF_STOCK";
                  setStockLevel(newLevel);
                  if (newLevel === "OUT_OF_STOCK") {
                    setActive(false);
                  } else if (wasOutOfStock) {
                    setActive(true);
                  }
                }}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-[#0984E3]/50 [&>option]:bg-[#1a1f2e] [&>option]:text-white"
              >
                <option value="LOW">Limited</option>
                <option value="AVERAGE">Available</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
                <option value="PRE_ORDER">Pre-Order</option>
              </select>
              {stockLevel === "OUT_OF_STOCK" && (
                <p className="text-red-400/70 text-xs mt-2">Product will be automatically set to inactive while out of stock</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving || !name || !price || !categoryId}
            className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl transition-all"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
