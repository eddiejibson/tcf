"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ShipmentEmailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [shipmentData, setShipmentData] = useState<{
    shipmentName: string;
    deadline: string;
    productCount: number;
    featuredProducts: { name: string; price: number }[];
    recipientCount: number;
  } | null>(null);

  const [type, setType] = useState<"announcement" | "deadline_reminder">("announcement");
  const [subject, setSubject] = useState("");
  const [intro, setIntro] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number } | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testEmails, setTestEmails] = useState("");

  const [confirmStep, setConfirmStep] = useState(0); // 0=hidden, 1=first confirm, 2=final confirm
  const [confirmText, setConfirmText] = useState("");

  // Image gallery
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [waCopied, setWaCopied] = useState(false);

  const fetchData = useCallback(async () => {
    const res = await fetch(`/api/admin/shipments/${params.id}/email`);
    if (res.ok) setShipmentData(await res.json());
    setLoading(false);
  }, [params.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    setIntro(type === "announcement"
      ? "Hi guys,\n\nWe've got a new shipment landing soon with some great stock 🐠 head over to the portal via the button below to check it out and get your orders in before the deadline.\n\nAny problems let me know via WhatsApp.\n\nCheers!\nGav"
      : "Hi guys,\n\nJust a quick heads up. The deadline for this shipment is coming up fast ⏰ so make sure you've got your orders in if you haven't already.\n\nAny problems let me know via WhatsApp.\n\nCheers!\nGav");
    setSubject("");
    setPreviewHtml("");
    setSendResult(null);
    setConfirmStep(0);
  }, [type]);

  // Auto-preview with debounce
  useEffect(() => {
    if (!shipmentData) return;
    setPreviewLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/shipments/${params.id}/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, subject: subject || undefined, intro, preview: true, imageUrls }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewHtml(data.html);
          if (!subject) setSubject(data.subject);
        }
      } catch { /* ignore */ }
      setPreviewLoading(false);
    }, 800);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, subject, intro, imageUrls, shipmentData, params.id]);

  const handleSend = async () => {
    setSending(true);
    setSendResult(null);
    setConfirmStep(0);

    const emails = testMode ? testEmails.split(",").map((e) => e.trim()).filter(Boolean) : undefined;

    const res = await fetch(`/api/admin/shipments/${params.id}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, subject: subject || undefined, intro, testEmails: emails, imageUrls }),
    });

    if (res.ok) setSendResult(await res.json());
    setSending(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      try {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        let url: string;

        if (isLocalhost) {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload/signed-url", { method: "POST", body: fd });
          const data = await res.json();
          url = data.downloadUrl;
        } else {
          const res = await fetch("/api/upload/signed-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contentType: file.type, filename: file.name, purpose: "email" }),
          });
          const data = await res.json();
          await fetch(data.url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
          url = data.downloadUrl;
        }

        setImageUrls((prev) => [...prev, url]);
      } catch {
        // Skip failed uploads
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>;
  if (!shipmentData) return <div className="p-8 text-white/40">Shipment not found</div>;

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push(`/admin/shipments/${params.id}`)} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to {shipmentData.shipmentName}
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Send Notification</h1>
        <p className="text-white/50 text-sm mt-1">{shipmentData.shipmentName} · {shipmentData.recipientCount} recipients</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: Compose */}
        <div className="space-y-5">
          {/* Email type */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-3">Email Type</p>
            <div className="flex gap-2">
              <button onClick={() => setType("announcement")} className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${type === "announcement" ? "bg-[#0984E3]/20 text-[#0984E3] border border-[#0984E3]/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>
                <div className="flex items-center gap-2 justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" /></svg>
                  Announcement
                </div>
              </button>
              <button onClick={() => setType("deadline_reminder")} className={`flex-1 px-4 py-3 rounded-xl text-sm font-medium transition-all ${type === "deadline_reminder" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10"}`}>
                <div className="flex items-center gap-2 justify-center">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Deadline Reminder
                </div>
              </button>
            </div>
          </div>

          {/* Gallery images */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-3">Gallery Images</p>
            {imageUrls.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {imageUrls.map((url, i) => (
                  <div key={i} className="relative group">
                    <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg border border-white/10" />
                    <button onClick={() => setImageUrls((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50">
              {uploading ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>}
              {uploading ? "Uploading..." : "Add Images"}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
            <p className="text-white/20 text-[10px] mt-2">Up to 3 images shown in email. Displayed above the headline.</p>
          </div>

          {/* Content */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-3">Content</p>
            <div className="space-y-4">
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Subject Line</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={type === "announcement" ? `New Shipment: ${shipmentData.shipmentName}` : `Order Deadline: ${shipmentData.shipmentName}`} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
              </div>
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Intro Message</label>
                <textarea value={intro} onChange={(e) => setIntro(e.target.value)} rows={3} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50 resize-none" />
              </div>
            </div>
          </div>

          {/* Top picks info */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Top Picks ({shipmentData.featuredProducts.length})</p>
              <button onClick={() => router.push(`/admin/shipments/${params.id}`)} className="text-[#0984E3] text-xs font-medium hover:text-[#0984E3]/80 transition-colors">Manage</button>
            </div>
            {shipmentData.featuredProducts.length === 0 ? (
              <p className="text-white/30 text-sm">No products featured. Go to the shipment to bookmark top picks.</p>
            ) : (
              <div className="space-y-1.5">
                {shipmentData.featuredProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-white/70 text-sm">{p.name}</span>
                    <span className="text-[#0984E3] text-sm font-medium tabular-nums">£{Number(p.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Send controls */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-3">Send</p>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} className="w-4 h-4 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer" />
              <span className="text-white/60 text-sm">Send test email only</span>
            </label>
            {testMode && (
              <div className="mb-4">
                <input value={testEmails} onChange={(e) => setTestEmails(e.target.value)} placeholder="email@example.com, another@example.com" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
              </div>
            )}
            <button
              onClick={() => testMode ? handleSend() : setConfirmStep(1)}
              disabled={sending || (testMode && !testEmails.trim())}
              className={`w-full py-3 font-medium rounded-xl transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50 ${testMode ? "bg-white/10 text-white hover:bg-white/15" : "bg-[#0984E3] text-white hover:bg-[#0984E3]/90"}`}
            >
              {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>}
              {sending ? "Sending..." : testMode ? "Send Test Email" : `Send to All (${shipmentData.recipientCount})`}
            </button>
            {sendResult && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${sendResult.failed === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                Sent: {sendResult.sent}{sendResult.failed > 0 ? `, Failed: ${sendResult.failed}` : ""}
              </div>
            )}
          </div>

          {/* WhatsApp message */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">WhatsApp Broadcast</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (!shipmentData) return;
                const baseUrl = window.location.origin;
                const link = `${baseUrl}/login?to=/shipments/${params.id}`;
                const picks = shipmentData.featuredProducts;

                let msg = intro + "\n\n";
                msg += `📋 *${shipmentData.shipmentName}*\n`;
                msg += `📅 Deadline: ${shipmentData.deadline}\n`;
                msg += `📦 ${shipmentData.productCount} products\n`;

                if (picks.length > 0) {
                  msg += "\n⭐ *Top Picks*\n";
                  picks.forEach((p) => {
                    msg += `  • ${p.name} — £${Number(p.price).toFixed(2)}\n`;
                  });
                }

                msg += `\n👉 *Order here:* ${link}`;

                navigator.clipboard.writeText(msg);
                setWaCopied(true);
                setTimeout(() => setWaCopied(false), 2500);
              }}
              className={`w-full py-3 font-medium rounded-xl transition-all text-sm flex items-center justify-center gap-2 ${
                waCopied
                  ? "bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30"
                  : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              {waCopied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  Copied to clipboard!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-[#25D366]" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Copy WhatsApp Message
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/10 bg-white/[0.02]">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-medium">Email Preview</p>
          </div>
          {previewHtml ? (
            <div className="relative">
              {previewLoading && <div className="absolute top-3 right-3 w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin z-10" />}
              <iframe srcDoc={previewHtml} className="w-full border-0" style={{ minHeight: 700 }} sandbox="allow-same-origin" />
            </div>
          ) : (
            <div className="flex items-center justify-center py-32">
              {previewLoading ? <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <span className="text-white/20 text-sm">Preview will appear here</span>}
            </div>
          )}
        </div>
      </div>

      {/* Double-confirm modal — Step 1 */}
      {confirmStep === 1 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmStep(0)}>
          <div className="bg-[#1a1f26] border border-white/10 rounded-[20px] p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
            </div>
            <h3 className="text-white font-semibold text-lg text-center mb-2">Send to all customers?</h3>
            <p className="text-white/50 text-sm text-center mb-6">This will send the email to <strong className="text-white">{shipmentData.recipientCount}</strong> trade customers. This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmStep(0)} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 font-medium rounded-xl text-sm hover:bg-white/10 transition-all">Cancel</button>
              <button onClick={() => setConfirmStep(2)} className="flex-1 py-2.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 font-medium rounded-xl text-sm hover:bg-amber-500/30 transition-all">Yes, Continue</button>
            </div>
          </div>
        </div>
      )}

      {/* Double-confirm modal — Step 2: Type SEND */}
      {confirmStep === 2 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setConfirmStep(0)}>
          <div className="bg-[#1a1f26] border border-red-500/20 rounded-[20px] p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
            </div>
            <h3 className="text-white font-semibold text-lg text-center mb-2">Final Confirmation</h3>
            <p className="text-white/50 text-sm text-center mb-4">Type <strong className="text-red-400">SEND</strong> below to confirm sending to {shipmentData.recipientCount} recipients.</p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type SEND"
              className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm text-center placeholder-white/20 focus:outline-none focus:border-red-500/50 mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button onClick={() => { setConfirmStep(0); setConfirmText(""); }} className="flex-1 py-2.5 bg-white/5 border border-white/10 text-white/60 font-medium rounded-xl text-sm hover:bg-white/10 transition-all">Cancel</button>
              <button onClick={() => { setConfirmText(""); handleSend(); }} disabled={confirmText !== "SEND"} className="flex-1 py-2.5 bg-red-500 text-white font-medium rounded-xl text-sm hover:bg-red-500/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all">Send Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
