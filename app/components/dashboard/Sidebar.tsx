"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { userHasPermission, Permission } from "@/app/lib/permissions";
import FlipNumber from "@/app/components/FlipNumber";
import CreditHistoryModal from "@/app/components/CreditHistoryModal";

const adminLinks = [
  { href: "/admin/users", label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/admin/shipments", label: "Shipments", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/admin/orders", label: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { href: "/admin/doa", label: "DOAs", icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  { href: "/admin/catalog", label: "Catalog", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4M4 7v10l8 4M12 11V3" },
  { href: "/admin/categories", label: "Categories", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" },
  { href: "/admin/applications", label: "Applications", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
  { href: "/admin/companies", label: "Companies", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" },
  { href: "/admin/audit", label: "Audit Log", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
];

function getUserLinks(user: { role: string; companyRole?: string | null; companyId?: string | null; permissions?: string[] | null }) {
  const links: { href: string; label: string; icon: string }[] = [];

  if (userHasPermission(user, Permission.VIEW_SHIPMENTS)) {
    links.push({ href: "/shipments", label: "Shipments", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" });
  }

  if (userHasPermission(user, Permission.CREATE_CATALOG_ORDER)) {
    links.push({ href: "/catalog", label: "Catalog", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4M4 7v10l8 4M12 11V3" });
  }

  if (userHasPermission(user, Permission.VIEW_ORDERS) || userHasPermission(user, Permission.CREATE_ORDER) || userHasPermission(user, Permission.CREATE_CATALOG_ORDER)) {
    links.push({ href: "/orders", label: "My Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" });
  }

  if (isCompanyAdmin(user)) {
    links.push({ href: "/team", label: "Team", icon: "M18 21a8 8 0 00-16 0M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" });
  }

  if (user.companyId) {
    links.push({ href: "/company", label: "Company", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" });
  }

  return links;
}

function getRoleDisplay(user: { role: string; companyRole?: string | null; companyName?: string | null }) {
  if (user.role === "ADMIN") return "Admin";
  if (user.companyRole === "MEMBER") return "Team Member";
  if (user.companyRole === "OWNER" || user.companyName) return "Company Admin";
  return "User";
}

function isCompanyAdmin(user: { role: string; companyRole?: string | null; companyName?: string | null }) {
  return user.companyRole === "OWNER" || (!!user.companyName && user.companyRole !== "MEMBER");
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [showCreditHistory, setShowCreditHistory] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const links = isAdmin ? adminLinks : user ? getUserLinks(user) : [];
  const initials = (user?.email ?? "").trim().slice(0, 2).toUpperCase() || "··";

  return (
    <aside className="relative flex h-full w-64 flex-col border-r border-white/[0.06] bg-[#10141b]">
      {/* Soft top sheen for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.035] to-transparent" />

      {/* Brand mark — logo only */}
      <div className="relative px-5 pt-6 pb-5">
        <Link href="/" aria-label="The Coral Farm" className="group inline-flex">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] transition-all duration-300 group-hover:border-white/20 group-hover:bg-white/[0.07]">
            <Image src="/images/logo.png" alt="The Coral Farm" width={22} height={33} className="object-contain transition-transform duration-300 group-hover:scale-105" />
          </span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-200 ${
                  isActive ? "text-white" : "text-white/45 hover:bg-white/[0.03] hover:text-white/85"
                }`}
              >
                {isActive && (
                  <>
                    <motion.span
                      layoutId="sidebar-active-bg"
                      className="absolute inset-0 rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/[0.07]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                    <motion.span
                      layoutId="sidebar-active-rail"
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[#0984E3]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  </>
                )}
                <svg
                  className={`relative z-10 h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? "text-[#0984E3]" : "text-white/40 group-hover:text-white/70"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
                </svg>
                <span className="relative z-10">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="relative border-t border-white/[0.06] px-3 pt-3 pb-4">
        {user && user.creditBalance > 0 && (
          <button
            onClick={() => setShowCreditHistory(true)}
            className="mb-3 w-full rounded-xl border border-emerald-500/15 bg-emerald-500/[0.08] px-3 py-2.5 text-left transition-colors hover:border-emerald-500/25 hover:bg-emerald-500/[0.12]"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300/60">Account Credit</p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-300">
              <FlipNumber value={`£${Number(user.creditBalance).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
            </p>
          </button>
        )}
        <CreditHistoryModal open={showCreditHistory} onClose={() => setShowCreditHistory(false)} />

        <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/[0.03]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0984E3]/35 to-[#0984E3]/5 text-[11px] font-semibold text-white/90 ring-1 ring-inset ring-white/10">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium leading-tight text-white/85">{user?.email}</p>
            <p className="mt-0.5 text-[11px] leading-tight text-white/35">{user ? getRoleDisplay(user) : ""}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            title="Sign out"
            className="shrink-0 rounded-lg p-1.5 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
