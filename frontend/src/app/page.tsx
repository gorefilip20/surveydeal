"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

const CHAINS = [
  { id: "ETHEREUM", name: "Ethereum", icon: "🔷", nativeCurrency: "ETH", color: "#627EEA" },
  { id: "BNB_CHAIN", name: "BNB Chain", icon: "🟡", nativeCurrency: "BNB", color: "#F0B90B" },
  { id: "POLYGON", name: "Polygon", icon: "🟣", nativeCurrency: "MATIC", color: "#8247E5" },
  { id: "ARBITRUM", name: "Arbitrum", icon: "🔵", nativeCurrency: "ETH", color: "#28A0F0" },
  { id: "BASE", name: "Base", icon: "🔷", nativeCurrency: "ETH", color: "#0052FF" },
  { id: "SOLANA", name: "Solana", icon: "☀️", nativeCurrency: "SOL", color: "#9945FF" },
  { id: "TRON", name: "TRON", icon: "🔴", nativeCurrency: "TRX", color: "#FF0013" },
  { id: "AVALANCHE", name: "Avalanche", icon: "🔺", nativeCurrency: "AVAX", color: "#E84142" },
];

const FEATURES = [
  {
    icon: "🔒",
    title: "Smart Contract Escrow",
    desc: "Funds locked in audited smart contracts. Neither party can cheat.",
  },
  {
    icon: "🌍",
    title: "Multi-Chain Support",
    desc: "Trade on Ethereum, BNB, Polygon, Arbitrum, Base, Solana, TRON and more.",
  },
  {
    icon: "🪙",
    title: "All Tokens Welcome",
    desc: "ERC-20, SPL tokens, memecoins, stablecoins — any token, any chain.",
  },
  {
    icon: "👨‍⚖️",
    title: "Arbiter Resolution",
    desc: "Neutral third-party settles disputes with fair percentage splits.",
  },
  {
    icon: "📊",
    title: "Milestone Payments",
    desc: "Release funds in stages as work is delivered and approved.",
  },
  {
    icon: "⚡",
    title: "Instant Settlement",
    desc: "On-chain settlement in seconds. No middlemen, no delays.",
  },
];

export default function LandingPage() {
  const [stats, setStats] = useState({ escrows: 0, volume: "0", users: 0 });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Navigation */}
      <nav className="border-b border-gray-800/50 bg-gray-950/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">
              SD
            </div>
            <span className="text-xl font-bold">SurveyDeal</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
              Dashboard
            </Link>
            <Link href="/admin" className="text-sm text-gray-400 hover:text-white transition">
              Admin
            </Link>
            <Link
              href="/escrow/create"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
            >
              Create Escrow
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-purple-500/5 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-20 relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-gray-800/50 border border-gray-700 rounded-full px-4 py-1.5 text-sm text-gray-300 mb-6">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live on BNB Chain, Ethereum, Polygon & more
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold leading-tight">
              Trade Crypto
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                {" "}Without Trust Issues
              </span>
            </h1>
            <p className="text-lg text-gray-400 mt-6 max-w-2xl mx-auto">
              The decentralized escrow platform for buying and selling any token — memecoins, ERC-20s, SPL tokens.
              Smart contracts hold funds until both parties agree.
            </p>
            <div className="flex items-center justify-center gap-4 mt-10">
              <Link
                href="/escrow/create"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3.5 rounded-xl transition text-lg"
              >
                Start Trading →
              </Link>
              <a
                href="https://github.com/gorefilip20/surveydeal"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-800 hover:bg-gray-700 text-white font-medium px-8 py-3.5 rounded-xl border border-gray-700 transition"
              >
                View on GitHub
              </a>
            </div>
          </div>

          {/* Supported Chains */}
          <div className="mt-20">
            <p className="text-center text-sm text-gray-500 mb-6">Supported Networks</p>
            <div className="flex justify-center gap-6 flex-wrap">
              {CHAINS.map((chain) => (
                <div key={chain.id} className="flex items-center gap-2 text-gray-400 hover:text-white transition">
                  <span className="text-2xl">{chain.icon}</span>
                  <span className="text-sm font-medium">{chain.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center mb-4">
            Why SurveyDeal?
          </h2>
          <p className="text-center text-gray-400 mb-12 max-w-xl mx-auto">
            Built for the memecoin era. Buy, sell, and trade any token with full escrow protection.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="text-lg font-semibold mt-4">{f.title}</h3>
                <p className="text-gray-400 text-sm mt-2">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 border-t border-gray-800/50 bg-gray-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: "1", title: "Connect Wallet", desc: "Link your wallet on any supported chain" },
              { step: "2", title: "Create Escrow", desc: "Set token, amount, milestones, and counterpart" },
              { step: "3", title: "Fund Escrow", desc: "Send tokens to the escrow deposit address" },
              { step: "4", title: "Deliver & Approve", desc: "Seller delivers, buyer approves milestones" },
              { step: "5", title: "Funds Released", desc: "Smart contract auto-releases to seller" },
            ].map((s, i) => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-3">
                  {s.step}
                </div>
                <h4 className="font-semibold text-sm">{s.title}</h4>
                <p className="text-xs text-gray-400 mt-1">{s.desc}</p>
                {i < 4 && <div className="hidden md:block text-gray-600 text-2xl mt-3">→</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-4xl font-bold">
            Ready to Trade Safely?
          </h2>
          <p className="text-gray-400 mt-4 mb-8">
            Create your first escrow in under 2 minutes. No sign-up required — just connect your wallet.
          </p>
          <Link
            href="/escrow/create"
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-10 py-4 rounded-xl transition text-lg"
          >
            Launch App →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between text-sm text-gray-500">
          <p>© 2024 SurveyDeal. Decentralized Escrow Protocol.</p>
          <div className="flex gap-4">
            <a href="https://github.com/gorefilip20/surveydeal" target="_blank" className="hover:text-white transition">
              GitHub
            </a>
            <Link href="/admin" className="hover:text-white transition">
              Admin
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
