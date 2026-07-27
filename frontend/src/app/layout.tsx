import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SurveyDeal — Decentralized Crypto Escrow",
  description:
    "Secure milestone-based crypto escrow protocol. Dual-mode: Locked (2-of-2) and Arbiter (2-of-3). Supporting all ERC-20 tokens across 10+ networks.",
  keywords: [
    "escrow",
    "crypto",
    "DeFi",
    "milestone",
    "Web3",
    "ERC-20",
    "blockchain",
    "smart contract",
    "multi-chain",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
