"use client";

import React from "react";
import Link from "next/link";
import {
  Wallet,
  Lock,
  Globe,
  Coins,
  Shield,
  BarChart3,
  Zap,
  ArrowRight,
} from "lucide-react";

const NETWORKS = [
  { abbr: "ETH", name: "Ethereum", currency: "ETH" },
  { abbr: "BNB", name: "BNB Chain", currency: "BNB" },
  { abbr: "POL", name: "Polygon", currency: "MATIC" },
  { abbr: "ARB", name: "Arbitrum", currency: "ETH" },
  { abbr: "BASE", name: "Base", currency: "ETH" },
  { abbr: "AVAX", name: "Avalanche", currency: "AVAX" },
  { abbr: "OP", name: "Optimism", currency: "ETH" },
  { abbr: "FTM", name: "Fantom", currency: "FTM" },
];

const FEATURES = [
  {
    icon: Lock,
    title: "Smart Contract Escrow",
    desc: "Funds locked in audited smart contracts. Neither party can cheat.",
  },
  {
    icon: Globe,
    title: "Multi-Chain Support",
    desc: "Trade on Ethereum, BNB, Polygon, Arbitrum, Base, Avalanche and more.",
  },
  {
    icon: Coins,
    title: "All Tokens Welcome",
    desc: "ERC-20 tokens, memecoins, stablecoins — any EVM token, any chain.",
  },
  {
    icon: Shield,
    title: "Arbiter Resolution",
    desc: "Neutral third-party settles disputes with fair percentage splits.",
  },
  {
    icon: BarChart3,
    title: "Milestone Payments",
    desc: "Release funds in stages as work is delivered and approved.",
  },
  {
    icon: Zap,
    title: "Instant Settlement",
    desc: "On-chain settlement in seconds. No middlemen, no delays.",
  },
];

const STEPS = [
  { num: "1", title: "Connect Wallet", desc: "Link your wallet on any supported chain" },
  { num: "2", title: "Create Escrow", desc: "Set token, amount, milestones, and counterpart" },
  { num: "3", title: "Fund Escrow", desc: "Send tokens to the escrow deposit address" },
  { num: "4", title: "Deliver & Approve", desc: "Seller delivers, buyer approves milestones" },
  { num: "5", title: "Funds Released", desc: "Smart contract auto-releases to seller" },
];

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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-bg border-b-2 border-divider">
        <div className="max-w-[1120px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-heading font-extrabold text-lg">SurveyDeal</span>
            <span className="tag tag-accent ml-1">ESCROW</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm hover:text-accent transition-colors">
              Dashboard
            </Link>
            <Link href="/escrow/create" className="text-sm hover:text-accent transition-colors">
              Create
            </Link>
            <Link href="/admin" className="text-sm hover:text-accent transition-colors">
              Admin
            </Link>
          </div>
          <Link href="/escrow/create" className="btn btn-primary">
            <Wallet className="w-4 h-4" />
            Connect Wallet
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-6">
                <span className="w-2 h-2 bg-accent inline-block animate-pulse-dot" />
                <span className="text-accent text-sm font-semibold">Live on 10+ Networks</span>
              </div>
              <h1 className="text-[52px] leading-[1.05] font-heading font-extrabold text-text">
                Trade crypto without trust issues.
              </h1>
              <p className="text-[17px] opacity-70 mt-6 max-w-[420px]">
                The decentralized escrow platform for buying and selling any token — memecoins, ERC-20s, SPL tokens.
                Smart contracts hold funds until both parties agree.
              </p>
              <div className="flex items-center gap-3 mt-10">
                <Link href="/escrow/create" className="btn btn-primary text-left">
                  Start Trading
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/dashboard" className="btn btn-secondary text-left">
                  View Dashboard
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="sd-card p-0">
                <div className="flex items-center justify-between px-5 py-3 border-b-2 border-divider">
                  <span className="text-xs font-semibold tracking-wider uppercase opacity-50">Active Escrow</span>
                  <span className="tag tag-accent">FUNDED</span>
                </div>
                <div className="px-5 py-6">
                  <p className="text-[32px] font-heading font-extrabold leading-none">10,000 USDT</p>
                  <div className="mt-5">
                    <div className="w-full h-2 bg-divider">
                      <div className="h-full bg-accent" style={{ width: "66%" }} />
                    </div>
                    <p className="text-xs opacity-50 mt-2">2 of 3 milestones released</p>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-[-16px] right-[-16px] w-20 h-20 bg-accent flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Networks */}
      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <p className="text-xs font-semibold tracking-wider uppercase opacity-50 mb-6">
            Supported Networks
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {NETWORKS.map((net) => (
              <div key={net.abbr} className="flex items-center gap-3 py-2">
                <div className="w-7 h-7 border-2 border-divider flex items-center justify-center text-[10px] font-bold shrink-0">
                  {net.abbr}
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{net.name}</p>
                  <p className="text-xs opacity-50">{net.currency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <p className="text-xs font-semibold tracking-wider uppercase text-accent mb-2">Why SurveyDeal</p>
          <h2 className="text-3xl font-heading font-extrabold mb-10">Built for the memecoin era.</h2>
          <div className="bg-divider grid grid-cols-1 md:grid-cols-3 gap-[2px]">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-bg p-6">
                  <div className="w-10 h-10 bg-accent flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-heading font-extrabold mb-1">{f.title}</h3>
                  <p className="text-sm opacity-60">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <p className="text-xs font-semibold tracking-wider uppercase text-accent mb-2">Process</p>
          <h2 className="text-3xl font-heading font-extrabold mb-10">How it works</h2>
          <div className="border-2 border-divider grid grid-cols-1 md:grid-cols-5">
            {STEPS.map((s, i) => (
              <div
                key={s.num}
                className={`p-5 ${i < STEPS.length - 1 ? "md:border-r-2 md:border-divider border-b-2 md:border-b-0" : ""}`}
              >
                <div className="w-9 h-9 bg-accent flex items-center justify-center text-white text-sm font-bold mb-3">
                  {s.num}
                </div>
                <h4 className="text-sm font-heading font-extrabold mb-1">{s.title}</h4>
                <p className="text-xs opacity-50">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="bg-accent p-10 flex flex-col justify-center">
              <h2 className="text-3xl font-heading font-extrabold text-white leading-tight">
                Ready to trade safely?
              </h2>
              <p className="text-white opacity-80 mt-3 text-sm max-w-[360px]">
                Create your first escrow in under 2 minutes. No sign-up required — just connect your wallet.
              </p>
            </div>
            <div className="bg-surface p-10 flex flex-col justify-center gap-3">
              <Link href="/escrow/create" className="btn btn-primary text-left w-fit">
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="https://github.com/gorefilip20/surveydeal"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost text-left w-fit"
              >
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t-2 border-divider py-6">
        <div className="max-w-[1120px] mx-auto px-6 flex items-center justify-between text-xs opacity-50">
          <p>&copy; 2025 SurveyDeal. Decentralized Escrow Protocol.</p>
          <div className="flex gap-4">
            <a
              href="https://github.com/gorefilip20/surveydeal"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-100 transition-opacity"
            >
              GitHub
            </a>
            <Link href="/admin" className="hover:opacity-100 transition-opacity">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
