"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface BuyerContact {
  givenName?: string | null;
  familyName?: string | null;
  email?: string | null;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  addressLines?: string[] | null;
  phone?: string | null;
}

interface SquareCardFormProps {
  orderId: string;
  total: string;
  amount: number; // in major units (£), used for 3DS verifyBuyer
  buyer?: BuyerContact | null;
  onSuccess: () => void;
  onCancel: () => void;
  chargeUrl?: string;
}

interface SquareVerifyBuyerDetails {
  amount: string;
  currencyCode: string;
  intent: "CHARGE" | "STORE";
  customerInitiated: boolean;
  sellerKeyedIn: boolean;
  billingContact: {
    givenName?: string;
    familyName?: string;
    email?: string;
    country?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    addressLines?: string[];
    phone?: string;
  };
}

interface SquarePayments {
  card: (options?: Record<string, unknown>) => Promise<SquareCard>;
  verifyBuyer: (
    sourceId: string,
    details: SquareVerifyBuyerDetails
  ) => Promise<{ token: string }>;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => void;
}

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

export default function SquareCardForm({ orderId, total, amount, buyer, onSuccess, onCancel, chargeUrl }: SquareCardFormProps) {
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const paymentsRef = useRef<SquarePayments | null>(null);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        // Fetch config
        const configRes = await fetch("/api/square/config");
        if (!configRes.ok) throw new Error("Failed to load payment config");
        const config = await configRes.json();

        // Load SDK script
        const scriptUrl = config.environment === "production"
          ? "https://web.squarecdn.com/v1/square.js"
          : "https://sandbox.web.squarecdn.com/v1/square.js";

        if (!document.querySelector(`script[src="${scriptUrl}"]`)) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement("script");
            script.src = scriptUrl;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load payment SDK"));
            document.head.appendChild(script);
          });
        }

        if (!window.Square) throw new Error("Payment SDK not available");

        const payments = await window.Square.payments(config.appId, config.locationId);
        paymentsRef.current = payments;
        const card = await payments.card({
          style: {
            ".input-container": {
              borderColor: "rgba(255,255,255,0.1)",
              borderRadius: "12px",
            },
            ".input-container.is-focus": {
              borderColor: "rgba(9,132,227,0.5)",
            },
            ".input-container.is-error": {
              borderColor: "rgba(239,68,68,0.5)",
            },
            "input": {
              backgroundColor: "transparent",
              color: "#ffffff",
              fontFamily: "inherit",
              fontSize: "14px",
            },
            "input::placeholder": {
              color: "rgba(255,255,255,0.3)",
            },
            ".message-text": {
              color: "rgba(239,68,68,0.8)",
            },
            ".message-icon": {
              color: "rgba(239,68,68,0.8)",
            },
          },
        });

        await card.attach("#square-card-container");
        cardRef.current = card;
        setLoading(false);
        // Force Square SDK to recalculate iframe height
        setTimeout(() => window.dispatchEvent(new Event("resize")), 100);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to initialize payment form");
        setLoading(false);
      }
    }

    init();

    return () => {
      cardRef.current?.destroy();
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!cardRef.current || !paymentsRef.current || processing) return;

    setProcessing(true);
    setError(null);

    try {
      const result = await cardRef.current.tokenize();

      if (result.status !== "OK" || !result.token) {
        setError(result.errors?.[0]?.message || "Card verification failed");
        setProcessing(false);
        return;
      }

      // 3DS / SCA buyer verification (Strong Customer Authentication).
      // Required by Square for many UK/EU cards — the bank may pop a challenge.
      // We must surface any thrown error and pass the resulting token to the
      // server so Square treats the payment as authenticated.
      let verificationToken: string | undefined;
      try {
        const billing = buyer || {};
        const billingContact: SquareVerifyBuyerDetails["billingContact"] = {};
        if (billing.givenName) billingContact.givenName = billing.givenName;
        if (billing.familyName) billingContact.familyName = billing.familyName;
        if (billing.email) billingContact.email = billing.email;
        if (billing.country) billingContact.country = billing.country;
        if (billing.city) billingContact.city = billing.city;
        if (billing.region) billingContact.region = billing.region;
        if (billing.postalCode) billingContact.postalCode = billing.postalCode;
        if (billing.phone) billingContact.phone = billing.phone;
        if (billing.addressLines && billing.addressLines.length) {
          billingContact.addressLines = billing.addressLines;
        }
        const verification = await paymentsRef.current.verifyBuyer(result.token, {
          amount: amount.toFixed(2),
          currencyCode: "GBP",
          intent: "CHARGE",
          customerInitiated: true,
          sellerKeyedIn: false,
          billingContact,
        });
        verificationToken = verification.token;
      } catch (verifyErr) {
        const msg = verifyErr instanceof Error ? verifyErr.message : "Card verification was cancelled or failed";
        setError(msg);
        setProcessing(false);
        return;
      }

      const res = await fetch(chargeUrl || `/api/orders/${orderId}/payment/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: result.token, verificationToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Payment failed");
        setProcessing(false);
        return;
      }

      if (data.status === "PAID") {
        onSuccess();
      } else {
        setError("Payment was not completed. Please try again.");
        setProcessing(false);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      setProcessing(false);
    }
  }, [orderId, processing, onSuccess, amount, buyer, chargeUrl]);

  return (
    <div className="mt-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[20px] p-6">
      <style>{`
        #square-card-container .sq-card-message {
          display: none !important;
        }
        #square-card-container .sq-card-message.sq-visible {
          display: flex !important;
          color: #f87171 !important;
          font-size: 12px !important;
          margin-top: 8px !important;
          padding: 0 !important;
        }
        #square-card-container .sq-card-message-error .sq-card-message-icon {
          color: #f87171 !important;
        }
        #square-card-container .sq-card-message-error .sq-card-message-text {
          color: #f87171 !important;
        }
      `}</style>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-white font-semibold text-lg">Card Payment</h3>
          <p className="text-white/40 text-sm mt-0.5">Pay {total} securely</p>
        </div>
        <button
          onClick={onCancel}
          disabled={processing}
          className="text-white/40 hover:text-white text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Card form container */}
      <div className="mb-5">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}
        <div
          id="square-card-container"
          className={loading ? "hidden" : ""}
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading || processing}
          className="flex-1 py-3 bg-[#0984E3] hover:bg-[#0770c4] disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Pay {total}
            </>
          )}
        </button>
      </div>

      <p className="text-white/20 text-[10px] text-center mt-3">
        Payments processed securely by Square
      </p>
    </div>
  );
}
