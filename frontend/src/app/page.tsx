"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const CHAINS = [
  ["Ethereum", "◆", "#627eea"],
  ["BNB Chain", "●", "#f0b90b"],
  ["Polygon", "●", "#8247e5"],
  ["Arbitrum", "●", "#28a0f0"],
  ["Base", "◆", "#0052ff"],
  ["Avalanche", "▲", "#e84142"],
];

const FEATURES = [
  { number: "01", title: "Milestone protection", text: "Release funds only when delivery is accepted. Every step is recorded for both parties." },
  { number: "02", title: "Flexible settlement", text: "Support token deals, service work, and cross-border payments with transparent rules." },
  { number: "03", title: "Dispute-ready by design", text: "Keep evidence, approvals, and resolution terms together in one auditable workspace." },
];

type PaymentWallet = { id: string; symbol: string; network: string; address: string; label?: string; instructions?: string; isActive: boolean };

function shorten(address: string) {
  return address.length > 18 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address;
}

export default function LandingPage() {
  const [wallets, setWallets] = useState<PaymentWallet[]>([]);

  useEffect(() => {
    fetch(`${API}/payment-wallets`)
      .then((response) => response.ok ? response.json() : { wallets: [] })
      .then((data) => setWallets(Array.isArray(data.wallets) ? data.wallets : []))
      .catch(() => setWallets([]));
  }, []);

  return (
    <main className="min-h-screen overflow-hidden bg-[#f7fbff] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute right-[-10rem] top-40 h-[32rem] w-[32rem] rounded-full bg-violet-200/45 blur-3xl" />
      </div>

      <nav className="relative z-10 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 text-lg font-black text-white shadow-lg shadow-cyan-500/20">SD</span>
            <span className="text-xl font-black tracking-tight">SurveyDeal<span className="text-cyan-600">.</span></span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/dashboard" className="hidden text-sm font-semibold text-slate-600 transition hover:text-slate-950 sm:inline">Dashboard</Link>
            <Link href="/admin" className="hidden text-sm font-semibold text-slate-600 transition hover:text-slate-950 sm:inline">Admin</Link>
            <Link href="/escrow/create" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-cyan-700">Create escrow</Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-700 shadow-sm"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Built for safer digital deals</div>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-[-0.04em] text-slate-950 sm:text-7xl">Trade with clarity.<br /><span className="bg-gradient-to-r from-cyan-600 via-blue-600 to-violet-600 bg-clip-text text-transparent">Settle with confidence.</span></h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">SurveyDeal Escrow gives buyers and sellers a shared, milestone-based space to fund, deliver, approve, and resolve transactions without guesswork.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/escrow/create" className="rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3.5 text-base font-extrabold text-white shadow-xl shadow-cyan-600/20 transition hover:-translate-y-0.5">Start an escrow <span className="ml-2">→</span></Link>
            <Link href="/dashboard" className="rounded-2xl border border-slate-300 bg-white px-6 py-3.5 text-base font-bold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700">Open dashboard</Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-6 text-sm font-semibold text-slate-500"><span>✓ Clear milestones</span><span>✓ Wallet-based access</span><span>✓ On-chain evidence</span></div>
        </div>

        <div className="relative">
          <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-cyan-400/20 via-blue-400/10 to-violet-400/20 blur-2xl" />
          <div className="relative rounded-[2rem] border border-white bg-white/90 p-5 shadow-2xl shadow-blue-900/10 sm:p-7">
            <div className="flex items-center justify-between border-b border-slate-100 pb-5"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Escrow workspace</p><p className="mt-1 text-lg font-black">Website redesign project</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">In progress</span></div>
            <div className="mt-6 rounded-2xl bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white"><div className="flex items-center justify-between"><span className="text-sm text-blue-200">Protected value</span><span className="text-xs text-emerald-300">● funded</span></div><p className="mt-3 text-4xl font-black">12,500 <span className="text-lg text-blue-200">USDC</span></p><div className="mt-5 h-2 rounded-full bg-white/15"><div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-cyan-300 to-violet-400" /></div><div className="mt-3 flex justify-between text-xs text-blue-200"><span>2 of 3 milestones</span><span>66% complete</span></div></div>
            <div className="mt-5 space-y-3">{["Discovery approved", "Design system delivered", "Final handoff pending"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${index < 2 ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}>{index < 2 ? "✓" : index + 1}</span><span className="text-sm font-semibold text-slate-700">{item}</span><span className="ml-auto text-xs text-slate-400">{index < 2 ? "Done" : "Waiting"}</span></div>)}</div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-slate-200 bg-white/75 py-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-5 lg:justify-between lg:px-8"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Available on leading networks</p>{CHAINS.map(([name, icon, color]) => <span key={name} className="flex items-center gap-2 text-sm font-bold text-slate-600"><span style={{ color }} className="text-lg">{icon}</span>{name}</span>)}</div></section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-20 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-700">Why SurveyDeal</p><h2 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">A better way to make a deal.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3">{FEATURES.map((feature) => <article key={feature.number} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-cyan-900/10"><span className="text-sm font-black text-cyan-600">{feature.number}</span><h3 className="mt-12 text-xl font-black">{feature.title}</h3><p className="mt-3 leading-7 text-slate-500">{feature.text}</p></article>)}</div></section>

      <section className="relative z-10 bg-slate-950 py-20 text-white"><div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-[.9fr_1.1fr] lg:px-8"><div><p className="text-sm font-black uppercase tracking-[0.18em] text-cyan-300">Payment rails</p><h2 className="mt-3 text-4xl font-black tracking-tight">Pay using the wallet your admin configures.</h2><p className="mt-5 max-w-xl leading-7 text-slate-300">When payment wallets are published, users can copy the correct address for the selected coin and network. Always verify the network before sending funds.</p><Link href="/escrow/create" className="mt-7 inline-flex rounded-xl bg-white px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-100">Create a protected deal →</Link></div><div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-7"><div className="flex items-center justify-between"><h3 className="text-lg font-black">Available payment wallets</h3><span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300">Admin managed</span></div>{wallets.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-400">Payment instructions will appear here when an administrator publishes a wallet.</div> : <div className="mt-5 space-y-3">{wallets.slice(0, 5).map((wallet) => <div key={wallet.id} className="rounded-2xl bg-white/10 p-4"><div className="flex items-center justify-between"><div><p className="font-black">{wallet.symbol} <span className="font-medium text-slate-400">on {wallet.network}</span></p><p className="mt-1 text-xs text-slate-400">{wallet.label || "Official payment wallet"}</p></div><button onClick={() => navigator.clipboard?.writeText(wallet.address)} className="rounded-lg bg-white/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-white/20">Copy</button></div><p className="mt-3 break-all rounded-xl bg-black/20 px-3 py-2 font-mono text-xs text-slate-300">{shorten(wallet.address)}</p>{wallet.instructions && <p className="mt-2 text-xs leading-5 text-slate-400">{wallet.instructions}</p>}</div>)}</div>}</div></div></section>

      <section className="relative z-10 mx-auto max-w-4xl px-5 py-20 text-center lg:px-8"><h2 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Make your next deal easier to trust.</h2><p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">Create a clear agreement, protect the payment, and give every participant a shared source of truth.</p><Link href="/escrow/create" className="mt-8 inline-flex rounded-2xl bg-slate-950 px-7 py-4 font-extrabold text-white shadow-xl transition hover:bg-cyan-700">Launch SurveyDeal Escrow →</Link></section>

      <footer className="relative z-10 border-t border-slate-200 bg-white py-7"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-slate-500 lg:px-8"><p>© 2026 SurveyDeal Escrow. Built for clearer digital deals.</p><div className="flex gap-5"><Link href="/dashboard" className="hover:text-slate-950">Dashboard</Link><Link href="/admin" className="hover:text-slate-950">Admin</Link><Link href="/escrow/create" className="font-bold text-cyan-700">Create escrow</Link></div></div></footer>
    </main>
  );
}
