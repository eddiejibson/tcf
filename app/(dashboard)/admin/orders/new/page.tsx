"use client";

import { useRouter } from "next/navigation";
import OrderBuilder from "@/app/components/admin/OrderBuilder";

export default function AdminNewOrderPage() {
  const router = useRouter();

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/orders")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Orders
      </button>

      <OrderBuilder mode="create" />
    </div>
  );
}
