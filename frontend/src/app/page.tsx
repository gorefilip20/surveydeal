"use client";

import React from "react";
import Link from "next/link";
import {
  Lock,
  Globe,
  Coins,
  Shield,
  BarChart3,
  Zap,
  ArrowRight,
  Users,
  Star,
  FileText,
  Building2,
  Briefcase,
  Key,
} from "lucide-react";
import Nav from "@/components/Nav";

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
    title: "Secure Escrow",
    desc: "Funds held safely until milestones are approved. Neither party can cheat.",
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
    title: "Multi-Sig & Arbiter",
    desc: "Choose 2-of-2 locked, 2-of-3 arbiter, or multi-signature approval modes.",
  },
  {
    icon: BarChart3,
    title: "Trust Scores",
    desc: "On-chain reputation system. Build trust through completed deals and ratings.",
  },
  {
    icon: Zap,
    title: "One-Link Deals",
    desc: "Share a single link to invite anyone to view and fund your escrow.",
  },
];

const VERTICALS = [
  { icon: Briefcase, title: "Freelance", desc: "Web dev, design, writing — milestone payments for services" },
  { icon: Building2, title: "Real Estate", desc: "Earnest money deposits and property transaction escrows" },
  { icon: Coins, title: "Crypto OTC", desc: "Secure token trades with verified counterparties" },
  { icon: Globe, title: "Domain Sales", desc: "Safe domain name transfers with escrowed funds" },
  { icon: Users, title: "Partnerships", desc: "Investment deals and profit-sharing agreements" },
  { icon: Star, title: "Influencer", desc: "Sponsorship and collaboration payment milestones" },
];

const STEPS = [
  { num: "1", title: "Connect Wallet", desc: "Link your wallet on any supported chain" },
  { num: "2", title: "Create Escrow", desc: "Set token, amount, milestones, and counterpart" },
  { num: "3", title: "Fund Escrow", desc: "Send tokens to the escrow deposit address" },
  { num: "4", title: "Deliver & Approve", desc: "Seller delivers, buyer approves milestones" },
  { num: "5", title: "Funds Released", desc: "Funds released to seller on approval" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      {/* Hero */}
      <section className="pt-20 pb-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 bg-accent inline-block animate-pulse-dot" />
                <span className="text-accent text-sm font-semibold">Live on 8 Networks</span>
              </div>
              <h1 className="text-[52px] leading-[1.05] font-heading font-extrabold text-text mb-4">
                Trade crypto<br />without trust<br />issues.
              </h1>
              <p className="text-[17px] opacity-70 max-w-[420px] mb-6">
                The secure escrow platform for buying and selling any EVM token — memecoins, ERC-20s, stablecoins.
                Funds held safely until both parties agree.
              </p>
              <div className="flex items-center gap-3">
                <Link href="/escrow/create" className="btn btn-primary text-left">
                  Start Trading
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/dashboard" className="btn btn-secondary text-left">
                  View Dashboard
                </Link>
              </div>
            </div>

            <div className="bg-surface p-6 relative">
              <div className="border-2 border-divider p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold tracking-wider uppercase text-accent">Active Escrow</span>
                  <span className="tag tag-accent">FUNDED</span>
                </div>
                <h3 className="text-[28px] font-heading font-extrabold leading-none mb-2">10,000 USDT</h3>
                <p className="text-[13px] opacity-60 mb-4">Web Development Milestone Payment</p>
                <div className="h-[6px] bg-neutral-200 mb-3">
                  <div className="h-full bg-accent" style={{ width: "66%" }} />
                </div>
                <p className="text-xs opacity-50">2 of 3 milestones released</p>
              </div>
              <div className="absolute bottom-[-12px] right-[-12px] w-20 h-20 bg-accent flex items-center justify-center">
                <Lock className="w-8 h-8 text-bg" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><hr className="border-0 h-[2px] bg-divider" /></div>

      {/* Supported Networks */}
      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <p className="text-xs font-semibold tracking-wider uppercase opacity-50 mb-6">
            Supported Networks
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {NETWORKS.map((net) => (
              <div
                key={net.abbr}
                className="flex items-center gap-3 p-3 bg-surface border border-divider hover:border-accent transition-colors"
              >
                <div className="w-7 h-7 border-2 border-divider flex items-center justify-center text-[11px] font-heading font-extrabold shrink-0">
                  {net.abbr}
                </div>
                <div>
                  <p className="text-[13px] font-semibold leading-tight">{net.name}</p>
                  <p className="text-[11px] opacity-50">{net.currency}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><hr className="border-0 h-[2px] bg-divider" /></div>

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

      <div className="max-w-[1120px] mx-auto px-6"><hr className="border-0 h-[2px] bg-divider" /></div>

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

      <div className="max-w-[1120px] mx-auto px-6"><hr className="border-0 h-[2px] bg-divider" /></div>

      {/* Industry Verticals */}
      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <p className="text-xs font-semibold tracking-wider uppercase text-accent mb-2">Verticals</p>
          <h2 className="text-3xl font-heading font-extrabold mb-3">Escrow for every industry.</h2>
          <p className="text-sm opacity-60 mb-10 max-w-[500px]">
            Pre-built templates and milestone structures for real estate, freelancing, crypto OTC, partnerships, and more.
          </p>
          <div className="bg-divider grid grid-cols-1 md:grid-cols-3 gap-[2px]">
            {VERTICALS.map((v) => {
              const Icon = v.icon;
              return (
                <div key={v.title} className="bg-bg p-6">
                  <div className="w-10 h-10 bg-accent flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-base font-heading font-extrabold mb-1">{v.title}</h3>
                  <p className="text-sm opacity-60">{v.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 flex gap-3">
            <Link href="/templates" className="btn btn-secondary">
              <FileText className="w-4 h-4" />
              Browse Templates
            </Link>
            <Link href="/feed" className="btn btn-ghost">
              View Deal Feed
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><hr className="border-0 h-[2px] bg-divider" /></div>

      {/* Trust & Security */}
      <section className="py-16">
        <div className="max-w-[1120px] mx-auto px-6">
          <p className="text-xs font-semibold tracking-wider uppercase text-accent mb-2">Trust & Security</p>
          <h2 className="text-3xl font-heading font-extrabold mb-10">Built-in protection at every level.</h2>
          <div className="border-2 border-divider grid grid-cols-1 md:grid-cols-4">
            {[
              { title: "Verified Tiers", desc: "Anonymous, Verified, and KYC levels with increasing escrow limits", icon: Shield },
              { title: "Trust Scores", desc: "On-chain reputation built through completed deals, ratings, and volume", icon: Star },
              { title: "API & White-Label", desc: "Integrate escrow into your own platform with API keys", icon: Key },
              { title: "Referral Program", desc: "Earn 10% of protocol fees when you refer new traders", icon: Users },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`p-5 ${i < 3 ? "md:border-r-2 md:border-divider border-b-2 md:border-b-0" : ""}`}>
                  <div className="w-9 h-9 bg-accent flex items-center justify-center text-white mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h4 className="text-sm font-heading font-extrabold mb-1">{item.title}</h4>
                  <p className="text-xs opacity-50">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="max-w-[1120px] mx-auto px-6"><hr className="border-0 h-[2px] bg-divider" /></div>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-[1120px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2">
            <div className="bg-accent p-10 flex flex-col justify-center">
              <h2 className="text-[38px] font-heading font-extrabold text-white leading-tight mb-3">
                Ready to trade safely?
              </h2>
              <p className="text-white opacity-80 text-[15px]">
                Create your first escrow in under 2 minutes. No sign-up — just connect your wallet.
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
          <p>&copy; 2025 SurveyDeal. Secure Escrow Protocol.</p>
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
