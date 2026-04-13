"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { generateInvoice } from "@/app/lib/generate-invoice";
import SquareCardForm from "@/app/components/SquareCardForm";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  ACCEPTED: "bg-green-500/20 text-green-400",
  AWAITING_PAYMENT: "bg-yellow-500/20 text-yellow-400",
  PAID: "bg-emerald-500/20 text-emerald-400",
};

const BANK_DETAILS = {
  accountHolder: "THE CORAL FARM LTD",
  sortCode: "04-29-09",
  accountNumber: "48775908",
  vatNumber: "486315274",
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
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<PayOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const verifiedRef = useRef(false);

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

  // Verify card payment on redirect back
  useEffect(() => {
    if (searchParams.get("payment") !== "success" || verifiedRef.current) return;
    verifiedRef.current = true;
    setVerifying(true);
    fetch(`/api/pay/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_card" }),
    })
      .then(() => fetchOrder())
      .finally(() => setVerifying(false));
  }, [searchParams, params.id, fetchOrder]);

  const getPaymentAmount = () => splitMode && splitAmount ? parseFloat(splitAmount) : undefined;

  const handleBankTransfer = async () => {
    setPaymentLoading(true);
    const res = await fetch(`/api/pay/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "BANK_TRANSFER", amount: getPaymentAmount() }),
    });
    if (res.ok) {
      setShowBankDetails(true);
      setSplitAmount("");
      await fetchOrder();
    }
    setPaymentLoading(false);
  };

  const handleCardPayment = () => setShowCardForm(true);

  const handleFinancePayment = async () => {
    setPaymentLoading(true);
    const res = await fetch(`/api/pay/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "FINANCE", amount: getPaymentAmount() }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
        await fetchOrder();
      }
    }
    setPaymentLoading(false);
  };

  const handleConfirmBankSent = async () => {
    setPaymentLoading(true);
    await fetch(`/api/pay/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_bank_sent" }),
    });
    await fetchOrder();
    setPaymentLoading(false);
  };

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

  const canSelectPayment = (order.status === "ACCEPTED" || order.status === "AWAITING_PAYMENT") && order.remainingBalance > 0 && !showCardForm;
  const showBankInfo = (order.status === "ACCEPTED" || order.status === "AWAITING_PAYMENT") && (order.paymentMethod === "BANK_TRANSFER" || showBankDetails);
  const showCardPending = (order.status === "ACCEPTED" || order.status === "AWAITING_PAYMENT") && order.paymentMethod === "CARD";
  const showFinancePending = order.status === "ACCEPTED" && order.paymentMethod === "FINANCE";
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

        {verifying && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-[16px] p-4 mb-6 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            <p className="text-blue-400 text-sm font-medium">Verifying payment...</p>
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

        {/* Existing payments */}
        {order.payments?.length > 0 && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">Payments</h3>
              {order.remainingBalance > 0 && <span className="text-amber-400 text-sm font-medium">{formatPrice(order.remainingBalance)} remaining</span>}
            </div>
            <div className="space-y-2">
              {order.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${p.method === "BANK_TRANSFER" ? "bg-blue-500/20 text-blue-400" : p.method === "CARD" ? "bg-purple-500/20 text-purple-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                      {p.method === "BANK_TRANSFER" ? "Bank" : p.method === "CARD" ? "Card" : "Finance"}
                    </span>
                    <span className={`text-[10px] font-medium ${p.status === "COMPLETED" ? "text-emerald-400" : "text-amber-400"}`}>
                      {p.status === "COMPLETED" ? "Paid" : "Pending"}
                    </span>
                  </div>
                  <span className="text-white font-medium text-sm tabular-nums">{formatPrice(Number(p.amount))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment method selection */}
        {canSelectPayment && (
          <div className="mb-6">
            <h3 className="text-white font-semibold text-lg mb-1">
              {order.payments?.length > 0 ? "Add Another Payment" : "Payment"}
            </h3>
            <p className="text-white/50 text-sm mb-4">
              {order.payments?.length > 0
                ? `${formatPrice(order.remainingBalance)} remaining`
                : "Choose how you would like to pay"}
            </p>

            {!order.payments?.length && (
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input type="checkbox" checked={splitMode} onChange={(e) => { setSplitMode(e.target.checked); setSplitAmount(""); }} className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer" />
                <span className="text-white/50 text-sm">Split payment across multiple methods</span>
              </label>
            )}

            {(splitMode || (order.payments?.length || 0) > 0) && (
              <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-4">
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-2">Amount for this payment</label>
                <div className="flex items-center gap-2">
                  <span className="text-white/40 text-sm">£</span>
                  <input type="number" step="0.01" min="0.01" max={order.remainingBalance} value={splitAmount} onChange={(e) => setSplitAmount(e.target.value)} placeholder={order.remainingBalance.toFixed(2)} className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm tabular-nums placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                  <button onClick={() => setSplitAmount(order.remainingBalance.toFixed(2))} className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white/40 hover:text-white text-xs font-medium transition-colors">Full</button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button onClick={handleBankTransfer} disabled={paymentLoading} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Bank Transfer</p>
                  <p className="text-white/40 text-xs mt-0.5">Pay via direct bank transfer</p>
                </div>
                <svg className="w-5 h-5 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={handleCardPayment} disabled={paymentLoading} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Card Payment</p>
                  <p className="text-white/40 text-xs mt-0.5">Pay securely with your card</p>
                </div>
                <svg className="w-5 h-5 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
              <button onClick={handleFinancePayment} disabled={paymentLoading} className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left flex items-center gap-5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">Finance</p>
                  <p className="text-white/40 text-xs mt-0.5">Spread the cost with iwocaPay</p>
                </div>
                <svg className="w-5 h-5 text-white/20 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
            {paymentLoading && (
              <div className="flex justify-center mt-4">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {/* Square card form */}
        {showCardForm && order.status === "ACCEPTED" && !order.paymentMethod && (
          <div className="mb-6">
            <SquareCardForm
              orderId={order.id}
              total={formatPrice(order.totals.total)}
              chargeUrl={`/api/pay/${order.id}/payment/charge`}
              onSuccess={() => { setShowCardForm(false); fetchOrder(); }}
              onCancel={() => setShowCardForm(false)}
            />
          </div>
        )}

        {/* Bank transfer details */}
        {showBankInfo && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6">
            <h3 className="text-white font-semibold text-lg mb-4">Bank Transfer Details</h3>
            <p className="text-white/50 text-sm mb-4">Use your order reference <span className="text-white font-medium">#{order.id.slice(0, 8).toUpperCase()}</span> when making the transfer</p>
            <div className="space-y-3">
              {[
                ["Account Holder", BANK_DETAILS.accountHolder],
                ["Sort Code", BANK_DETAILS.sortCode],
                ["Account Number", BANK_DETAILS.accountNumber],
                ["VAT Number", BANK_DETAILS.vatNumber],
                ["Amount", formatPrice(order.totals.total)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-white/50 text-sm">{label}</span>
                  <span className="text-white font-medium text-sm font-mono">{value}</span>
                </div>
              ))}
            </div>
            <button onClick={handleConfirmBankSent} disabled={paymentLoading} className="w-full mt-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all">
              {paymentLoading ? "Confirming..." : "I've Sent the Transfer"}
            </button>
          </div>
        )}

        {/* Card pending */}
        {showCardPending && (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-[16px] p-4 mb-6">
            <p className="text-purple-400 text-sm font-medium">Card payment initiated. Awaiting confirmation.</p>
          </div>
        )}

        {/* Finance pending */}
        {showFinancePending && order.paymentReference && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[20px] p-6 mb-6">
            <h3 className="text-emerald-400 font-semibold mb-2">Finance Application</h3>
            <p className="text-emerald-400/60 text-sm mb-4">Complete your iwocaPay application to finalise payment.</p>
            <a href={order.paymentReference} target="_blank" rel="noopener noreferrer" className="inline-block px-5 py-2.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium rounded-xl transition-all text-sm">
              Open iwocaPay Application
            </a>
            <button onClick={handleConfirmBankSent} disabled={paymentLoading} className="block w-full mt-4 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-all text-sm">
              {paymentLoading ? "Confirming..." : "I've Completed the Application"}
            </button>
          </div>
        )}

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
