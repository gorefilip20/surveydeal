"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Shield,
  ShieldCheck,
  Scale,
  Wallet,
  ArrowRightLeft,
  Clock,
  CheckCircle2,
  Gavel,
  ExternalLink,
  Lock,
  Users,
  Coins,
  BarChart3,
  Zap,
  Globe,
} from "lucide-react";
import EscrowForm from "@/components/EscrowForm";

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative p-6 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all duration-300">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="w-10 h-10 rounded-lg gradient-brand flex items-center justify-center mb-4">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl md:text-3xl font-bold text-gradient-brand">{value}</div>
      <div className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{label}</div>
    </div>
  );
}

export default function Home() {
  const { isConnected } = useAccount();
  const [showApp, setShowApp] = useState(false);

  if (showApp || isConnected) {
    return (
      <div className="min-h-screen">
        <nav className="sticky top-0 z-50 glass border-b border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <button
                onClick={() => setShowApp(false)}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold text-white">
                  Survey<span className="text-gradient-brand">deal</span>
                </span>
              </button>
              <div className="flex items-center gap-4">
                <a href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">Dashboard</a>
                <a href="/escrow/create" className="text-sm text-slate-400 hover:text-white transition-colors">Create Escrow</a>
                <a href="/swap" className="text-sm text-slate-400 hover:text-white transition-colors">Swap</a>
                <ConnectButton />
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <EscrowForm />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Survey<span className="text-gradient-brand">deal</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
              <a href="#modes" className="hover:text-white transition-colors">Escrow Modes</a>
              <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
              <a href="/swap" className="hover:text-white transition-colors">Swap</a>
            </div>
            <ConnectButton />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-br from-emerald-500/10 via-teal-500/8 to-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-xs font-medium mb-8">
            <Zap className="w-3 h-3" />
            Decentralized Crypto Escrow Protocol
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Secure Milestone-Based{" "}
            <span className="text-gradient-brand">Crypto Escrow</span>
          </h1>

          <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Protect your crypto transactions with smart contract escrow.
            Milestone releases, dual-mode dispute resolution, and support
            for all ERC-20 tokens — including memecoins and tax tokens.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <a
              href="/escrow/create"
              className="px-8 py-3 rounded-xl gradient-brand text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/20"
            >
              Launch Escrow App
            </a>
            <a
              href="/dashboard"
              className="px-8 py-3 rounded-xl border border-white/10 text-slate-300 font-medium hover:bg-white/5 transition-colors"
            >
              My Dashboard
            </a>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
            <StatCard value="100%" label="On-Chain" />
            <StatCard value="2 Modes" label="Escrow Types" />
            <StatCard value="1%" label="Protocol Fee" />
            <StatCard value="All" label="ERC-20 Tokens" />
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Built for <span className="text-gradient-brand">Secure Trading</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Every feature designed to protect both buyers and sellers in crypto transactions.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={Shield}
              title="Smart Contract Escrow"
              description="Funds locked in auditable Solidity contracts with OpenZeppelin security — ReentrancyGuard, AccessControl, Pausable."
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Milestone Releases"
              description="Split payments into milestones. Funds release only when the buyer approves each deliverable — no all-or-nothing."
            />
            <FeatureCard
              icon={Scale}
              title="Dual Dispute Resolution"
              description="Locked mode (2-of-2 consensus) or Arbiter mode (2-of-3 with neutral third party). Choose per escrow."
            />
            <FeatureCard
              icon={Coins}
              title="All ERC-20 Tokens"
              description="USDC, USDT, DAI, WETH, memecoins — even tax-on-transfer tokens with automatic amount rescaling."
            />
            <FeatureCard
              icon={Lock}
              title="Non-Custodial"
              description="No one — not even the protocol — can access locked funds. Smart contract logic governs all releases and refunds."
            />
            <FeatureCard
              icon={Clock}
              title="Deadline Protection"
              description="Auto-refund if the seller misses the deadline. Buyers never get stuck waiting forever."
            />
            <FeatureCard
              icon={Gavel}
              title="Admin Arbitration"
              description="Authorized arbiters can resolve disputes with configurable buyer/seller splits (force release or force refund)."
            />
            <FeatureCard
              icon={BarChart3}
              title="Protocol Fee System"
              description="Configurable basis-point fees with absolute caps. Transparent, on-chain fee collection."
            />
            <FeatureCard
              icon={Globe}
              title="Multi-Chain Ready"
              description="Deploy on Ethereum, Arbitrum, Base, or any EVM chain. Same contract, same security."
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              How <span className="text-gradient-brand">Surveydeal</span> Works
            </h2>
            <p className="text-slate-400">Five steps from agreement to payment.</p>
          </div>

          <div className="space-y-8">
            {[
              { step: "01", icon: ArrowRightLeft, title: "Create Escrow", desc: "Buyer defines milestones, selects token, sets deadline, and chooses Locked or Arbiter mode." },
              { step: "02", icon: Wallet, title: "Fund Escrow", desc: "Buyer approves and deposits tokens into the smart contract. Funds are locked and visible on-chain." },
              { step: "03", icon: CheckCircle2, title: "Deliver & Approve", desc: "Seller marks milestones delivered. Buyer reviews and approves — funds release per milestone." },
              { step: "04", icon: Gavel, title: "Dispute (If Needed)", desc: "Either party can raise a dispute. Resolved by consensus or arbiter with configurable splits." },
              { step: "05", icon: ShieldCheck, title: "Completion", desc: "All milestones released, escrow marked complete. Or buyer claims refund if deadline expires." },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="flex gap-6 items-start">
                <div className="shrink-0 w-12 h-12 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-sm">
                  {step}
                </div>
                <div className="flex-1 pb-8 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-semibold text-white">{title}</h3>
                  </div>
                  <p className="text-sm text-slate-400">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Escrow Modes */}
      <section id="modes" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">
              Two <span className="text-gradient-brand">Escrow Modes</span>
            </h2>
            <p className="text-slate-400">Choose the trust model that fits your deal.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 glow-green">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Locked Mode (2-of-2)</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                Both buyer and seller must agree to release or refund. No third party involved.
                Perfect for established trading partners with mutual trust.
              </p>
              <ul className="space-y-2 text-sm">
                {["Buyer + Seller consensus", "No arbiter fees", "Maximum privacy", "Dispute resolved by agreement"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative p-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 glow-blue">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Arbiter Mode (2-of-3)</h3>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                A neutral arbiter can break deadlocks. Any 2 of the 3 parties can decide the outcome.
                Ideal for first-time trades or high-value deals.
              </p>
              <ul className="space-y-2 text-sm">
                {["Neutral third-party arbiter", "Configurable split resolution", "Buyer/seller protection", "Force release or refund"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="p-12 rounded-2xl glass border-emerald-500/10">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Escrow?
            </h2>
            <p className="text-slate-400 mb-8">
              Connect your wallet and create your first milestone-based escrow in minutes.
            </p>
            <a
              href="/escrow/create"
              className="px-10 py-3.5 rounded-xl gradient-brand text-white font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-emerald-500/25 inline-block"
            >
              Launch Surveydeal App
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-brand flex items-center justify-center">
              <Shield className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm text-slate-500">
              Surveydeal &copy; {new Date().getFullYear()} — Decentralized Crypto Escrow
            </span>
          </div>
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <span>Solidity ^0.8.20</span>
            <span>OpenZeppelin Secured</span>
            <span>EVM Compatible</span>
            <a href="/admin" className="text-emerald-600 hover:text-emerald-400 transition-colors">Admin</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
