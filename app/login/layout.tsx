import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login - The Coral Farm Trade Portal",
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
