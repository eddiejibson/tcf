"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { UserOrderDetail, DoaClaimDetail } from "@/app/lib/types";
import { useAuth } from "@/app/lib/auth-context";
import { generateInvoice } from "@/app/lib/generate-invoice";
import SquareCardForm from "@/app/components/SquareCardForm";

function formatPrice(n: number) {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-white/10 text-white/60",
  SUBMITTED: "bg-blue-500/20 text-blue-400",
  AWAITING_FULFILLMENT: "bg-orange-500/20 text-orange-400",
  ACCEPTED: "bg-green-500/20 text-green-400",
  REJECTED: "bg-red-500/20 text-red-400",
  AWAITING_PAYMENT: "bg-yellow-500/20 text-yellow-400",
  PAID: "bg-emerald-500/20 text-emerald-400",
  EXPIRED: "bg-orange-500/20 text-orange-400",
};

const statusLabels: Record<string, string> = {
  AWAITING_FULFILLMENT: "AWAITING FULFILLMENT",
  AWAITING_PAYMENT: "AWAITING PAYMENT",
};

const BANK_DETAILS = {
  accountHolder: "THE CORAL FARM LTD",
  sortCode: "04-29-09",
  accountNumber: "48775908",
  vatNumber: "486315274",
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [order, setOrder] = useState<UserOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const verifiedRef = useRef(false);
  const [creditLoading, setCreditLoading] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);

  const [doaClaim, setDoaClaim] = useState<DoaClaimDetail | null>(null);
  const [showDoaForm, setShowDoaForm] = useState(false);
  const [doaItems, setDoaItems] = useState<{ orderItemId: string; quantity: number; imageKeys: string[]; uploading: boolean; previews: string[] }[]>([]);
  const [doaSubmitting, setDoaSubmitting] = useState(false);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${params.id}`);
    if (res.ok) setOrder(await res.json());
    setLoading(false);
  }, [params.id]);

  const fetchDoaClaim = useCallback(async () => {
    const res = await fetch(`/api/orders/${params.id}/doa`);
    if (res.ok) {
      const data = await res.json();
      setDoaClaim(data);
    }
  }, [params.id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);
  useEffect(() => { fetchDoaClaim(); }, [fetchDoaClaim]);

  useEffect(() => {
    if (searchParams.get("payment") !== "success" || verifiedRef.current) return;
    verifiedRef.current = true;
    setVerifying(true);
    fetch(`/api/orders/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify_card" }),
    })
      .then((res) => res.json())
      .then(() => fetchOrder())
      .finally(() => setVerifying(false));
  }, [searchParams, params.id, fetchOrder]);

  const handleBankTransfer = async () => {
    setPaymentLoading(true);
    const res = await fetch(`/api/orders/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "BANK_TRANSFER" }),
    });
    if (res.ok) {
      setShowBankDetails(true);
      await fetchOrder();
    }
    setPaymentLoading(false);
  };

  const handleCardPayment = () => {
    setShowCardForm(true);
  };

  const handleFinancePayment = async () => {
    setPaymentLoading(true);
    const res = await fetch(`/api/orders/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "FINANCE" }),
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

  const handleChangeMethod = async () => {
    setPaymentLoading(true);
    const res = await fetch(`/api/orders/${params.id}/payment`, {
      method: "DELETE",
    });
    if (res.ok) {
      setShowBankDetails(false);
      await fetchOrder();
    }
    setPaymentLoading(false);
  };

  const handleConfirmBankSent = async () => {
    setPaymentLoading(true);
    await fetch(`/api/orders/${params.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm_bank_sent" }),
    });
    await fetchOrder();
    setPaymentLoading(false);
  };

  const handleToggleCredit = async (apply: boolean) => {
    setCreditLoading(true);
    const res = await fetch(`/api/orders/${params.id}/credit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: apply ? "apply" : "remove" }),
    });
    if (res.ok) {
      await fetchOrder();
      await refreshUser();
    }
    setCreditLoading(false);
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    await generateInvoice({
      orderRef: order.id.slice(0, 8).toUpperCase(),
      date: new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      status: order.status,
      customerEmail: user?.email || "",
      customerCompanyName: user?.companyName,
      shipmentName: order.shipment?.name || "Direct Order",
      items: order.items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
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

  const compressImage = async (file: File): Promise<Blob> => {
    if (file.size <= 2 * 1024 * 1024) return file;
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 1920;
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height / width) * maxSize; width = maxSize; }
          else { width = (width / height) * maxSize; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => resolve(blob || file), "image/jpeg", 0.8);
      };
      img.src = URL.createObjectURL(file);
    });
  };

  const uploadOneImage = async (file: File): Promise<{ key: string; preview: string }> => {
    const compressed = await compressImage(file);
    const ext = file.name.split(".").pop() || "jpg";
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    let key: string;

    if (isLocalhost) {
      const formData = new FormData();
      formData.append("file", new File([compressed], `photo.${ext}`, { type: compressed.type || "image/jpeg" }));
      const res = await fetch("/api/upload/signed-url", { method: "POST", body: formData });
      ({ key } = await res.json());
    } else {
      const res = await fetch("/api/upload/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: compressed.type || "image/jpeg", filename: `photo.${ext}` }),
      });
      const data = await res.json();
      key = data.key;
      await fetch(data.url, { method: "PUT", body: compressed, headers: { "Content-Type": compressed.type || "image/jpeg" } });
    }

    return { key, preview: URL.createObjectURL(compressed) };
  };

  const handleDoaImageUpload = async (index: number, files: FileList) => {
    setDoaItems((prev) => prev.map((item, i) => i === index ? { ...item, uploading: true } : item));
    try {
      const results = await Promise.all(Array.from(files).map(uploadOneImage));
      setDoaItems((prev) => prev.map((item, i) => i === index ? {
        ...item,
        imageKeys: [...item.imageKeys, ...results.map((r) => r.key)],
        previews: [...item.previews, ...results.map((r) => r.preview)],
        uploading: false,
      } : item));
    } catch {
      setDoaItems((prev) => prev.map((item, i) => i === index ? { ...item, uploading: false } : item));
    }
  };

  const handleDoaSubmit = async () => {
    const valid = doaItems.every((item) => item.orderItemId && item.quantity > 0 && item.imageKeys.length > 0);
    if (!valid) return;
    setDoaSubmitting(true);
    const res = await fetch(`/api/orders/${params.id}/doa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: doaItems.map(({ orderItemId, quantity, imageKeys }) => ({ orderItemId, quantity, imageKeys })) }),
    });
    if (res.ok) {
      setShowDoaForm(false);
      setDoaItems([]);
      await fetchDoaClaim();
    }
    setDoaSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!order) return <div className="p-8 text-white/40">Order not found</div>;

  const canSelectPayment = order.status === "ACCEPTED" && !order.paymentMethod && !showCardForm;
  const showBankInfo = order.status === "ACCEPTED" && (order.paymentMethod === "BANK_TRANSFER" || showBankDetails);
  const showCardPending = order.status === "ACCEPTED" && order.paymentMethod === "CARD";
  const showFinancePending = order.status === "ACCEPTED" && order.paymentMethod === "FINANCE";
  const isAwaitingPayment = order.status === "AWAITING_PAYMENT";

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/orders")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Orders
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-white/50 text-sm mt-1">{order.shipment?.name || "Direct Order"}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadInvoice}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Invoice
          </button>
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusColors[order.status] || "bg-white/10 text-white/60"}`}>{statusLabels[order.status] || order.status}</span>
        </div>
      </div>

      {searchParams.get("payment") === "success" && order.status === "PAID" && (
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

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[400px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
          <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
          <div className="w-16 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty</p></div>
          <div className="w-24 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
        </div>
        {order.items.map((item) => (
          <div key={item.id} className="min-w-[400px] px-4 md:px-6 py-3 border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="flex-1"><p className="text-white/90 text-sm font-medium">{item.name}</p></div>
              <div className="w-24 text-right"><p className="text-white/60 text-sm tabular-nums">{formatPrice(Number(item.unitPrice))}</p></div>
              <div className="w-16 text-center"><p className="text-white/60 text-sm">{item.quantity}</p></div>
              <div className="w-24 text-right"><p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice(item.quantity * Number(item.unitPrice))}</p></div>
            </div>
            {item.substituteName && (
              <p className="text-amber-400/60 text-[11px] mt-1">Substitute if unavailable: {item.substituteName}</p>
            )}
          </div>
        ))}
        </div>
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
            <span className="text-white font-semibold">Grand Total</span>
            <span className="text-[#0984E3] font-bold text-lg tabular-nums">{formatPrice(order.totals.total)}</span>
          </div>
        </div>
      </div>

      {order.status === "AWAITING_FULFILLMENT" && (
        <div className="mt-6 bg-orange-500/10 border border-orange-500/20 rounded-[16px] p-4">
          <p className="text-orange-400 text-sm font-medium">Your order has been sent to our exporter for fulfillment. You will be notified once items are confirmed and payment is due.</p>
        </div>
      )}

      {order.adminNotes && (
        <div className="mt-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2">Note from The Coral Farm</p>
          <p className="text-white/70 text-sm whitespace-pre-wrap">{order.adminNotes}</p>
        </div>
      )}

      {order.useCredit && !Number(order.creditApplied) && order.status !== "ACCEPTED" && order.status !== "PAID" && (
        <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[20px] p-5">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div>
              <p className="text-emerald-400 font-medium text-sm">Account credit will be applied</p>
              <p className="text-emerald-400/60 text-xs">Credit will be deducted from your balance once this order is accepted</p>
            </div>
          </div>
        </div>
      )}

      {order.status === "ACCEPTED" && user && user.creditBalance > 0 && Number(order.creditApplied) === 0 && (
        <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[20px] p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={false}
              onChange={() => handleToggleCredit(true)}
              disabled={creditLoading}
              className="w-5 h-5 rounded bg-white/5 border-emerald-500/30 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
            />
            <div>
              <p className="text-emerald-400 font-medium text-sm">Use account credit</p>
              <p className="text-emerald-400/60 text-xs">{formatPrice(user.creditBalance)} available - will be applied against this order</p>
            </div>
            {creditLoading && <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin ml-auto" />}
          </label>
        </div>
      )}

      {order.status === "ACCEPTED" && Number(order.creditApplied) > 0 && (
        <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[20px] p-5">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={true}
              onChange={() => handleToggleCredit(false)}
              disabled={creditLoading}
              className="w-5 h-5 rounded bg-white/5 border-emerald-500/30 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
            />
            <div>
              <p className="text-emerald-400 font-medium text-sm">Account credit applied</p>
              <p className="text-emerald-400/60 text-xs">{formatPrice(Number(order.creditApplied))} credit applied to this order</p>
            </div>
            {creditLoading && <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin ml-auto" />}
          </label>
        </div>
      )}

      {canSelectPayment && (
        <div className="mt-6">
          <h3 className="text-white font-semibold text-lg mb-1">Payment</h3>
          <p className="text-white/50 text-sm mb-5">Choose how you would like to pay for this order</p>
          <div className="space-y-3">
            <button
              onClick={handleBankTransfer}
              disabled={paymentLoading}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left flex items-center gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 7.5h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Bank Transfer</p>
                <p className="text-white/40 text-xs mt-0.5">Pay via direct bank transfer</p>
              </div>
              <svg className="w-5 h-5 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
            <button
              onClick={handleCardPayment}
              disabled={paymentLoading}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left flex items-center gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Card Payment</p>
                <p className="text-white/40 text-xs mt-0.5">Pay securely with your card</p>
              </div>
              <svg className="w-5 h-5 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
            <button
              onClick={handleFinancePayment}
              disabled={paymentLoading}
              className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.08] hover:border-white/20 transition-all text-left flex items-center gap-5"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">Finance</p>
                <p className="text-white/40 text-xs mt-0.5">Spread the cost with iwocaPay — flexible instalments, no personal credit impact</p>
              </div>
              <svg className="w-5 h-5 text-white/20 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {paymentLoading && (
            <div className="flex justify-center mt-4">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {showCardForm && order.status === "ACCEPTED" && !order.paymentMethod && (
        <SquareCardForm
          orderId={order.id}
          total={formatPrice(order.totals.total)}
          onSuccess={() => {
            setShowCardForm(false);
            fetchOrder();
          }}
          onCancel={() => setShowCardForm(false)}
        />
      )}

      {showBankInfo && (
        <div className="mt-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Bank Transfer Details</h3>
            <button onClick={handleChangeMethod} disabled={paymentLoading} className="text-white/40 hover:text-white text-xs font-medium transition-colors">
              Change method
            </button>
          </div>
          <p className="text-white/50 text-sm mb-4">Please use your order reference <span className="text-white font-medium">#{order.id.slice(0, 8).toUpperCase()}</span> when making the transfer</p>
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
          <button
            onClick={handleConfirmBankSent}
            disabled={paymentLoading}
            className="mt-6 w-full py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all"
          >
            {paymentLoading ? "Confirming..." : "I've Sent the Transfer"}
          </button>
        </div>
      )}

      {showCardPending && (
        <div className="mt-6 bg-blue-500/10 border border-blue-500/20 rounded-[16px] p-4 flex items-center justify-between">
          <p className="text-blue-400 text-sm font-medium">Card payment initiated. Awaiting confirmation.</p>
          <button onClick={handleChangeMethod} disabled={paymentLoading} className="text-blue-400/60 hover:text-blue-400 text-xs font-medium transition-colors">
            Change method
          </button>
        </div>
      )}

      {showFinancePending && (
        <div className="mt-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold text-lg">Finance via iwocaPay</h3>
            <button onClick={handleChangeMethod} disabled={paymentLoading} className="text-white/40 hover:text-white text-xs font-medium transition-colors">
              Change method
            </button>
          </div>
          <p className="text-white/50 text-sm mb-4">
            Spread the cost of your order with iwocaPay. Pay in flexible instalments with no impact on your personal credit score.
          </p>
          {order.paymentReference && (
            <a
              href={order.paymentReference}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 font-medium rounded-xl text-sm transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              Complete Finance Application
            </a>
          )}
          <button
            onClick={handleConfirmBankSent}
            disabled={paymentLoading}
            className="mt-4 w-full py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all"
          >
            {paymentLoading ? "Confirming..." : "I've Completed the Finance Application"}
          </button>
        </div>
      )}

      {isAwaitingPayment && (
        <div className="mt-6 bg-yellow-500/10 border border-yellow-500/20 rounded-[16px] p-4">
          <p className="text-yellow-400 text-sm font-medium">
            {order.paymentMethod === "BANK_TRANSFER"
              ? "Bank transfer marked as sent. Awaiting confirmation from The Coral Farm."
              : order.paymentMethod === "FINANCE"
              ? "Finance application submitted. Awaiting confirmation from The Coral Farm."
              : "Payment awaiting confirmation."}
          </p>
        </div>
      )}

      {order.status === "PAID" && !searchParams.get("payment") && (
        <div className="mt-6 bg-emerald-500/10 border border-emerald-500/20 rounded-[16px] p-4">
          <p className="text-emerald-400 text-sm font-medium">Payment confirmed. Thank you!</p>
        </div>
      )}

      {order.status === "PAID" && (
        <div className="mt-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
          <h3 className="text-white font-semibold text-lg mb-2">Dead On Arrival (DOA) Report</h3>

          {doaClaim ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-lg text-xs font-medium ${
                  doaClaim.status === "PENDING" ? "bg-yellow-500/20 text-yellow-400"
                    : doaClaim.status === "REVIEWED" ? "bg-blue-500/20 text-blue-400"
                    : "bg-green-500/20 text-green-400"
                }`}>
                  {doaClaim.status}
                </span>
                <p className="text-white/50 text-sm">Claim submitted</p>
              </div>
              <div className="space-y-3">
                {doaClaim.items.map((item) => (
                  <div key={item.id} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-white/90 text-sm font-medium">{item.orderItem?.name || "Item"}</p>
                        <p className="text-white/50 text-xs">Qty DOA: {item.quantity}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${item.approved ? "bg-green-500/20 text-green-400" : "bg-white/10 text-white/40"}`}>
                        {item.approved ? "Approved" : "Pending"}
                      </span>
                    </div>
                    {item.imageUrls?.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.imageUrls.map((url: string, i: number) => (
                          <img key={i} src={url} alt="DOA evidence" className="w-16 h-16 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : showDoaForm ? (
            <div>
              <p className="text-white/50 text-sm mb-4">Report items that arrived dead. Add a photo of each item as evidence.</p>
              <div className="space-y-4">
                {doaItems.map((doaItem, index) => (
                  <div key={index} className="bg-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <select
                        value={doaItem.orderItemId}
                        onChange={(e) => setDoaItems((prev) => prev.map((item, i) => i === index ? { ...item, orderItemId: e.target.value } : item))}
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30 [&>option]:bg-[#1a1f2e] [&>option]:text-white"
                      >
                        <option value="">Select item...</option>
                        {order.items.map((oi) => (
                          <option key={oi.id} value={oi.id}>{oi.name} (ordered: {oi.quantity})</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={doaItem.quantity || ""}
                        onChange={(e) => setDoaItems((prev) => prev.map((item, i) => i === index ? { ...item, quantity: parseInt(e.target.value) || 0 } : item))}
                        placeholder="Qty"
                        className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                      />
                      <button
                        onClick={() => setDoaItems((prev) => prev.filter((_, i) => i !== index))}
                        className="text-white/30 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div>
                      {doaItem.previews.length > 0 && (
                        <div className="flex gap-2 mb-2 flex-wrap">
                          {doaItem.previews.map((preview, pi) => (
                            <div key={pi} className="relative">
                              <img src={preview} alt="Preview" className="w-16 h-16 object-cover rounded-lg" />
                              <button
                                onClick={() => setDoaItems((prev) => prev.map((item, i) => i === index ? {
                                  ...item,
                                  imageKeys: item.imageKeys.filter((_, ki) => ki !== pi),
                                  previews: item.previews.filter((_, ki) => ki !== pi),
                                } : item))}
                                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]"
                              >x</button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-dashed border-white/20 rounded-lg cursor-pointer hover:border-white/40 transition-colors">
                        {doaItem.uploading ? (
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ) : (
                          <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                        )}
                        <span className="text-white/40 text-xs">{doaItem.uploading ? "Uploading..." : doaItem.previews.length > 0 ? "Add more photos" : "Upload photos"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.length) handleDoaImageUpload(index, e.target.files);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={() => setDoaItems((prev) => [...prev, { orderItemId: "", quantity: 0, imageKeys: [], uploading: false, previews: [] }])}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
                >
                  + Add Item
                </button>
                <button
                  onClick={handleDoaSubmit}
                  disabled={doaSubmitting || doaItems.length === 0 || doaItems.some((i) => !i.orderItemId || !i.quantity || !i.imageKeys.length)}
                  className="px-4 py-2 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl text-sm transition-all"
                >
                  {doaSubmitting ? "Submitting..." : "Submit DOA Report"}
                </button>
                <button
                  onClick={() => { setShowDoaForm(false); setDoaItems([]); }}
                  className="px-4 py-2 text-white/40 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-white/50 text-sm mb-4">Did any items arrive dead? You can report them here with photo evidence.</p>
              <button
                onClick={() => {
                  setShowDoaForm(true);
                  setDoaItems([{ orderItemId: "", quantity: 0, imageKeys: [], uploading: false, previews: [] }]);
                }}
                className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all"
              >
                Report DOA
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
