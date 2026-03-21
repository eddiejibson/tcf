"use client";

import { useRouter } from "next/navigation";
import CatalogProductForm from "@/app/components/admin/CatalogProductForm";

export default function NewCatalogProductPage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/catalog")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Catalog
      </button>

      <h1 className="text-2xl font-bold text-white mb-8">New Product</h1>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 overflow-visible relative z-10">
        <CatalogProductForm onSuccess={() => router.push("/admin/catalog")} />
      </div>
    </div>
  );
}
