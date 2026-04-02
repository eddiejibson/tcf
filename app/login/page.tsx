"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, Component, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import AuthBackground from "@/app/components/AuthBackground";


class LoginErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#1a1f26] relative">
          <AuthBackground />
          <header className="relative px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/images/logo.png" alt="The Coral Farm" width={40} height={60} />
              <span className="text-white font-extrabold tracking-wider hidden sm:block">THE CORAL FARM</span>
            </Link>
          </header>
          <main className="relative px-6 md:px-[100px] lg:px-[140px] py-12">
            <div className="max-w-md mx-auto bg-black/30 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-12 text-center">
              <p className="text-white/60 mb-4">Something went wrong loading this page.</p>
              <button onClick={() => window.location.reload()} className="px-6 py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 text-white font-medium rounded-xl transition-all">
                Reload Page
              </button>
            </div>
          </main>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const redirectTo = searchParams.get("to") || "";
  const [error, setError] = useState(searchParams.get("error") === "invalid_token" ? "Login link expired or invalid. Please try again." : "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, to: redirectTo || undefined }),
      });

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative">
      <AuthBackground />
      <header className="relative px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <Image src="/images/logo.png" alt="The Coral Farm" width={40} height={60} className="transition-transform duration-300 group-hover:scale-105" />
          <span className="text-white font-extrabold tracking-wider hidden sm:block">THE CORAL FARM</span>
        </Link>
        <Link href="/" className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium">Back to Home</Link>
      </header>

      <main className="relative px-6 md:px-[100px] lg:px-[140px] py-12">
        <div className="max-w-md mx-auto bg-[#1a1f26]/90 backdrop-blur-xl border border-white/[0.06] rounded-[24px] p-8 md:p-12 shadow-2xl shadow-black/40">
          {sent ? (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Check Your Email</h1>
                <p className="text-white/50">We&apos;ve sent a login link to</p>
                <p className="text-white font-medium mt-1">{email}</p>
              </div>
              <div className="text-center space-y-4">
                <p className="text-white/40 text-sm">Click the link in your email to sign in.</p>
                <button onClick={() => { setSent(false); setEmail(""); }} className="text-[#0984E3] hover:text-[#0984E3]/80 text-sm font-medium transition-colors">Try a different email</button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0984E3]/10 flex items-center justify-center overflow-hidden">
                  <Image src="/images/logo.png" alt="The Coral Farm" width={28} height={42} className="object-contain" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Trade Portal</h1>
                <p className="text-white/50">Sign in with your email</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#0984E3]/50 focus:ring-2 focus:ring-[#0984E3]/20 transition-all"
                  autoFocus
                  required
                />

                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-400 text-sm text-center">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full py-3 bg-[#0984E3] hover:bg-[#0984E3]/90 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Send Login Link</span>
                  )}
                </button>
              </form>
              <p className="text-center text-white/30 text-sm mt-4">
                Don&apos;t have an account?{" "}
                <Link href="/apply" className="text-[#0984E3] hover:text-[#0984E3]/80 transition-colors">Apply for a trade account</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <LoginErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen relative">
          <AuthBackground />
          <header className="relative px-6 md:px-[100px] lg:px-[140px] py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Image src="/images/logo.png" alt="The Coral Farm" width={40} height={60} />
              <span className="text-white font-extrabold tracking-wider hidden sm:block">THE CORAL FARM</span>
            </div>
            <Link href="/" className="text-white/60 hover:text-white transition-colors duration-200 text-sm font-medium">Back to Home</Link>
          </header>
          <main className="relative px-6 md:px-[100px] lg:px-[140px] py-12">
            <div className="max-w-md mx-auto bg-black/30 backdrop-blur-xl border border-white/10 rounded-[24px] p-8 md:p-12">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-[#0984E3]/10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Trade Portal</h1>
                <p className="text-white/50">Loading...</p>
              </div>
            </div>
          </main>
        </div>
      }>
        <LoginContent />
      </Suspense>
    </LoginErrorBoundary>
  );
}
