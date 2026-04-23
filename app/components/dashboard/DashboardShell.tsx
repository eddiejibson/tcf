"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Sidebar from "./Sidebar";
import PageTransition from "./PageTransition";
import { useAuth } from "@/app/lib/auth-context";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  // Close sidebar on navigation
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleExitSudo = async () => {
    setExiting(true);
    const res = await fetch("/api/auth/sudo/exit", { method: "POST" });
    if (res.ok) {
      window.location.href = "/admin/users";
    } else {
      setExiting(false);
    }
  };

  const sudoBarOffset = user?.isImpersonating ? "top-9" : "top-0";

  return (
    <div className={`flex min-h-screen bg-[#1a1f26] ${user?.isImpersonating ? "pt-9" : ""}`}>
      {user?.isImpersonating && (
        <div className="fixed top-0 left-0 right-0 z-[60] h-9 bg-amber-500 text-black px-4 flex items-center justify-center gap-3 text-xs font-medium shadow-lg">
          <span>
            Viewing as <span className="font-bold">{user.email}</span>
          </span>
          <button
            onClick={handleExitSudo}
            disabled={exiting}
            className="px-3 py-0.5 bg-black/20 hover:bg-black/30 rounded-md font-semibold transition-colors disabled:opacity-50"
          >
            {exiting ? "Switching…" : "Switch back to admin"}
          </button>
        </div>
      )}
      {/* Mobile top bar */}
      <div className={`fixed ${sudoBarOffset} left-0 right-0 z-40 md:hidden bg-[#141820] border-b border-white/5 px-4 py-3 flex items-center gap-3`}>
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-white/60 hover:text-white transition-colors p-1"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <span className="text-white font-extrabold tracking-wider text-sm">THE CORAL FARM</span>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:block h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay - animated */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <motion.div
              className="absolute inset-0 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              className="relative h-full w-64"
              initial={{ x: -256 }}
              animate={{ x: 0 }}
              exit={{ x: -256 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <Sidebar />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main content - add top padding on mobile for the fixed header */}
      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
