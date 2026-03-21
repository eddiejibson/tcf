"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/lib/auth-context";
import { userHasPermission, Permission } from "@/app/lib/permissions";

const adminLinks = [
  { href: "/admin/users", label: "Users", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
  { href: "/admin/shipments", label: "Shipments", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { href: "/admin/orders", label: "Orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { href: "/admin/doa", label: "DOAs", icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  { href: "/admin/catalog", label: "Catalog", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4M4 7v10l8 4M12 11V3" },
  { href: "/admin/categories", label: "Categories", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zm0 9.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" },
  { href: "/admin/applications", label: "Applications", icon: "M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" },
];

function getUserLinks(user: { role: string; companyRole?: string | null; permissions?: string[] | null }) {
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

  const isAdmin = user?.role === "ADMIN";
  const links = isAdmin ? adminLinks : user ? getUserLinks(user) : [];

  return (
    <aside className="w-64 bg-[#141820] border-r border-white/5 flex flex-col h-full">
      <div className="p-6">
        <Link href="/" className="flex items-center gap-3 group">
          <Image src="/images/logo.png" alt="The Coral Farm" width={32} height={48} className="transition-transform duration-300 group-hover:scale-105" />
          <span className="text-white font-extrabold tracking-wider text-sm">THE CORAL FARM</span>
        </Link>
      </div>

      {isAdmin && (
        <div className="px-4 mb-2">
          <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium px-3">Admin</span>
        </div>
      )}

      <nav className="flex-1 px-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[#0984E3]/10 text-[#0984E3]"
                  : "text-white/50 hover:text-white/80 hover:bg-white/5"
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={link.icon} />
              </svg>
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/5">
        {user && user.creditBalance > 0 && (
          <div className="px-3 py-2 mb-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
            <p className="text-emerald-400/60 text-[10px] uppercase tracking-wider font-medium">Account Credit</p>
            <p className="text-emerald-400 text-sm font-bold tabular-nums">£{Number(user.creditBalance).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        )}
        <div className="px-3 mb-3">
          <p className="text-white/80 text-sm font-medium truncate">{user?.email}</p>
          <p className="text-white/30 text-xs">{user ? getRoleDisplay(user) : ""}</p>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </aside>
  );
}
