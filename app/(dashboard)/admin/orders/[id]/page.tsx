"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { AdminOrderDetail, EditableOrderItem } from "@/app/lib/types";
import { generateInvoice } from "@/app/lib/generate-invoice";
import { estimateFreight } from "@/app/lib/freight";

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

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<EditableOrderItem[]>([]);
  const [includeShipping, setIncludeShipping] = useState(false);
  const [freightCharge, setFreightCharge] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [maxBoxes, setMaxBoxes] = useState("");
  const [minBoxes, setMinBoxes] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const applyOrderData = useCallback((data: AdminOrderDetail) => {
    setOrder(data);
    setItems(data.items);
    setIncludeShipping(data.includeShipping);
    setAdminNotes(data.adminNotes || "");

    let fc: string;
    if (data.freightCharge != null && Number(data.freightCharge) !== 0) {
      fc = String(data.freightCharge);
    } else {
      const est = estimateFreight(
        (data.items || []).map((item: { quantity: number; product?: { qtyPerBox?: number } }) => ({
          quantity: item.quantity,
          qtyPerBox: item.product?.qtyPerBox || 1,
        })),
        Number(data.shipment?.freightCost ?? 0),
      );
      fc = est.freight > 0 ? est.freight.toFixed(2) : "";
    }
    setFreightCharge(fc);
    setMaxBoxes(data.maxBoxes != null ? String(data.maxBoxes) : "");
    setMinBoxes(data.minBoxes != null ? String(data.minBoxes) : "");

    setSavedSnapshot(JSON.stringify({
      items: data.items.map((i: EditableOrderItem) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
      includeShipping: data.includeShipping,
      freightCharge: fc,
      adminNotes: data.adminNotes || "",
      maxBoxes: data.maxBoxes != null ? String(data.maxBoxes) : "",
      minBoxes: data.minBoxes != null ? String(data.minBoxes) : "",
    }));
  }, []);

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/admin/orders/${params.id}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.status === "DRAFT") {
        router.replace(`/admin/orders/${params.id}/edit`);
        return;
      }
      applyOrderData(data);
    }
    setLoading(false);
  }, [params.id, applyOrderData, router]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...items];
    if (field === "quantity") updated[index] = { ...updated[index], quantity: Number(value) || 0 };
    else if (field === "unitPrice") updated[index] = { ...updated[index], unitPrice: Number(value) || 0 };
    else if (field === "surcharge") updated[index] = { ...updated[index], surcharge: Number(value) || 0 };
    else if (field === "name") updated[index] = { ...updated[index], name: String(value) };
    setItems(updated);
  };

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const addCustomItem = () => {
    if (!newItemName || !newItemPrice) return;
    setItems([...items, {
      id: "",
      productId: null,
      catalogProductId: null,
      name: newItemName,
      quantity: parseInt(newItemQty) || 1,
      unitPrice: parseFloat(newItemPrice) || 0,
      surcharge: 0,
      substituteProductId: null,
      substituteName: null,
    }]);
    setNewItemName("");
    setNewItemPrice("");
    setNewItemQty("1");
  };

  const patchOrder = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/orders/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      applyOrderData(await res.json());
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchOrder({
        items: items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, surcharge: i.surcharge || 0 })),
        includeShipping,
        freightCharge: freightCharge ? parseFloat(freightCharge) : null,
        adminNotes: adminNotes || null,
        maxBoxes: maxBoxes ? parseInt(maxBoxes) : null,
        minBoxes: minBoxes ? parseInt(minBoxes) : null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    setSaving(true);
    try {
      await patchOrder({
        status,
        items: items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice })),
        includeShipping,
        freightCharge: freightCharge ? parseFloat(freightCharge) : null,
        adminNotes: adminNotes || null,
        maxBoxes: maxBoxes ? parseInt(maxBoxes) : null,
        minBoxes: minBoxes ? parseInt(minBoxes) : null,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    setSaving(true);
    try {
      await patchOrder({ markPaid: true });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadInvoice = async () => {
    if (!order) return;
    await generateInvoice({
      orderRef: order.id.slice(0, 8).toUpperCase(),
      date: new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      status: order.status,
      customerEmail: order.user?.email || "",
      customerCompanyName: order.user?.companyName || null,
      shipmentName: order.shipment?.name || "Direct Order",
      items: order.items.map((i) => ({ name: i.name, latinName: i.latinName, categoryName: i.categoryName, quantity: i.quantity, unitPrice: Number(i.unitPrice), surcharge: Number(i.surcharge) || 0 })),
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

  const handleResendEmail = async () => {
    if (!order) return;
    setResending(true);
    setResendDone(false);
    try {
      const res = await fetch(`/api/admin/orders/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resendEmail: true }),
      });
      if (res.ok) {
        setResendDone(true);
        setTimeout(() => setResendDone(false), 3000);
      }
    } finally {
      setResending(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!order) return <div className="p-4 md:p-8 text-white/40">Order not found</div>;

  const subtotal = items.reduce((sum, i) => {
    const base = i.quantity * Number(i.unitPrice);
    return sum + base + base * ((Number(i.surcharge) || 0) / 100);
  }, 0);
  const shipping = includeShipping ? 30 : 0;
  const freight = parseFloat(freightCharge) || 0;
  const vat = (subtotal + shipping + freight) * 0.2;
  const credit = Number(order?.creditApplied) || 0;
  const total = subtotal + shipping + freight + vat - credit;
  const isEditable = ["SUBMITTED", "AWAITING_FULFILLMENT", "ACCEPTED"].includes(order.status);

  const currentSnapshot = JSON.stringify({
    items: items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: Number(i.unitPrice), surcharge: Number(i.surcharge) || 0 })),
    includeShipping,
    freightCharge,
    adminNotes,
    maxBoxes,
    minBoxes,
  });
  const hasChanges = savedSnapshot !== "" && currentSnapshot !== savedSnapshot;

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/orders")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Orders
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6 md:mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Order #{order.id.slice(0, 8).toUpperCase()}</h1>
          <p className="text-white/50 text-sm mt-1">{order.user ? (order.user.companyName ? `${order.user.companyName} (${order.user.email})` : order.user.email) : <span className="italic">No customer assigned</span>} - {order.shipment?.name || "Direct Order"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadInvoice}
            className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Invoice
          </button>
          {saving ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <span className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap ${statusColors[order.status] || "bg-white/10 text-white/60"}`}>{statusLabels[order.status] || order.status}</span>
              {order.status === "SUBMITTED" && (
                <>
                  <button onClick={() => handleStatusChange("AWAITING_FULFILLMENT")} className="px-2.5 py-1 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 text-xs font-medium rounded-lg transition-all whitespace-nowrap">Fulfillment</button>
                  <button onClick={() => handleStatusChange("ACCEPTED")} className="px-2.5 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium rounded-lg transition-all whitespace-nowrap">Accept</button>
                  <button onClick={() => handleStatusChange("REJECTED")} className="px-2.5 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium rounded-lg transition-all whitespace-nowrap">Reject</button>
                </>
              )}
              {order.status === "AWAITING_FULFILLMENT" && (
                <>
                  <button onClick={() => handleStatusChange("ACCEPTED")} className="px-2.5 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 text-xs font-medium rounded-lg transition-all whitespace-nowrap">Accept</button>
                  <button onClick={() => handleStatusChange("REJECTED")} className="px-2.5 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium rounded-lg transition-all whitespace-nowrap">Reject</button>
                </>
              )}
              {(order.status === "ACCEPTED" || order.status === "AWAITING_PAYMENT") && (
                <button onClick={handleMarkPaid} className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium rounded-lg transition-all whitespace-nowrap">Confirm Payment</button>
              )}
              {(order.status === "ACCEPTED" || order.status === "AWAITING_PAYMENT" || order.status === "PAID") && (
                <button
                  onClick={handleResendEmail}
                  disabled={resending}
                  className="px-2.5 py-1 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white hover:bg-white/10 text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                >
                  {resending ? (
                    <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                  ) : resendDone ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-emerald-400">Sent</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" /></svg>
                      Send Invoice
                    </>
                  )}
                </button>
              )}
              {(order.status === "ACCEPTED" || order.status === "AWAITING_PAYMENT" || order.status === "PAID") && (
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/pay/${order.id}`;
                    navigator.clipboard.writeText(url);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 2500);
                  }}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-300 flex items-center gap-1.5 whitespace-nowrap overflow-hidden ${
                    linkCopied
                      ? "bg-gradient-to-r from-emerald-500/25 to-[#0984E3]/25 border border-emerald-500/30 text-emerald-400 scale-105"
                      : "bg-gradient-to-r from-[#0984E3]/15 to-purple-500/15 border border-[#0984E3]/20 text-[#0984E3] hover:from-[#0984E3]/25 hover:to-purple-500/25 hover:border-[#0984E3]/40 hover:scale-[1.02] active:scale-95"
                  }`}
                >
                  {linkCopied && <span className="absolute inset-0 bg-emerald-400/10 animate-ping rounded-lg" />}
                  {linkCopied ? (
                    <>
                      <svg className="w-3.5 h-3.5 relative" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span className="relative">Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-4.072a4.5 4.5 0 00-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" /></svg>
                      Pay Link
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {order.paymentMethod && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 mb-6">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-2">Payment</p>
          <p className="text-white text-sm">
            {order.paymentMethod === "BANK_TRANSFER" ? "Bank Transfer" : order.paymentMethod === "FINANCE" ? "Finance (iwocaPay)" : "Card Payment"}
            {order.paymentReference && order.paymentMethod !== "FINANCE" && <span className="text-white/40 ml-2">Ref: {order.paymentReference}</span>}
            {order.paymentMethod === "FINANCE" && order.paymentReference && (
              <a href={order.paymentReference} target="_blank" rel="noopener noreferrer" className="text-[#0984E3] ml-2 hover:underline">View iwocaPay link</a>
            )}
          </p>
        </div>
      )}

      {/* Addresses */}
      {(order.shippingAddress || order.billingAddress) && ["ACCEPTED", "AWAITING_PAYMENT", "PAID"].includes(order.status) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {order.shippingAddress && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4">
              <p className="text-[#0984E3] text-[10px] uppercase tracking-wider font-medium mb-2">Shipping Address</p>
              <p className="text-white/80 text-sm leading-relaxed">
                {order.shippingAddress.line1}
                {order.shippingAddress.line2 && <><br />{order.shippingAddress.line2}</>}
                <br />{order.shippingAddress.city}
                {order.shippingAddress.county && <>, {order.shippingAddress.county}</>}
                <br />{order.shippingAddress.postcode}
                <br /><span className="text-white/40">{order.shippingAddress.country}</span>
              </p>
            </div>
          )}
          {order.billingAddress && (
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4">
              <p className="text-white/50 text-[10px] uppercase tracking-wider font-medium mb-2">Billing Address</p>
              <p className="text-white/80 text-sm leading-relaxed">
                {order.billingAddress.line1}
                {order.billingAddress.line2 && <><br />{order.billingAddress.line2}</>}
                <br />{order.billingAddress.city}
                {order.billingAddress.county && <>, {order.billingAddress.county}</>}
                <br />{order.billingAddress.postcode}
                <br /><span className="text-white/40">{order.billingAddress.country}</span>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden mb-6">
        <div className="overflow-x-auto">
        <div className="min-w-[500px] px-4 md:px-6 py-3 flex items-center gap-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex-1"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Item</p></div>
          <div className="w-28"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Price</p></div>
          <div className="w-16 text-center"><p className="text-amber-400/50 text-[10px] uppercase tracking-wider font-medium">Sur %</p></div>
          <div className="w-20 text-center"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Qty</p></div>
          <div className="w-28 text-right"><p className="text-white/30 text-[10px] uppercase tracking-wider font-medium">Total</p></div>
          {isEditable && <div className="w-16"></div>}
        </div>

        {items.map((item, index) => (
          <div key={index} className="min-w-[500px] px-4 md:px-6 py-3 border-b border-white/5">
            <div className="flex items-start gap-4">
            <div className="flex-1">
              {isEditable ? (
                <input value={item.name} onChange={(e) => updateItem(index, "name", e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
              ) : (
                <p className="text-white/90 text-sm font-medium">{item.name}</p>
              )}
              {(item.latinName || item.categoryName) && (
                <p className="text-white/30 text-xs mt-0.5">
                  {item.categoryName && <span>{item.categoryName}</span>}
                  {item.categoryName && item.latinName && <span> · </span>}
                  {item.latinName && <span className="italic">{item.latinName}</span>}
                </p>
              )}
            </div>
            <div className="w-28">
              {isEditable ? (
                <input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, "unitPrice", e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#0984E3]/50" />
              ) : (
                <p className="text-white/60 text-sm tabular-nums">{formatPrice(Number(item.unitPrice))}</p>
              )}
            </div>
            <div className="w-16 text-center">
              {isEditable ? (
                <input type="number" step="0.1" min="0" value={item.surcharge || ""} onChange={(e) => updateItem(index, "surcharge", e.target.value)} placeholder="0" className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-amber-400/70 text-xs text-center tabular-nums focus:outline-none focus:border-amber-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
              ) : Number(item.surcharge) > 0 ? (
                <span className="text-amber-400/70 text-xs tabular-nums">{Number(item.surcharge)}%</span>
              ) : (
                <span className="text-white/20 text-xs">—</span>
              )}
            </div>
            <div className="w-20">
              {isEditable ? (
                <input type="number" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50" />
              ) : (
                <p className="text-white/60 text-sm text-center">{item.quantity}</p>
              )}
            </div>
            <div className="w-28 text-right"><p className="text-[#0984E3] text-sm font-semibold tabular-nums">{formatPrice((item.quantity * Number(item.unitPrice)) * (1 + (Number(item.surcharge) || 0) / 100))}</p></div>
            {isEditable && (
              <div className="w-16 text-right">
                <button onClick={() => removeItem(index)} className="text-red-400/60 hover:text-red-400 text-xs transition-colors">Remove</button>
              </div>
            )}
            </div>
            {item.substituteName && (
              <p className="text-amber-400/60 text-[11px] mt-1 ml-1">Substitute: {item.substituteName}</p>
            )}
          </div>
        ))}

        {isEditable && (
          <div className="min-w-[500px] px-4 md:px-6 py-3 flex items-start gap-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex-1">
              <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Custom item name" className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50" />
            </div>
            <div className="w-28">
              <input type="number" step="0.01" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Price" className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50" />
            </div>
            <div className="w-16">
              <span className="text-white/20 text-xs flex items-center justify-center h-[30px]">—</span>
            </div>
            <div className="w-20">
              <input type="number" value={newItemQty} onChange={(e) => setNewItemQty(e.target.value)} className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-[#0984E3]/50" />
            </div>
            <div className="w-28"></div>
            <div className="w-16">
              <button onClick={addCustomItem} disabled={!newItemName || !newItemPrice} className="px-3 py-1.5 bg-[#0984E3]/20 text-[#0984E3] text-xs font-medium rounded-lg hover:bg-[#0984E3]/30 disabled:opacity-30 transition-all">Add</button>
            </div>
          </div>
        )}
        </div>

        <div className="p-4 md:p-6 space-y-2">
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>{isEditable ? "Freight Charge" : "Freight"}</span>
            {isEditable ? (
              <input
                type="number"
                step="0.01"
                value={freightCharge}
                onChange={(e) => setFreightCharge(e.target.value)}
                placeholder="0.00"
                className="w-28 px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-right focus:outline-none focus:border-[#0984E3]/50 tabular-nums"
              />
            ) : (
              <span className="tabular-nums">{formatPrice(freight)}</span>
            )}
          </div>
          <div className="flex items-center justify-between text-white/60 text-sm">
            {isEditable ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={includeShipping} onChange={(e) => setIncludeShipping(e.target.checked)} className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer" />
                Shipping (£30.00)
              </label>
            ) : (
              <span>Shipping</span>
            )}
            <span className="tabular-nums">{formatPrice(shipping)}</span>
          </div>
          <div className="flex items-center justify-between text-white/60 text-sm">
            <span>VAT (20%)</span>
            <span className="tabular-nums">{formatPrice(vat)}</span>
          </div>
          {credit > 0 && (
            <div className="flex items-center justify-between text-emerald-400 text-sm">
              <span>Account Credit</span>
              <span className="tabular-nums">-{formatPrice(credit)}</span>
            </div>
          )}
          <div className="h-px bg-white/10" />
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold">Grand Total</span>
            <span className="text-[#0984E3] font-bold text-lg tabular-nums">{formatPrice(total)}</span>
          </div>
        </div>
      </div>

      {(isEditable || order.maxBoxes != null || order.minBoxes != null) && (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6 mb-6">
          <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Box Limits</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white/40 text-xs mb-1 block">Min Boxes</label>
              {isEditable ? (
                <input
                  type="number"
                  min="0"
                  value={minBoxes}
                  onChange={(e) => setMinBoxes(e.target.value)}
                  placeholder="No min"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50"
                />
              ) : (
                <p className="text-white/70 text-sm">{order.minBoxes != null ? order.minBoxes : "—"}</p>
              )}
            </div>
            <div>
              <label className="text-white/40 text-xs mb-1 block">Max Boxes</label>
              {isEditable ? (
                <input
                  type="number"
                  min="0"
                  value={maxBoxes}
                  onChange={(e) => setMaxBoxes(e.target.value)}
                  placeholder="No max"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50"
                />
              ) : (
                <p className="text-white/70 text-sm">{order.maxBoxes != null ? order.maxBoxes : "—"}</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6 mb-6">
        <p className="text-white/50 text-xs uppercase tracking-wider font-medium mb-3">Invoice Note</p>
        {isEditable ? (
          <textarea
            value={adminNotes}
            onChange={(e) => setAdminNotes(e.target.value)}
            placeholder="Add a note to this invoice (visible to customer)..."
            rows={3}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 resize-none"
          />
        ) : adminNotes ? (
          <p className="text-white/70 text-sm whitespace-pre-wrap">{adminNotes}</p>
        ) : (
          <p className="text-white/20 text-sm">No notes</p>
        )}
      </div>

      {isEditable && hasChanges && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving} className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 text-white font-medium rounded-xl transition-all">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
