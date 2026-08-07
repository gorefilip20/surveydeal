"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" fill="#ec3013" />
      <path d="M8 10H12V20H8V10Z" fill="#f3f2f2" />
      <path d="M14 13H18V20H14V13Z" fill="#f3f2f2" opacity="0.8" />
      <path d="M20 8H24V20H20V8Z" fill="#f3f2f2" />
      <rect x="6" y="21" width="20" height="2" fill="#f3f2f2" />
    </svg>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const { isConnected, address } = useAccount();

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/escrow/create", label: "Create" },
    { href: "/swap", label: "Swap" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-bg border-b-2 border-divider">
      <div className="max-w-[1120px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-heading font-extrabold text-lg">SurveyDeal</span>
          <span className="tag tag-accent ml-1">ESCROW</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors ${
                pathname === link.href
                  ? "text-accent font-semibold"
                  : "text-text hover:text-accent"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        {isConnected ? (
          <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
        ) : (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button onClick={openConnectModal} className="btn btn-primary">
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>
            )}
          </ConnectButton.Custom>
        )}
      </div>
    </nav>
  );
}

export { Logo };
