"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type CreditTxType = "DOA_CREDIT" | "MANUAL_ADJUSTMENT" | "CREDIT_APPLIED" | "CREDIT_REFUND";

type CreditTxItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

type CreditTx = {
  id: string;
  type: CreditTxType;
  amount: number;
  description: string;
  createdAt: string;
  orderId: string | null;
  orderRef: string | null;
  availableFrom: string | null;
  sourceOrderId: string | null;
  sourceOrderRef: string | null;
  items: CreditTxItem[] | null;
};

function formatPrice(n: number) {
  const abs = Math.abs(n);
  return `£${abs.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function typeLabel(t: CreditTxType): string {
  switch (t) {
    case "DOA_CREDIT": return "DOA credit";
    case "MANUAL_ADJUSTMENT": return "Adjustment";
    case "CREDIT_APPLIED": return "Applied";
    case "CREDIT_REFUND": return "Refunded";
  }
}

export default function CreditHistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<{ balance: number; transactions: CreditTx[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/credit/history")
      .then((r) => (r.ok ? r.json() : { balance: 0, transactions: [] }))
      .then(setData)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f26] border border-white/10 rounded-[20px] w-full max-w-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <p className="text-white/50 text-xs uppercase tracking-wider font-medium">Account Credit</p>
            <p className="text-emerald-400 text-2xl font-bold tabular-nums mt-1">
              {data ? formatPrice(data.balance) : "—"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {loading && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
          {!loading && data && data.transactions.length === 0 && (
            <p className="text-white/40 text-sm text-center py-8">No credit history yet.</p>
          )}
          {!loading && data?.transactions.map((tx) => {
            const isPositive = tx.amount > 0;
            return (
              <div key={tx.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-white/80 text-sm font-medium">{tx.description}</p>
                    <p className="text-white/40 text-xs mt-0.5">
                      {typeLabel(tx.type)} · {formatDate(tx.createdAt)}
                    </p>
                  </div>
                  <p className={`text-sm font-bold tabular-nums ${isPositive ? "text-emerald-400" : "text-white/60"}`}>
                    {isPositive ? "+" : "-"}{formatPrice(tx.amount)}
                  </p>
                </div>
                {tx.items && tx.items.length > 0 && (
                  <ul className="mt-3 space-y-1.5 border-t border-white/5 pt-3">
                    {tx.items.map((item, i) => (
                      <li key={i} className="flex items-baseline justify-between gap-3 text-xs">
                        <span className="text-white/70 truncate">
                          <span className="text-white/40 tabular-nums mr-2">{item.quantity}×</span>
                          {item.name}
                        </span>
                        <span className="text-white/50 tabular-nums shrink-0">
                          {formatPrice(item.quantity * item.unitPrice)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Where the credit went / came from */}
                {tx.type === "CREDIT_APPLIED" && tx.orderRef && (
                  <p className="text-white/40 text-xs mt-2">Used on order #{tx.orderRef}</p>
                )}
                {tx.type === "CREDIT_REFUND" && tx.orderRef && (
                  <p className="text-white/40 text-xs mt-2">Refunded from order #{tx.orderRef}</p>
                )}
                {/* Eligibility hint for credit grants */}
                {tx.availableFrom && (
                  <p className="text-emerald-400/60 text-[11px] mt-2">
                    Can be used on any orders submitted after {formatDate(tx.availableFrom)}
                    {tx.sourceOrderRef ? ` (excluding order #${tx.sourceOrderRef})` : ""}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
