"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef } from "react";

interface UploadedFile {
  key: string;
  name: string;
}

export default function ApplyPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accountsName, setAccountsName] = useState("");
  const [accountsEmail, setAccountsEmail] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [licenseFile, setLicenseFile] = useState<UploadedFile | null>(null);
  const [licenseUploading, setLicenseUploading] = useState(false);
  const [shopPhotos, setShopPhotos] = useState<UploadedFile[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);

  const licenseInputRef = useRef<HTMLInputElement>(null);
  const photosInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File): Promise<UploadedFile> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/applications/upload", { method: "POST", body: fd });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  };

  const handleLicenseChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLicenseUploading(true);
    setError("");
    try {
      const uploaded = await uploadFile(file);
      setLicenseFile(uploaded);
    } catch {
      setError("Failed to upload license file. Please try again.");
    }
    setLicenseUploading(false);
  };

  const handlePhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPhotosUploading(true);
    setError("");
    try {
      const uploaded = await Promise.all(files.map(uploadFile));
      setShopPhotos((prev) => [...prev, ...uploaded]);
    } catch {
      setError("Failed to upload some photos. Please try again.");
    }
    setPhotosUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          companyNumber: companyNumber || undefined,
          contactName,
          contactEmail,
          phone: phone || undefined,
          accountsName: accountsName || undefined,
          accountsEmail: accountsEmail || undefined,
          additionalInfo: additionalInfo || undefined,
          licenseFileKey: licenseFile?.key || undefined,
          shopPhotoKeys: shopPhotos.map((p) => p.key),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const anyUploading = licenseUploading || photosUploading;

  return (
    <div className="min-h-screen bg-[#1a1f26]">
      <header className="px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image src="/images/logo.png" alt="The Coral Farm" width={40} height={60} className="transition-transform duration-300 group-hover:scale-105" />
          <span className="text-white font-extrabold tracking-wider hidden sm:block">THE CORAL FARM</span>
        </Link>
        <Link href="/login" className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium">Sign In</Link>
      </header>

      <main className="px-6 md:px-[100px] lg:px-[140px] py-12">
        <div className="max-w-lg mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-12">
          {success ? (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Application Submitted</h1>
              <p className="text-white/50 mb-6">Thank you for your application. We will review it and get back to you shortly.</p>
              <Link href="/login" className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm font-medium transition-colors">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0984E3]/10 flex items-center justify-center overflow-hidden">
                  <Image src="/images/logo.png" alt="The Coral Farm" width={28} height={42} className="object-contain" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Apply for a Trade Account</h1>
                <p className="text-white/50">Fill in your details below and we&apos;ll review your application.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Company Name *</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    placeholder="Your company name"
                    required
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Company Number</label>
                  <input
                    type="text"
                    value={companyNumber}
                    onChange={(e) => setCompanyNumber(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    placeholder="Companies House number (optional)"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Contact Name *</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Email Address *</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    placeholder="you@company.com"
                    required
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    placeholder="Phone number (optional)"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white/50 text-xs uppercase tracking-wider font-medium">Accounts Name</label>
                    {contactName && (
                      <button type="button" onClick={() => setAccountsName(contactName)} className="text-[#0984E3] text-xs hover:text-[#0984E3]/80 transition-colors">Same as contact name</button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={accountsName}
                    onChange={(e) => setAccountsName(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    placeholder="Accounts contact name (optional)"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white/50 text-xs uppercase tracking-wider font-medium">Accounts Email</label>
                    {contactEmail && (
                      <button type="button" onClick={() => setAccountsEmail(contactEmail)} className="text-[#0984E3] text-xs hover:text-[#0984E3]/80 transition-colors">Same as email</button>
                    )}
                  </div>
                  <input
                    type="email"
                    value={accountsEmail}
                    onChange={(e) => setAccountsEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                    placeholder="Accounts email address (optional)"
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Pet Shop License</label>
                  <div
                    onClick={() => !licenseUploading && licenseInputRef.current?.click()}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 border-dashed rounded-xl cursor-pointer hover:border-[#0984E3]/50 transition-all text-sm"
                  >
                    {licenseUploading ? (
                      <span className="flex items-center gap-2 text-white/50">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Uploading...
                      </span>
                    ) : licenseFile ? (
                      <span className="flex items-center gap-2 text-green-400/80">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {licenseFile.name}
                      </span>
                    ) : (
                      <span className="text-white/30">Click to upload license (PDF or image)</span>
                    )}
                  </div>
                  <input
                    ref={licenseInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleLicenseChange}
                  />
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Shop Photos</label>
                  <div
                    onClick={() => !photosUploading && photosInputRef.current?.click()}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 border-dashed rounded-xl cursor-pointer hover:border-[#0984E3]/50 transition-all text-sm"
                  >
                    {photosUploading ? (
                      <span className="flex items-center gap-2 text-white/50">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Uploading...
                      </span>
                    ) : shopPhotos.length > 0 ? (
                      <span className="text-green-400/80">{shopPhotos.length} photo{shopPhotos.length !== 1 ? "s" : ""} uploaded — click to add more</span>
                    ) : (
                      <span className="text-white/30">Click to upload shop photos (optional, multiple)</span>
                    )}
                  </div>
                  <input
                    ref={photosInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    multiple
                    className="hidden"
                    onChange={handlePhotosChange}
                  />
                  {shopPhotos.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {shopPhotos.map((f, i) => (
                        <span key={i} className="flex items-center gap-1 text-white/40 text-xs bg-white/5 px-2 py-1 rounded-lg">
                          {f.name}
                          <button
                            type="button"
                            onClick={() => setShopPhotos((prev) => prev.filter((_, j) => j !== i))}
                            className="text-white/30 hover:text-red-400 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-white/50 text-xs uppercase tracking-wider font-medium block mb-2">Additional Information</label>
                  <textarea
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all resize-none"
                    rows={3}
                    placeholder="Tell us about your business (optional)"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || anyUploading || !companyName || !contactName || !contactEmail}
                  className="w-full py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Submit Application</span>
                  )}
                </button>

                <p className="text-center text-white/30 text-sm">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#0984E3] hover:text-[#0984E3]/80 transition-colors">Sign in</Link>
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
