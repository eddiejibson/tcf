"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GradientBorder from "@/app/components/GradientBorder";

interface UploadedFile {
  key: string;
  name: string;
}

interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
}

const emptyAddress: AddressFields = {
  line1: "",
  line2: "",
  city: "",
  county: "",
  postcode: "",
  country: "United Kingdom",
};

const steps = [
  { number: 1, label: "Company" },
  { number: 2, label: "Contact" },
  { number: 3, label: "Addresses" },
  { number: 4, label: "Verification" },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export default function ApplyPage() {
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Step 1 - Company
  const [companyName, setCompanyName] = useState("");
  const [companyNumber, setCompanyNumber] = useState("");

  // Step 2 - Contact
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [accountsName, setAccountsName] = useState("");
  const [accountsEmail, setAccountsEmail] = useState("");

  // Step 3 - Addresses
  const [billingAddress, setBillingAddress] = useState<AddressFields>({ ...emptyAddress });
  const [shippingAddress, setShippingAddress] = useState<AddressFields>({ ...emptyAddress });
  const [sameAsBilling, setSameAsBilling] = useState(false);

  // Step 4 - Verification
  const [licenseFile, setLicenseFile] = useState<UploadedFile | null>(null);
  const [licenseUploading, setLicenseUploading] = useState(false);
  const [shopPhotos, setShopPhotos] = useState<UploadedFile[]>([]);
  const [photosUploading, setPhotosUploading] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState("");

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

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(s + 1, 4));
    setError("");
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
    setError("");
  }, []);

  const canProceed = () => {
    switch (step) {
      case 1:
        return companyName.trim().length > 0;
      case 2:
        return contactName.trim().length > 0 && contactEmail.trim().length > 0;
      case 3:
        return (
          billingAddress.line1.trim() &&
          billingAddress.city.trim() &&
          billingAddress.postcode.trim() &&
          (sameAsBilling || (
            shippingAddress.line1.trim() &&
            shippingAddress.city.trim() &&
            shippingAddress.postcode.trim()
          ))
        );
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    const finalShipping = sameAsBilling ? { ...billingAddress } : { ...shippingAddress };

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim(),
          companyNumber: companyNumber.trim() || undefined,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          phone: phone.trim() || undefined,
          accountsName: accountsName.trim() || undefined,
          accountsEmail: accountsEmail.trim() || undefined,
          additionalInfo: additionalInfo.trim() || undefined,
          licenseFileKey: licenseFile?.key || undefined,
          shopPhotoKeys: shopPhotos.map((p) => p.key),
          billingAddress: {
            line1: billingAddress.line1.trim(),
            line2: billingAddress.line2.trim() || undefined,
            city: billingAddress.city.trim(),
            county: billingAddress.county.trim() || undefined,
            postcode: billingAddress.postcode.trim(),
            country: billingAddress.country.trim(),
          },
          shippingAddress: {
            line1: finalShipping.line1.trim(),
            line2: finalShipping.line2.trim() || undefined,
            city: finalShipping.city.trim(),
            county: finalShipping.county.trim() || undefined,
            postcode: finalShipping.postcode.trim(),
            country: finalShipping.country.trim(),
          },
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

  const inputClasses =
    "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all";
  const labelClasses = "text-white/50 text-xs uppercase tracking-wider font-medium block mb-2";

  const updateBilling = (field: keyof AddressFields, value: string) => {
    setBillingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const updateShipping = (field: keyof AddressFields, value: string) => {
    setShippingAddress((prev) => ({ ...prev, [field]: value }));
  };

  const anyUploading = licenseUploading || photosUploading;

  const renderAddressFields = (
    address: AddressFields,
    update: (field: keyof AddressFields, value: string) => void,
  ) => (
    <div className="space-y-3">
      <div>
        <label className={labelClasses}>Address Line 1 *</label>
        <input
          type="text"
          value={address.line1}
          onChange={(e) => update("line1", e.target.value)}
          className={inputClasses}
          placeholder="Street address"
        />
      </div>
      <div>
        <label className={labelClasses}>Address Line 2</label>
        <input
          type="text"
          value={address.line2}
          onChange={(e) => update("line2", e.target.value)}
          className={inputClasses}
          placeholder="Flat, suite, unit (optional)"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses}>City *</label>
          <input
            type="text"
            value={address.city}
            onChange={(e) => update("city", e.target.value)}
            className={inputClasses}
            placeholder="City"
          />
        </div>
        <div>
          <label className={labelClasses}>County</label>
          <input
            type="text"
            value={address.county}
            onChange={(e) => update("county", e.target.value)}
            className={inputClasses}
            placeholder="County (optional)"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClasses}>Postcode *</label>
          <input
            type="text"
            value={address.postcode}
            onChange={(e) => update("postcode", e.target.value)}
            className={inputClasses}
            placeholder="Postcode"
          />
        </div>
        <div>
          <label className={labelClasses}>Country</label>
          <input
            type="text"
            value={address.country}
            onChange={(e) => update("country", e.target.value)}
            className={inputClasses}
            placeholder="Country"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#151b23]">
      <header className="px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src="/images/logo.png"
            alt="The Coral Farm"
            width={40}
            height={60}
            className="transition-transform duration-300 group-hover:scale-105"
          />
          <span className="text-white font-extrabold tracking-wider hidden sm:block">
            THE CORAL FARM
          </span>
        </Link>
        <Link
          href="/login"
          className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium"
        >
          Sign In
        </Link>
      </header>

      <main className="px-6 md:px-[100px] lg:px-[140px] py-8 md:py-12">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
                className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-12 text-center"
              >
                {/* Animated check circle */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, duration: 0.6, type: "spring", stiffness: 200 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center"
                >
                  <motion.svg
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="w-10 h-10 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <motion.path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.6, duration: 0.4 }}
                    />
                  </motion.svg>
                </motion.div>

                {/* Celebration dots */}
                <div className="relative">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        background: ["#0984E3", "#00b894", "#fdcb6e", "#e17055", "#6c5ce7", "#00cec9"][i % 6],
                        left: "50%",
                        top: "-40px",
                      }}
                      initial={{ opacity: 0, x: 0, y: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        x: Math.cos((i * 30 * Math.PI) / 180) * (80 + Math.random() * 40),
                        y: Math.sin((i * 30 * Math.PI) / 180) * (80 + Math.random() * 40) - 20,
                      }}
                      transition={{ delay: 0.3 + i * 0.05, duration: 1, ease: "easeOut" }}
                    />
                  ))}
                </div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-2xl md:text-3xl font-bold text-white mb-2"
                >
                  Welcome to the Coral Family
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-white/50 mb-8 max-w-md mx-auto"
                >
                  Your application has been submitted successfully. We&apos;ll review it and get back to you within 1-2 business days. Keep an eye on your inbox!
                </motion.p>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                >
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-[#0984E3] hover:text-[#0984E3]/80 text-sm font-medium transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Back to Home
                  </Link>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {/* Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0984E3]/10 flex items-center justify-center overflow-hidden">
                    <Image
                      src="/images/logo.png"
                      alt="The Coral Farm"
                      width={28}
                      height={42}
                      className="object-contain"
                    />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                    Apply for a Trade Account
                  </h1>
                  <p className="text-white/50">
                    Join the family in a few simple steps.
                  </p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-between mb-8 px-2">
                  {steps.map((s, i) => (
                    <div key={s.number} className="flex items-center flex-1">
                      <div className="flex flex-col items-center">
                        <motion.div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300 ${
                            step > s.number
                              ? "bg-green-500 text-white"
                              : step === s.number
                              ? "bg-[#0984E3] text-white"
                              : "bg-white/10 text-white/40"
                          }`}
                          animate={{
                            scale: step === s.number ? 1.1 : 1,
                          }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          {step > s.number ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            s.number
                          )}
                        </motion.div>
                        <span
                          className={`text-xs mt-2 font-medium transition-colors duration-300 hidden sm:block ${
                            step >= s.number ? "text-white/70" : "text-white/30"
                          }`}
                        >
                          {s.label}
                        </span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className="flex-1 mx-3 h-[2px] bg-white/10 rounded-full overflow-hidden self-start mt-5">
                          <motion.div
                            className="h-full bg-[#0984E3] rounded-full"
                            initial={false}
                            animate={{ width: step > s.number ? "100%" : "0%" }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Form Card */}
                <GradientBorder rounded="rounded-[24px]">
                <div className="bg-white/5 backdrop-blur-xl rounded-[24px] p-6 md:p-10 overflow-hidden">
                  <AnimatePresence mode="wait" custom={direction}>
                    {/* Step 1: Company Details */}
                    {step === 1 && (
                      <motion.div
                        key="step1"
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                        className="space-y-5"
                      >
                        <div>
                          <h2 className="text-lg font-semibold text-white mb-1">Company Details</h2>
                          <p className="text-white/40 text-sm">Tell us about your business.</p>
                        </div>

                        <div>
                          <label className={labelClasses}>Company Name *</label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className={inputClasses}
                            placeholder="Your company name"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className={labelClasses}>Company Number</label>
                          <input
                            type="text"
                            value={companyNumber}
                            onChange={(e) => setCompanyNumber(e.target.value)}
                            className={inputClasses}
                            placeholder="Companies House number (optional)"
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Contact Details */}
                    {step === 2 && (
                      <motion.div
                        key="step2"
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                        className="space-y-5"
                      >
                        <div>
                          <h2 className="text-lg font-semibold text-white mb-1">Contact Details</h2>
                          <p className="text-white/40 text-sm">How can we reach you?</p>
                        </div>

                        <div>
                          <label className={labelClasses}>Contact Name *</label>
                          <input
                            type="text"
                            value={contactName}
                            onChange={(e) => setContactName(e.target.value)}
                            className={inputClasses}
                            placeholder="Your full name"
                            autoFocus
                          />
                        </div>

                        <div>
                          <label className={labelClasses}>Email Address *</label>
                          <input
                            type="email"
                            value={contactEmail}
                            onChange={(e) => setContactEmail(e.target.value)}
                            className={inputClasses}
                            placeholder="you@company.com"
                          />
                        </div>

                        <div>
                          <label className={labelClasses}>Phone Number</label>
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className={inputClasses}
                            placeholder="Phone number (optional)"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-white/50 text-xs uppercase tracking-wider font-medium">
                              Accounts Name
                            </label>
                            {contactName && (
                              <button
                                type="button"
                                onClick={() => setAccountsName(contactName)}
                                className="text-[#0984E3] text-xs hover:text-[#0984E3]/80 transition-colors"
                              >
                                Same as contact name
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={accountsName}
                            onChange={(e) => setAccountsName(e.target.value)}
                            className={inputClasses}
                            placeholder="Accounts contact name (optional)"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-white/50 text-xs uppercase tracking-wider font-medium">
                              Accounts Email
                            </label>
                            {contactEmail && (
                              <button
                                type="button"
                                onClick={() => setAccountsEmail(contactEmail)}
                                className="text-[#0984E3] text-xs hover:text-[#0984E3]/80 transition-colors"
                              >
                                Same as email
                              </button>
                            )}
                          </div>
                          <input
                            type="email"
                            value={accountsEmail}
                            onChange={(e) => setAccountsEmail(e.target.value)}
                            className={inputClasses}
                            placeholder="Accounts email address (optional)"
                          />
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Addresses */}
                    {step === 3 && (
                      <motion.div
                        key="step3"
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                        className="space-y-6"
                      >
                        <div>
                          <h2 className="text-lg font-semibold text-white mb-1">Addresses</h2>
                          <p className="text-white/40 text-sm">Your billing and shipping addresses.</p>
                        </div>

                        <div>
                          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider mb-3">
                            Billing Address
                          </h3>
                          {renderAddressFields(billingAddress, updateBilling)}
                        </div>

                        <div className="h-px bg-white/5" />

                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                              Shipping Address
                            </h3>
                            <button
                              type="button"
                              onClick={() => setSameAsBilling(!sameAsBilling)}
                              className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors"
                            >
                              <div
                                className={`w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center ${
                                  sameAsBilling
                                    ? "bg-[#0984E3] border-[#0984E3]"
                                    : "border-white/20 bg-transparent"
                                }`}
                              >
                                {sameAsBilling && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              Same as billing
                            </button>
                          </div>

                          <AnimatePresence>
                            {!sameAsBilling && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                {renderAddressFields(shippingAddress, updateShipping)}
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {sameAsBilling && (
                            <p className="text-white/30 text-sm italic">
                              Shipping address will be the same as billing address.
                            </p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {/* Step 4: Verification */}
                    {step === 4 && (
                      <motion.div
                        key="step4"
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
                        className="space-y-5"
                      >
                        <div>
                          <h2 className="text-lg font-semibold text-white mb-1">Verification</h2>
                          <p className="text-white/40 text-sm">Upload your documents and submit.</p>
                        </div>

                        <div>
                          <label className={labelClasses}>Pet Shop License</label>
                          <div
                            onClick={() => !licenseUploading && licenseInputRef.current?.click()}
                            className="w-full px-4 py-4 bg-white/5 border border-white/10 border-dashed rounded-xl cursor-pointer hover:border-[#0984E3]/50 transition-all text-sm"
                          >
                            {licenseUploading ? (
                              <span className="flex items-center gap-2 text-white/50">
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Uploading...
                              </span>
                            ) : licenseFile ? (
                              <span className="flex items-center gap-2 text-green-400/80">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                                {licenseFile.name}
                              </span>
                            ) : (
                              <span className="flex flex-col items-center gap-1 py-2 text-white/30">
                                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                                </svg>
                                Click to upload license (PDF or image)
                              </span>
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
                          <label className={labelClasses}>Shop Photos</label>
                          <div
                            onClick={() => !photosUploading && photosInputRef.current?.click()}
                            className="w-full px-4 py-4 bg-white/5 border border-white/10 border-dashed rounded-xl cursor-pointer hover:border-[#0984E3]/50 transition-all text-sm"
                          >
                            {photosUploading ? (
                              <span className="flex items-center gap-2 text-white/50">
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Uploading...
                              </span>
                            ) : shopPhotos.length > 0 ? (
                              <span className="text-green-400/80">
                                {shopPhotos.length} photo{shopPhotos.length !== 1 ? "s" : ""} uploaded
                                &mdash; click to add more
                              </span>
                            ) : (
                              <span className="flex flex-col items-center gap-1 py-2 text-white/30">
                                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                                </svg>
                                Click to upload shop photos (optional)
                              </span>
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
                                <span
                                  key={i}
                                  className="flex items-center gap-1 text-white/40 text-xs bg-white/5 px-2 py-1 rounded-lg"
                                >
                                  {f.name}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShopPhotos((prev) => prev.filter((_, j) => j !== i));
                                    }}
                                    className="text-white/30 hover:text-red-400 transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className={labelClasses}>Additional Information</label>
                          <textarea
                            value={additionalInfo}
                            onChange={(e) => setAdditionalInfo(e.target.value)}
                            className={`${inputClasses} resize-none`}
                            rows={3}
                            placeholder="Tell us about your business (optional)"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl"
                      >
                        <p className="text-red-400 text-sm text-center">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between mt-8">
                    <div>
                      {step > 1 && (
                        <button
                          type="button"
                          onClick={goBack}
                          className="flex items-center gap-2 px-5 py-2.5 text-white/60 hover:text-white transition-colors text-sm font-medium rounded-xl hover:bg-white/5"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                          </svg>
                          Back
                        </button>
                      )}
                    </div>

                    <div>
                      {step < 4 ? (
                        <button
                          type="button"
                          onClick={goNext}
                          disabled={!canProceed()}
                          className="flex items-center gap-2 px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-all duration-200"
                        >
                          Next
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={loading || anyUploading}
                          className="flex items-center gap-2 px-6 py-2.5 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl transition-all duration-200"
                        >
                          {loading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              Submit Application
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                </GradientBorder>
                {/* Footer link */}
                <p className="text-center text-white/30 text-sm mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-[#0984E3] hover:text-[#0984E3]/80 transition-colors">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
