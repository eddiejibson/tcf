"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ApplicationDetail } from "@/app/lib/types";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-400",
  APPROVED: "bg-green-500/20 text-green-400",
  REJECTED: "bg-red-500/20 text-red-400",
};

export default function AdminApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/admin/applications/${id}`);
        if (!res.ok) throw new Error();
        setApplication(await res.json());
      } catch {
        setError("Failed to load application");
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const handleAction = async (action: "approve" | "reject", reason?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason: reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Action failed");
        setActionLoading(false);
        return;
      }
      const updated = await res.json();
      setApplication((prev) => prev ? { ...prev, ...updated } : prev);
      setShowRejectModal(false);
    } catch {
      setError("Action failed");
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !application) {
    return (
      <div className="p-4 md:p-8">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] py-16 text-center">
          <p className="text-white/50">{error}</p>
        </div>
      </div>
    );
  }

  if (!application) return null;

  const isPending = application.status === "PENDING";

  return (
    <div className="p-4 md:p-8 max-w-4xl">
      <button
        onClick={() => router.push("/admin/applications")}
        className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm font-medium mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Applications
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">{application.companyName}</h1>
          <p className="text-white/50 text-sm mt-1">Trade account application</p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusColors[application.status] || ""}`}>
          {application.status}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Details */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
          <h2 className="text-white/30 text-[10px] uppercase tracking-wider font-medium mb-4">Application Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-white/40 text-xs mb-1">Company Name</p>
              <p className="text-white text-sm">{application.companyName}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Company Number</p>
              <p className="text-white text-sm">{application.companyNumber || "Not provided"}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Contact Name</p>
              <p className="text-white text-sm">{application.contactName}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Email</p>
              <p className="text-white text-sm">{application.contactEmail}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Phone</p>
              <p className="text-white text-sm">{application.phone || "Not provided"}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Accounts Name</p>
              <p className="text-white text-sm">{application.accountsName || "Not provided"}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Accounts Email</p>
              <p className="text-white text-sm">{application.accountsEmail || "Not provided"}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Submitted</p>
              <p className="text-white text-sm">{new Date(application.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
          {application.additionalInfo && (
            <div className="mt-4 pt-4 border-t border-white/5">
              <p className="text-white/40 text-xs mb-1">Additional Information</p>
              <p className="text-white/70 text-sm whitespace-pre-wrap">{application.additionalInfo}</p>
            </div>
          )}
        </div>

        {/* Addresses */}
        {(application.billingAddress || application.shippingAddress) && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
            <h2 className="text-white/30 text-[10px] uppercase tracking-wider font-medium mb-4">Addresses</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {application.billingAddress && (
                <div>
                  <p className="text-white/40 text-xs mb-2 font-medium uppercase tracking-wider">Billing</p>
                  <div className="text-white/80 text-sm space-y-0.5">
                    <p>{application.billingAddress.line1}</p>
                    {application.billingAddress.line2 && <p>{application.billingAddress.line2}</p>}
                    <p>{application.billingAddress.city}{application.billingAddress.county ? `, ${application.billingAddress.county}` : ""}</p>
                    <p>{application.billingAddress.postcode}</p>
                    <p>{application.billingAddress.country}</p>
                  </div>
                </div>
              )}
              {application.shippingAddress && (
                <div>
                  <p className="text-white/40 text-xs mb-2 font-medium uppercase tracking-wider">Shipping</p>
                  <div className="text-white/80 text-sm space-y-0.5">
                    <p>{application.shippingAddress.line1}</p>
                    {application.shippingAddress.line2 && <p>{application.shippingAddress.line2}</p>}
                    <p>{application.shippingAddress.city}{application.shippingAddress.county ? `, ${application.shippingAddress.county}` : ""}</p>
                    <p>{application.shippingAddress.postcode}</p>
                    <p>{application.shippingAddress.country}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Files */}
        {(application.licenseFileUrl || application.shopPhotoUrls.length > 0) && (
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
            <h2 className="text-white/30 text-[10px] uppercase tracking-wider font-medium mb-4">Uploaded Files</h2>

            {application.licenseFileUrl && (
              <div className="mb-4">
                <p className="text-white/40 text-xs mb-2">Pet Shop License</p>
                <a
                  href={application.licenseFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[#0984E3] text-sm font-medium hover:bg-white/10 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download License
                </a>
              </div>
            )}

            {application.shopPhotoUrls.length > 0 && (
              <div>
                <p className="text-white/40 text-xs mb-2">Shop Photos</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {application.shopPhotoUrls.map((url, i) => (
                    <a
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="aspect-square rounded-xl overflow-hidden border border-white/10 hover:border-[#0984E3]/50 transition-all"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Shop photo ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rejection reason */}
        {application.status === "REJECTED" && application.rejectionReason && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-[20px] p-6">
            <h2 className="text-red-400/60 text-[10px] uppercase tracking-wider font-medium mb-2">Rejection Reason</h2>
            <p className="text-red-400/80 text-sm">{application.rejectionReason}</p>
          </div>
        )}

        {/* Approved user info */}
        {application.status === "APPROVED" && application.userId && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-[20px] p-6">
            <h2 className="text-green-400/60 text-[10px] uppercase tracking-wider font-medium mb-2">Account Created</h2>
            <p className="text-green-400/80 text-sm">User account has been created for {application.contactEmail}.</p>
          </div>
        )}

        {/* Actions */}
        {isPending && (
          <div className="flex gap-3">
            <button
              onClick={() => handleAction("approve")}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
            >
              {actionLoading ? "Processing..." : "Approve"}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="px-6 py-2.5 bg-red-600/80 hover:bg-red-600 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] p-6 w-full max-w-md">
            <h3 className="text-white font-bold text-lg mb-4">Reject Application</h3>
            <p className="text-white/50 text-sm mb-4">Optionally provide a reason for rejecting this application.</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 transition-all resize-none text-sm"
              rows={3}
              placeholder="Reason for rejection (optional)"
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleAction("reject", rejectionReason)}
                disabled={actionLoading}
                className="px-6 py-2.5 bg-red-600/80 hover:bg-red-600 disabled:bg-white/10 text-white text-sm font-medium rounded-xl transition-all"
              >
                {actionLoading ? "Rejecting..." : "Reject"}
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason(""); }}
                className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
