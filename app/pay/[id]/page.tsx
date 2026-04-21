"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { generateInvoice } from "@/app/lib/generate-invoice";
import PaymentSection from "@/app/components/PaymentSection";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  ACCEPTED: "bg-green-500/20 text-green-400",
  AWAITING_PAYMENT: "bg-yellow-500/20 text-yellow-400",
  PAID: "bg-emerald-500/20 text-emerald-400",
};


interface PayOrder {
  id: string;
  status: string;
  createdAt: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  includeShipping: boolean;
  shipmentName: string;
  customerCompanyName: string | null;
  items: {
    id: string;
    name: string;
    latinName: string | null;
    categoryName: string | null;
    quantity: number;
    unitPrice: number;
    surcharge: number;
  }[];
  payments: { id: string; method: string; amount: number; status: string; createdAt: string }[];
  totals: {
    subtotal: number;
    vat: number;
    shipping: number;
    freight: number;
    credit: number;
    total: number;
  };
  remainingBalance: number;
}

export default function PublicPayPage() {
  const params = useParams();
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/pay/${params.id}`);
    if (res.ok) {
      setOrder(await res.json());
    } else {
      setError(true);
    }
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleDownloadInvoice = async () => {
    if (!order) return;
    await generateInvoice({
      orderRef: order.id.slice(0, 8).toUpperCase(),
      date: new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      status: order.status,
      customerEmail: "",
      customerCompanyName: order.customerCompanyName,
      shipmentName: order.shipmentName,
      items: order.items.map((i) => ({ name: i.name, latinName: i.latinName, categoryName: i.categoryName, quantity: i.quantity, unitPrice: i.unitPrice, surcharge: i.surcharge })),
      subtotal: order.totals.subtotal,
      vat: order.totals.vat,
      shipping: order.totals.shipping,
      freight: order.totals.freight,
      credit: order.totals.credit,
      total: order.totals.total,
      includeShipping: order.includeShipping,
      paymentMethod: order.paymentMethod,
      paymentReference: order.paymentReference,
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-[#111518] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );

  if (error || !order) return (
    <div className="min-h-screen bg-[#111518] flex items-center justify-center">
      <div className="text-center">
        <p className="text-white/40 text-lg mb-4">This payment link is not available.</p>
        <Link href="/login" className="text-[#0984E3] text-sm hover:underline">Log in to your account</Link>
      </div>
    </div>
  );

  const isPaid = order.status === "PAID";
  const isAwaitingPayment = order.status === "AWAITING_PAYMENT";

  return (
    <div className="min-h-screen bg-[#111518]">
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <Image src="/images/logo.png" alt="The Coral Farm" width={28} height={42} className="transition-transform group-hover:scale-105" />
            <span className="text-white font-extrabold tracking-wider text-sm hidden sm:block">THE CORAL FARM</span>
          </Link>
          <button
            onClick={handleDownloadInvoice}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Invoice
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 md:py-12">
        {/* Order header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Invoice #{order.id.slice(0, 8).toUpperCase()}</h1>
            <p className="text-white/50 text-sm mt-1">{order.customerCompanyName ? `${order.customerCompanyName} — ` : ""}{order.shipmentName}</p>
          </div>
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusColors[order.status] || "bg-white/10 text-white/60"}`}>
            {order.status === "AWAITING_PAYMENT" ? "AWAITING PAYMENT" : order.status}
          </span>
        </div>

        {/* Payment success banner */}
        {isPaid && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[16px] p-5 mb-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-emerald-400 font-semibold">Payment received</p>
            <p className="text-emerald-400/60 text-sm mt-1">Thank you! Your order is being processed.</p>
          </div>
        )}

        {isAwaitingPayment && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-[16px] p-4 mb-6">
            <p className="text-amber-400 text-sm font-medium">Payment has been submitted and is awaiting confirmation.</p>
          </div>
        )}

        {/* Items table */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <div className="min-w-[400px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
              <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
              <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
              <div className="w-16 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty</p></div>
              <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
            </div>
            {order.items.map((item) => {
              const base = item.quantity * item.unitPrice;
              const lineTotal = base + base * ((item.surcharge || 0) / 100);
              return (
                <div key={item.id} className="min-w-[400px] px-4 md:px-6 py-3 border-b border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <p className="text-white/90 text-sm font-medium">{item.name}</p>
                      {(item.latinName || item.categoryName) && (
                        <p className="text-white/30 text-xs mt-0.5">
                          {item.categoryName && <span>{item.categoryName}</span>}
                          {item.categoryName && item.latinName && <span> · </span>}
                          {item.latinName && <span className="italic">{item.latinName}</span>}
                        </p>
                      )}
                    </div>
                    <div className="w-24 text-right"><p className="text-white/60 text-sm tabular-nums">{formatPrice(item.unitPrice)}</p></div>
                    <div className="w-16 text-center"><p className="text-white/60 text-sm">{item.quantity}</p></div>
                    <div className="w-24 text-right"><p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(lineTotal)}</p></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="p-4 md:p-6 space-y-2">
            <div className="flex items-center justify-between text-white/60 text-sm">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPrice(order.totals.subtotal)}</span>
            </div>
            {order.totals.freight > 0 && (
              <div className="flex items-center justify-between text-white/60 text-sm">
                <span>Freight</span>
                <span className="tabular-nums">{formatPrice(order.totals.freight)}</span>
              </div>
            )}
            {order.includeShipping && (
              <div className="flex items-center justify-between text-white/60 text-sm">
                <span>Shipping</span>
                <span className="tabular-nums">{formatPrice(order.totals.shipping)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-white/60 text-sm">
              <span>VAT (20%)</span>
              <span className="tabular-nums">{formatPrice(order.totals.vat)}</span>
            </div>
            {order.totals.credit > 0 && (
              <div className="flex items-center justify-between text-emerald-400 text-sm">
                <span>Account Credit</span>
                <span className="tabular-nums">-{formatPrice(order.totals.credit)}</span>
              </div>
            )}
            <div className="h-px bg-white/10" />
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold">Total</span>
              <span className="text-[#0984E3] font-bold text-xl tabular-nums">{formatPrice(order.totals.total)}</span>
            </div>
          </div>
        </div>

        <PaymentSection
          orderId={order.id}
          order={order}
          apiBasePath={`/api/pay/${order.id}/payment`}
          canManagePayments={true}
          canViewPayments={true}
          canCancelPayments={false}
          onPaymentChange={fetchOrder}
          chargeUrl={`/api/pay/${order.id}/payment/charge`}
        />

        {/* Footer CTA */}
        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-white/30 text-sm mb-3">Want to view your orders, shipments, and more?</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium rounded-xl transition-all text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
            Log in to your account
          </Link>
          <p className="text-white/20 text-xs mt-6">The Coral Farm — Trade Portal</p>
        </div>
      </main>
    </div>
  );
}
