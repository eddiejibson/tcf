"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
}

const emptyAddress: AddressFields = { line1: "", line2: "", city: "", county: "", postcode: "", country: "United Kingdom" };

function AddressForm({ label, value, onChange }: { label: string; value: AddressFields; onChange: (a: AddressFields) => void }) {
  const set = (field: keyof AddressFields, v: string) => onChange({ ...value, [field]: v });
  return (
    <div>
      <p className="text-[#0984E3] text-[10px] uppercase tracking-wider font-medium mb-2">{label}</p>
      <div className="space-y-2">
        <input value={value.line1} onChange={(e) => set("line1", e.target.value)} placeholder="Address line 1" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
        <input value={value.line2} onChange={(e) => set("line2", e.target.value)} placeholder="Address line 2" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
        <div className="grid grid-cols-2 gap-2">
          <input value={value.city} onChange={(e) => set("city", e.target.value)} placeholder="City" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
          <input value={value.county} onChange={(e) => set("county", e.target.value)} placeholder="County" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input value={value.postcode} onChange={(e) => set("postcode", e.target.value)} placeholder="Postcode" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
          <input value={value.country} onChange={(e) => set("country", e.target.value)} placeholder="Country" className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" />
        </div>
      </div>
    </div>
  );
}

export default function NewCompanyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") || "";
  const linkUserIds = searchParams.getAll("userId");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Company
  const [companyName, setCompanyName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");

  // Primary contact
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState(prefillEmail);
  const [phone, setPhone] = useState("");

  // Accounts contact
  const [accountsName, setAccountsName] = useState("");
  const [accountsEmail, setAccountsEmail] = useState("");

  // Addresses
  const [billingAddress, setBillingAddress] = useState<AddressFields>({ ...emptyAddress });
  const [shippingAddress, setShippingAddress] = useState<AddressFields>({ ...emptyAddress });
  const [sameAsBilling, setSameAsBilling] = useState(false);

  // Additional users
  const [extraUsers, setExtraUsers] = useState<string[]>([]);

  const addExtraUser = () => setExtraUsers([...extraUsers, ""]);
  const updateExtraUser = (index: number, val: string) => setExtraUsers(extraUsers.map((u, i) => i === index ? val : u));
  const removeExtraUser = (index: number) => setExtraUsers(extraUsers.filter((_, i) => i !== index));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactEmail.trim()) return;
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        companyName: companyName.trim(),
        companyNumber: companyNumber.trim() || undefined,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim(),
        phone: phone.trim() || undefined,
        accountsName: accountsName.trim() || undefined,
        accountsEmail: accountsEmail.trim() || undefined,
        billingAddress: billingAddress.line1.trim() ? billingAddress : undefined,
        shippingAddress: sameAsBilling ? (billingAddress.line1.trim() ? billingAddress : undefined) : (shippingAddress.line1.trim() ? shippingAddress : undefined),
        additionalUsers: extraUsers.filter((e) => e.trim()).map((e) => ({ email: e.trim() })),
        linkUserIds: linkUserIds.length > 0 ? linkUserIds : undefined,
      }),
    });

    if (res.ok) {
      router.push("/admin/users");
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error || "Failed to create company");
    }
    setSaving(false);
  };

  return (
    <div className="p-4 md:p-8">
      <button onClick={() => router.push("/admin/users")} className="text-white/50 hover:text-white text-sm mb-4 md:mb-6 flex items-center gap-1 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        Back to Users
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Add Company</h1>
        <p className="text-white/50 text-sm mt-1">Create a company with users, addresses, and contact details</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        {/* Company Details */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-4">Company Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Company Name *</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="Reef World London" />
            </div>
            <div>
              <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Company Number</label>
              <input value={companyNumber} onChange={(e) => setCompanyNumber(e.target.value)} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="12345678" />
            </div>
            <div>
              <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Phone</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="+44 7123 456789" />
            </div>
          </div>
        </div>

        {/* Users */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-1">Users</h3>
          <p className="text-white/40 text-xs mb-5">These users will be created and linked to the company</p>

          {/* Primary contact */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-[#0984E3]/20 text-[#0984E3] text-[10px] font-medium rounded">OWNER</span>
              <span className="text-white/40 text-xs">Primary contact — full access</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Name</label>
                <input value={contactName} onChange={(e) => setContactName(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="James Carter" />
              </div>
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Email *</label>
                <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="james@reefworld.co.uk" />
              </div>
            </div>
          </div>

          {/* Accounts contact */}
          <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mb-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-medium rounded">ACCOUNTS</span>
              <span className="text-white/40 text-xs">Accounts contact — optional, gets full access</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Name</label>
                <input value={accountsName} onChange={(e) => setAccountsName(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="Sarah Mitchell" />
              </div>
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Email</label>
                <input type="email" value={accountsEmail} onChange={(e) => setAccountsEmail(e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="accounts@reefworld.co.uk" />
              </div>
            </div>
          </div>

          {/* Additional users */}
          {extraUsers.map((email, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 mb-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-white/10 text-white/50 text-[10px] font-medium rounded">MEMBER</span>
                  <span className="text-white/40 text-xs">Team member — full access</span>
                </div>
                <button type="button" onClick={() => removeExtraUser(i)} className="text-red-400/50 hover:text-red-400 text-xs transition-colors">Remove</button>
              </div>
              <div>
                <label className="text-white/40 text-[10px] uppercase tracking-wider font-medium block mb-1.5">Email</label>
                <input type="email" value={email} onChange={(e) => updateExtraUser(i, e.target.value)} className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#0984E3]/50" placeholder="staff@reefworld.co.uk" />
              </div>
            </div>
          ))}

          <button type="button" onClick={addExtraUser} className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/50 hover:text-white text-xs font-medium rounded-lg transition-all flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Another User
          </button>
        </div>

        {/* Addresses */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-4 md:p-6">
          <h3 className="text-white font-semibold mb-1">Addresses</h3>
          <p className="text-white/40 text-xs mb-5">Optional — can be added later</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AddressForm label="Billing Address" value={billingAddress} onChange={setBillingAddress} />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <p className="text-[#0984E3] text-[10px] uppercase tracking-wider font-medium">Shipping Address</p>
                {billingAddress.line1.trim() && (
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="w-3.5 h-3.5 rounded bg-white/5 border-white/20 text-[#0984E3] focus:ring-[#0984E3]/30 focus:ring-offset-0 cursor-pointer" />
                    <span className="text-white/30 text-[10px]">Same as billing</span>
                  </label>
                )}
              </div>
              {sameAsBilling ? (
                <p className="text-white/30 text-sm py-4">Using billing address</p>
              ) : (
                <AddressForm label="" value={shippingAddress} onChange={setShippingAddress} />
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !companyName.trim() || !contactEmail.trim()}
            className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:text-white/30 text-white font-medium rounded-xl transition-all"
          >
            {saving ? "Creating..." : "Create Company"}
          </button>
          <button type="button" onClick={() => router.push("/admin/users")} className="px-4 py-3 text-white/40 hover:text-white text-sm transition-colors">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
