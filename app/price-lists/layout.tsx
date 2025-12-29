import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Price Lists - The Coral Farm",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PriceListsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
