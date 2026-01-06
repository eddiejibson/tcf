import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoice Builder - The Coral Farm",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function InvoiceBuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
