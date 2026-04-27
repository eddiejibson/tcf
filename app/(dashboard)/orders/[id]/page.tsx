"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { UserOrderDetail, DoaClaimDetail } from "@/app/lib/types";
import { useAuth } from "@/app/lib/auth-context";
import { userHasPermission, Permission } from "@/app/lib/permissions";
import { generateInvoice } from "@/app/lib/generate-invoice";
import PaymentSection from "@/app/components/PaymentSection";
import DoaItemPicker, { type DoaPickerOption } from "@/app/components/DoaItemPicker";

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

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [order, setOrder] = useState<UserOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [creditLoading, setCreditLoading] = useState(false);

  const [doaClaim, setDoaClaim] = useState<DoaClaimDetail | null>(null);
  const [showDoaForm, setShowDoaForm] = useState(false);
  type DoaFormGroup = {
    imageKeys: string[];
    previews: string[];
    uploading: boolean;
    items: { orderItemId: string; quantity: number }[];
  };
  const emptyGroup = (): DoaFormGroup => ({
    imageKeys: [],
    previews: [],
    uploading: false,
    items: [{ orderItemId: "", quantity: 0 }],
  });
  const [doaGroups, setDoaGroups] = useState<DoaFormGroup[]>([]);
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
      discountPercent: Number(order.discountPercent) || 0,
    });
  };

  const compressImage = async (file: File): Promise<Blob> => {
    if (file.size <= 2 * 1024 * 1024) return file;
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
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
        canvas.toBlob((blob) => { URL.revokeObjectURL(objectUrl); resolve(blob || file); }, "image/jpeg", 0.8);
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error(`Failed to load image: ${file.name}`)); };
      img.src = objectUrl;
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

  const updateGroup = (index: number, fn: (g: DoaFormGroup) => DoaFormGroup) =>
    setDoaGroups((prev) => prev.map((g, i) => i === index ? fn(g) : g));

  const handleDoaImageUpload = async (groupIndex: number, files: FileList) => {
    updateGroup(groupIndex, (g) => ({ ...g, uploading: true }));
    for (const file of Array.from(files)) {
      try {
        const result = await uploadOneImage(file);
        updateGroup(groupIndex, (g) => ({
          ...g,
          imageKeys: [...g.imageKeys, result.key],
          previews: [...g.previews, result.preview],
        }));
      } catch {
        // Skip failed file, continue with the rest
      }
    }
    updateGroup(groupIndex, (g) => ({ ...g, uploading: false }));
  };

  const handleDoaSubmit = async () => {
    const valid = doaGroups.every((g) =>
      g.imageKeys.length > 0 &&
      g.items.length > 0 &&
      g.items.every((it) => it.orderItemId && it.quantity > 0)
    );
    if (!valid) return;
    setDoaSubmitting(true);
    const res = await fetch(`/api/orders/${params.id}/doa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groups: doaGroups.map((g) => ({
          imageKeys: g.imageKeys,
          items: g.items.map(({ orderItemId, quantity }) => ({ orderItemId, quantity })),
        })),
      }),
    });
    if (res.ok) {
      setShowDoaForm(false);
      setDoaGroups([]);
      await fetchDoaClaim();
    }
    setDoaSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!order) return <div className="p-8 text-white/40">Order not found</div>;

  const boxCount = order.boxCount != null ? Number(order.boxCount) : 0;
  const freightPerBox = order.freightPerBox != null ? Number(order.freightPerBox) : 0;
  const showBoxBreakdown = boxCount > 0 && freightPerBox > 0 && order.totals.freight > 0;

  const canManagePayments = user ? userHasPermission(user, Permission.MANAGE_PAYMENTS) : false;
  const canViewPayments = user ? userHasPermission(user, Permission.VIEW_PAYMENTS) : false;
  const canViewDoa = user ? userHasPermission(user, Permission.VIEW_DOA) : false;
  const canCreateDoa = user ? userHasPermission(user, Permission.CREATE_DOA) : false;

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
          {canViewPayments && ["ACCEPTED", "AWAITING_FULFILLMENT", "AWAITING_PAYMENT", "PAID"].includes(order.status) && (
            <button
              onClick={handleDownloadInvoice}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Invoice
            </button>
          )}
          <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusColors[order.status] || "bg-white/10 text-white/60"}`}>{statusLabels[order.status] || order.status}</span>
        </div>
      </div>

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
              <div className="flex-1">
                <p className="text-white/90 text-sm font-medium">{item.name}</p>
                {(item.latinName || item.categoryName) && (
                  <p className="text-white/30 text-xs mt-0.5">
                    {item.latinName
                      ? <span className="italic">{item.latinName}</span>
                      : <span>{item.categoryName}</span>}
                  </p>
                )}
                {(item.size || item.variant) && (
                  <p className="text-white/40 text-xs mt-0.5">
                    {[item.variant, item.size].filter(Boolean).join(" / ")}
                  </p>
                )}
              </div>
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
            <span className="tabular-nums">{formatPrice(order.totals.grossSubtotal)}</span>
          </div>
          {order.totals.discount > 0 && (
            <>
              <div className="flex items-center justify-between text-green-400 text-sm">
                <span>Discount ({Number(order.discountPercent)}%)</span>
                <span className="tabular-nums">-{formatPrice(order.totals.discount)}</span>
              </div>
              <div className="flex items-center justify-between text-white/60 text-sm">
                <span>Subtotal after discount</span>
                <span className="tabular-nums">{formatPrice(order.totals.subtotal)}</span>
              </div>
            </>
          )}
          {order.totals.freight > 0 && (
            <div className="flex items-center justify-between text-white/60 text-sm">
              <span>Freight{showBoxBreakdown ? ` (${boxCount} × ${formatPrice(freightPerBox)})` : ""}</span>
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

      {canViewPayments && order.useCredit && !Number(order.creditApplied) && order.status !== "ACCEPTED" && order.status !== "PAID" && (
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

      {canManagePayments && order.status === "ACCEPTED" && Number(order.applicableCredit) > 0 && Number(order.creditApplied) === 0 && (
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
              <p className="text-emerald-400/60 text-xs">{formatPrice(Number(order.applicableCredit))} available - will be applied against this order</p>
            </div>
            {creditLoading && <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin ml-auto" />}
          </label>
        </div>
      )}

      {canManagePayments && order.status === "ACCEPTED" && Number(order.creditApplied) > 0 && (
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

      <div className="mt-6">
        <PaymentSection
          orderId={order.id}
          order={order}
          buyer={user ? { email: user.email, country: "GB" } : null}
          apiBasePath={`/api/orders/${order.id}/payment`}
          canManagePayments={canManagePayments}
          canViewPayments={canViewPayments}
          canCancelPayments={true}
          onPaymentChange={fetchOrder}
        />
      </div>

      {(order.status === "PAID" || (order.status === "ACCEPTED" && !!order.shipment)) && (canViewDoa || canCreateDoa) && (
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
                {doaClaim.groups.map((group) => (
                  <div key={group.id} className="bg-white/5 rounded-xl p-3">
                    {group.imageUrls?.length > 0 && (
                      <div className="flex gap-2 mb-3 flex-wrap">
                        {group.imageUrls.map((url: string, i: number) => (
                          <img key={i} src={url} alt="DOA evidence" className="w-20 h-20 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <div key={item.id} className="flex items-center gap-4">
                          <div className="flex-1">
                            <p className="text-white/90 text-sm font-medium">{item.orderItem?.name || "Item"}</p>
                            <p className="text-white/50 text-xs">Qty DOA: {item.quantity}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.approved ? "bg-green-500/20 text-green-400"
                              : item.denied ? "bg-red-500/20 text-red-400"
                              : "bg-white/10 text-white/40"
                          }`}>
                            {item.approved ? "Approved" : item.denied ? "Denied" : "Pending"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : showDoaForm ? (
            <div>
              <p className="text-white/50 text-sm mb-4">Upload a photo of each damaged group, then list the items shown in that photo. One photo can cover multiple items.</p>
              <div className="space-y-4">
                {doaGroups.map((group, gIndex) => (
                  <div key={gIndex} className="bg-white/5 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        {group.previews.length > 0 && (
                          <div className="flex gap-2 mb-2 flex-wrap">
                            {group.previews.map((preview, pi) => (
                              <div key={pi} className="relative">
                                <img src={preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                                <button
                                  onClick={() => updateGroup(gIndex, (g) => ({
                                    ...g,
                                    imageKeys: g.imageKeys.filter((_, ki) => ki !== pi),
                                    previews: g.previews.filter((_, ki) => ki !== pi),
                                  }))}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px]"
                                >x</button>
                              </div>
                            ))}
                          </div>
                        )}
                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 border border-dashed border-white/20 rounded-lg cursor-pointer hover:border-white/40 transition-colors">
                          {group.uploading ? (
                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                          )}
                          <span className="text-white/40 text-xs">{group.uploading ? "Uploading..." : group.previews.length > 0 ? "Add more photos" : "Upload photo(s)"}</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.length) handleDoaImageUpload(gIndex, e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                      {doaGroups.length > 1 && (
                        <button
                          onClick={() => setDoaGroups((prev) => prev.filter((_, i) => i !== gIndex))}
                          className="text-white/30 hover:text-red-400 transition-colors shrink-0"
                          title="Remove group"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="space-y-2">
                      {group.items.map((item, iIndex) => {
                        const options: DoaPickerOption[] = order.items
                          .map((oi) => {
                            const used = doaGroups.reduce((sum, g, gi) => sum + g.items.reduce((s, it, ii) => {
                              if (gi === gIndex && ii === iIndex) return s;
                              return it.orderItemId === oi.id ? s + (it.quantity || 0) : s;
                            }, 0), 0);
                            return { id: oi.id, name: oi.name, remaining: oi.quantity - used, total: oi.quantity };
                          })
                          .filter((o) => o.remaining > 0 || o.id === item.orderItemId);
                        return (
                        <div key={iIndex} className="flex items-center gap-3">
                          <DoaItemPicker
                            options={options}
                            value={item.orderItemId}
                            onChange={(id) => updateGroup(gIndex, (g) => ({
                              ...g,
                              items: g.items.map((it, i) => i === iIndex ? { ...it, orderItemId: id } : it),
                            }))}
                          />
                          <input
                            type="number"
                            min={1}
                            value={item.quantity || ""}
                            onChange={(e) => updateGroup(gIndex, (g) => ({
                              ...g,
                              items: g.items.map((it, i) => i === iIndex ? { ...it, quantity: parseInt(e.target.value) || 0 } : it),
                            }))}
                            placeholder="Qty"
                            className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-white/30"
                          />
                          {group.items.length > 1 && (
                            <button
                              onClick={() => updateGroup(gIndex, (g) => ({ ...g, items: g.items.filter((_, i) => i !== iIndex) }))}
                              className="text-white/30 hover:text-red-400 transition-colors"
                              title="Remove item"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        );
                      })}
                      <button
                        onClick={() => updateGroup(gIndex, (g) => ({ ...g, items: [...g.items, { orderItemId: "", quantity: 0 }] }))}
                        className="text-white/50 hover:text-white text-xs transition-colors"
                      >
                        + Add another item to this photo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-3 mt-4 flex-wrap">
                <button
                  onClick={() => setDoaGroups((prev) => [...prev, emptyGroup()])}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/60 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
                >
                  + Add another photo
                </button>
                <button
                  onClick={handleDoaSubmit}
                  disabled={
                    doaSubmitting ||
                    doaGroups.length === 0 ||
                    doaGroups.some((g) =>
                      g.imageKeys.length === 0 ||
                      g.items.length === 0 ||
                      g.items.some((it) => !it.orderItemId || !it.quantity)
                    )
                  }
                  className="px-4 py-2 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl text-sm transition-all"
                >
                  {doaSubmitting ? "Submitting..." : "Submit DOA Report"}
                </button>
                <button
                  onClick={() => { setShowDoaForm(false); setDoaGroups([]); }}
                  className="px-4 py-2 text-white/40 hover:text-white text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              {canCreateDoa ? (
                <>
                  <p className="text-white/50 text-sm mb-4">Did any items arrive dead? You can report them here with photo evidence.</p>
                  <button
                    onClick={() => {
                      setShowDoaForm(true);
                      setDoaGroups([emptyGroup()]);
                    }}
                    className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/20 text-sm font-medium transition-all"
                  >
                    Report DOA
                  </button>
                </>
              ) : (
                <p className="text-white/50 text-sm">No DOA claims submitted for this order.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
