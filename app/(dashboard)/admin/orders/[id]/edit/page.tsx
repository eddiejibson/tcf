"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import OrderBuilder from "@/app/components/admin/OrderBuilder";
import type { OrderLineItem } from "@/app/components/admin/OrderBuilder";

export default function AdminEditDraftOrderPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [initialItems, setInitialItems] = useState<OrderLineItem[]>([]);
  const [initialUserId, setInitialUserId] = useState("");
  const [initialNotes, setInitialNotes] = useState("");

  const fetchDraft = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${params.id}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Order not found");
      setLoading(false);
      return;
    }
    const order = await res.json();
    if (order.status !== "DRAFT") {
      setError("Only draft orders can be edited here");
      setLoading(false);
      return;
    }

    // Map order items back to OrderLineItem format
    const items: OrderLineItem[] = order.items
      .filter((i: { catalogProductId?: string | null }) => i.catalogProductId)
      .map((i: { catalogProductId: string; name: string; unitPrice: number; quantity: number; catalogProduct?: { type?: string } }) => ({
        catalogProductId: i.catalogProductId,
        name: i.name,
        price: Number(i.unitPrice),
        type: i.catalogProduct?.type || "FRAG",
        quantity: i.quantity,
      }));

    setInitialItems(items);
    setInitialUserId(order.userId || "");
    setInitialNotes(order.notes || "");
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchDraft(); }, [fetchDraft]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <button onClick={() => router.push("/admin/orders")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back to Orders
        </button>
        <p className="text-white/40">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/orders")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Orders
      </button>

      <OrderBuilder
        mode="edit"
        initialDraftId={params.id as string}
        initialItems={initialItems}
        initialUserId={initialUserId}
        initialNotes={initialNotes}
      />
    </div>
  );
}
