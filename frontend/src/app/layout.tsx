import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Surveydeal — Decentralized Crypto Escrow",
  description:
    "Secure milestone-based crypto escrow protocol. Dual-mode: Locked (2-of-2) and Arbiter (2-of-3). Supporting all ERC-20 tokens.",
  keywords: [
    "escrow",
    "crypto",
    "DeFi",
    "milestone",
    "Web3",
    "ERC-20",
    "blockchain",
    "smart contract",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-[#080c14] text-slate-200 min-h-screen`}
      >
        <div className="fixed inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
        </div>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
