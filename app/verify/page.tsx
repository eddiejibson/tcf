"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      return;
    }
    const to = searchParams.get("to");
    let verifyUrl = `/api/auth/verify?token=${token}`;
    if (to) {
      verifyUrl += `&to=${encodeURIComponent(to)}`;
    }
    window.location.href = verifyUrl;
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-[#1a1f26] flex items-center justify-center">
      {status === "loading" ? (
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60 text-sm">Verifying your login...</p>
        </div>
      ) : (
        <div className="max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 text-center">
          <p className="text-red-400 mb-4">Invalid or missing token.</p>
          <a href="/login" className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm font-medium">Back to login</a>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#1a1f26] flex items-center justify-center"><div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>}>
      <VerifyContent />
    </Suspense>
  );
}
