"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import SquareCardForm, { type BuyerContact } from "@/app/components/SquareCardForm";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const BANK_DETAILS = {
  accountHolder: "THE CORAL FARM LTD",
  sortCode: "04-29-09",
  accountNumber: "48775908",
  vatNumber: "486315274",
};

export interface PaymentSectionOrder {
  id: string;
  status: string;
  paymentMethod: string | null;
  paymentReference: string | null;
  payments: { id: string; method: string; amount: number; reference?: string | null; status: string; createdAt: string }[];
  totals: { total: number };
  remainingBalance: number;
}

interface PaymentSectionProps {
  orderId: string;
  order: PaymentSectionOrder;
  buyer?: BuyerContact | null;
  apiBasePath: string;
  canManagePayments: boolean;
  canViewPayments: boolean;
  canCancelPayments: boolean;
  onPaymentChange: () => void;
  chargeUrl?: string;
}

export default function PaymentSection({
  orderId,
  order,
  buyer,
  apiBasePath,
  canManagePayments,
  canViewPayments,
  canCancelPayments,
  onPaymentChange,
  chargeUrl,
}: PaymentSectionProps) {
  const searchParams = useSearchParams();
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [splitMode, setSplitMode] = useState(false);
  const [splitAmount, setSplitAmount] = useState("");
  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef(false);

  // Verify card payment on redirect back
  useEffect(() => {
    if (searchParams.get("payment") !== "success" || verifiedRef.current) return;
    verifiedRef.current = true;
    setVerifying(true);
    fetch(apiBasePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_card" }),
    })
      .then(() => onPaymentChange())
      .finally(() => setVerifying(false));
  }, [searchParams, apiBasePath, onPaymentChange]);

  const getPaymentAmount = () => splitMode && splitAmount ? parseFloat(splitAmount) : undefined;

  const handleBankTransfer = async () => {
    setPaymentLoading(true);
    const res = await fetch(apiBasePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "BANK_TRANSFER", amount: getPaymentAmount() }),
    });
    if (res.ok) {
      setShowBankDetails(true);
      setSplitAmount("");
      await onPaymentChange();
    }
    setPaymentLoading(false);
  };

  const handleCardPayment = () => setShowCardForm(true);

  const handleFinancePayment = async () => {
    setPaymentLoading(true);
    const res = await fetch(apiBasePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "FINANCE", amount: getPaymentAmount() }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, "_blank");
        await onPaymentChange();
      }
    }
    setPaymentLoading(false);
  };

  const handleConfirmBankSent = async (paymentId?: string) => {
    setPaymentLoading(true);
    await fetch(apiBasePath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_bank_sent", paymentId }),
    });
    setShowBankDetails(false);
    await onPaymentChange();
    setPaymentLoading(false);
  };

  const handleCancelPayment = async (paymentId: string) => {
    setPaymentLoading(true);
    await fetch(`${apiBasePath}?paymentId=${paymentId}`, { method: "DELETE" });
    setShowBankDetails(false);
    await onPaymentChange();
    setPaymentLoading(false);
  };

  const pendingPayments = (order.payments || []).filter((p) => p.status === "PENDING");
  const awaitingPayments = (order.payments || []).filter((p) => p.status === "AWAITING_CONFIRMATION");

  const hasPendingBank = pendingPayments.some((p) => p.method === "BANK_TRANSFER");
  const hasPendingCard = pendingPayments.some((p) => p.method === "CARD");
  const hasPendingFinance = pendingPayments.some((p) => p.method === "FINANCE");

  const canSelectPayment = canManagePayments && (order.status === "ACCEPTED" || order.status === "AWAITING_PAYMENT") && order.remainingBalance > 0 && pendingPayments.length === 0 && !showCardForm;
  const showBankInfo = canManagePayments && hasPendingBank;
  const showCardPending = canManagePayments && hasPendingCard;
  const showFinancePending = canManagePayments && hasPendingFinance;

  return (
    <>
      {/* Payment success banner */}
      {canViewPayments && searchParams.get("payment") === "success" && order.status === "PAID" && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[16px] p-4 mb-6">
          <p className="text-emerald-400 text-sm font-medium">Payment received! Your order will be processed shortly.</p>
        </div>
      )}

      {verifying && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-[16px] p-4 mb-6 flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          <p className="text-blue-400 text-sm font-medium">Verifying payment...</p>
        </div>
      )}

      {/* Existing payments */}
      {canViewPayments && order.payments?.length > 0 && (
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
                    {p.method === "BANK_TRANSFER" ? "Bank Transfer" : p.method === "CARD" ? "Card" : "Finance"}
                  </span>
                  <span className={`text-[10px] font-medium ${p.status === "COMPLETED" ? "text-emerald-400" : p.status === "AWAITING_CONFIRMATION" ? "text-amber-400" : "text-white/40"}`}>
                    {p.status === "COMPLETED" ? "Paid" : p.status === "AWAITING_CONFIRMATION" ? "Awaiting confirmation" : "Pending"}
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
              <input type="checkbox" checked={splitMode} onChange={(e) => { setSplitMode(e.target.checked); setSplitAmount(e.target.checked ? order.remainingBalance.toFixed(2) : ""); }} className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer" />
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
      {canManagePayments && showCardForm && order.status === "ACCEPTED" && !order.paymentMethod && (
        <div className="mb-6">
          <SquareCardForm
            orderId={orderId}
            total={formatPrice(order.totals.total)}
            amount={getPaymentAmount() ?? order.remainingBalance}
            buyer={buyer}
            chargeUrl={chargeUrl}
            onSuccess={() => { setShowCardForm(false); onPaymentChange(); }}
            onCancel={() => setShowCardForm(false)}
          />
        </div>
      )}

      {/* Bank transfer details */}
      {showBankInfo && (() => {
        const bankPayment = pendingPayments.find((p) => p.method === "BANK_TRANSFER");
        const paymentAmount = bankPayment ? Number(bankPayment.amount) : order.remainingBalance;
        return (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Bank Transfer Details</h3>
              {canCancelPayments && bankPayment && (
                <button onClick={() => handleCancelPayment(bankPayment.id)} disabled={paymentLoading} className="text-white/40 hover:text-white text-xs font-medium transition-colors">
                  Cancel
                </button>
              )}
            </div>
            <p className="text-white/50 text-sm mb-4">Use your order reference <span className="text-white font-medium">#{orderId.slice(0, 8).toUpperCase()}</span> when making the transfer</p>
            <div className="space-y-3">
              {[
                ["Account Holder", BANK_DETAILS.accountHolder],
                ["Sort Code", BANK_DETAILS.sortCode],
                ["Account Number", BANK_DETAILS.accountNumber],
                ["VAT Number", BANK_DETAILS.vatNumber],
                ["Amount", formatPrice(paymentAmount)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-white/50 text-sm">{label}</span>
                  <span className="text-white font-medium text-sm font-mono">{value}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => bankPayment ? handleConfirmBankSent(bankPayment.id) : handleConfirmBankSent()}
              disabled={paymentLoading}
              className="w-full mt-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all"
            >
              {paymentLoading ? "Confirming..." : "I've Sent the Transfer"}
            </button>
          </div>
        );
      })()}

      {/* Card pending */}
      {showCardPending && (() => {
        const cardPayment = pendingPayments.find((p) => p.method === "CARD");
        return (
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-[16px] p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-purple-400 text-sm font-medium">Card payment of {cardPayment ? formatPrice(Number(cardPayment.amount)) : ""} initiated. Awaiting confirmation.</p>
              {canCancelPayments && cardPayment && (
                <button onClick={() => handleCancelPayment(cardPayment.id)} disabled={paymentLoading} className="text-purple-400/60 hover:text-purple-400 text-xs font-medium transition-colors ml-3">
                  Cancel
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Finance pending */}
      {showFinancePending && (() => {
        const finPayment = pendingPayments.find((p) => p.method === "FINANCE");
        return (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Finance via iwocaPay</h3>
              {canCancelPayments && finPayment && (
                <button onClick={() => handleCancelPayment(finPayment.id)} disabled={paymentLoading} className="text-white/40 hover:text-white text-xs font-medium transition-colors">
                  Cancel
                </button>
              )}
            </div>
            <p className="text-white/50 text-sm mb-4">
              Amount: <span className="text-white font-medium">{finPayment ? formatPrice(Number(finPayment.amount)) : ""}</span>
            </p>
            {finPayment?.reference && (
              <a href={finPayment.reference} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium rounded-xl text-sm transition-all">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                Complete Finance Application
              </a>
            )}
            <button onClick={() => finPayment && handleConfirmBankSent(finPayment.id)} disabled={paymentLoading} className="mt-4 w-full py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all">
              {paymentLoading ? "Confirming..." : "I've Completed the Finance Application"}
            </button>
          </div>
        );
      })()}

      {/* Awaiting confirmation status */}
      {canViewPayments && awaitingPayments.length > 0 && (
        <div className="space-y-2 mb-6">
          {awaitingPayments.map((p) => (
            <div key={p.id} className="bg-amber-500/10 border border-amber-500/20 rounded-[16px] p-4">
              <p className="text-amber-400 text-sm font-medium">
                {p.method === "BANK_TRANSFER" ? `Bank transfer of ${formatPrice(Number(p.amount))} marked as sent.` : p.method === "FINANCE" ? `Finance application for ${formatPrice(Number(p.amount))} submitted.` : `Payment of ${formatPrice(Number(p.amount))} pending.`}
                {" "}Awaiting confirmation from The Coral Farm.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Payment confirmed */}
      {canViewPayments && order.status === "PAID" && !searchParams.get("payment") && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[16px] p-4 mb-6">
          <p className="text-emerald-400 text-sm font-medium">Payment confirmed. Thank you!</p>
        </div>
      )}
    </>
  );
}
