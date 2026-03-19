import { AuthProvider } from "@/app/lib/auth-context";
import DashboardShell from "@/app/components/dashboard/DashboardShell";
import DashboardErrorBoundary from "@/app/components/dashboard/DashboardErrorBoundary";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trade Portal - The Coral Farm",
  robots: { index: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardErrorBoundary>
      <AuthProvider>
        <DashboardShell>{children}</DashboardShell>
      </AuthProvider>
    </DashboardErrorBoundary>
  );
}
