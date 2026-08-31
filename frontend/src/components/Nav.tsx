"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, LogOut, Menu, X } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/AuthProvider";

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
  const { isConnected } = useAccount();
  const { isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/escrow/create", label: "Create" },
    { href: "/templates", label: "Templates" },
    { href: "/feed", label: "Feed" },
    { href: "/swap", label: "Swap" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-bg border-b-2 border-divider">
      <div className="max-w-[1120px] mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-heading font-extrabold text-lg">SurveyDeal</span>
          <span className="tag tag-accent ml-1">ESCROW</span>
        </Link>

        {/* Desktop links */}
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

        {/* Desktop right side */}
        <div className="hidden sm:flex items-center gap-3">
          {isConnected ? (
            <>
              <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
              {isAuthenticated && (
                <button
                  onClick={logout}
                  className="text-sm opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </>
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

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="sm:hidden p-2 text-text"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="sm:hidden border-t-2 border-divider bg-bg px-6 py-4 space-y-3">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block text-sm py-2 transition-colors ${
                pathname === link.href
                  ? "text-accent font-semibold"
                  : "text-text hover:text-accent"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-divider">
            {isConnected ? (
              <div className="flex items-center justify-between">
                <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
                {isAuthenticated && (
                  <button
                    onClick={() => { logout(); setMobileOpen(false); }}
                    className="btn btn-secondary text-sm"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                )}
              </div>
            ) : (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <button onClick={openConnectModal} className="btn btn-primary w-full">
                    <Wallet className="w-4 h-4" />
                    Connect Wallet
                  </button>
                )}
              </ConnectButton.Custom>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export { Logo };
