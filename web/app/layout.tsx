import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Underwrite | Casper Risk Settlement",
  description:
    "A Casper-native risk settlement primitive with real Testnet policy registration, valid claim settlement, duplicate rejection, and stale rejection evidence."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
