"use client";

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, CircleHelp, Copy, FileCheck2, LockKeyhole, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

type PaymentWallet = {
  id: string;
  symbol: string;
  network: string;
  address: string;
  label?: string;
  instructions?: string;
  isActive: boolean;
};

const WORKFLOWS = [
  { icon: FileCheck2, step: "01", title: "Agree on the work", text: "Write the outcome, price, deadline, and milestones before a wallet moves." },
  { icon: LockKeyhole, step: "02", title: "Fund the deal", text: "The buyer funds the agreed amount. Both sides can see what is protected and what is next." },
  { icon: ShieldCheck, step: "03", title: "Release with proof", text: "Delivery, approval, and release happen milestone by milestone — not in a chat thread." },
];

const FAQ = [
  ["Who is SurveyDeal for?", "Freelancers, agencies, founders, and crypto-native teams who want a cleaner way to run paid digital work."],
  ["What does SurveyDeal charge?", "The pilot model is a 1% success fee on released funds, with no monthly subscription. Exact fee settings are shown before signing and can be configured by the operator."],
  ["Is SurveyDeal live on every chain?", "No. Supported networks and deployment status should be checked in the app before funding. The interface will not pretend that an unverified adapter is production-ready."],
  ["What happens when something goes wrong?", "Deals can use locked two-party approval or an arbiter mode. Evidence, deadlines, and the resolution path are kept with the agreement."],
];

function shorten(address: string) {
  return address.length > 18 ? `${address.slice(0, 10)}…${address.slice(-8)}` : address;
}

export default function LandingPage() {
  const [wallets, setWallets] = useState<PaymentWallet[]>([]);
  const [openFaq, setOpenFaq] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/payment-wallets`)
      .then((response) => (response.ok ? response.json() : { wallets: [] }))
      .then((data) => setWallets(Array.isArray(data.wallets) ? data.wallets : []))
      .catch(() => setWallets([]));
  }, []);

  const copyWallet = async (wallet: PaymentWallet) => {
    await navigator.clipboard?.writeText(wallet.address);
    setCopied(wallet.id);
    window.setTimeout(() => setCopied(null), 1800);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f4ef] text-[#14221f]">
      <div className="pointer-events-none fixed inset-0 -z-0 opacity-60" aria-hidden="true">
        <div className="absolute -left-32 -top-48 h-[32rem] w-[32rem] rounded-full bg-[#bfe6dc] blur-3xl" />
        <div className="absolute right-[-14rem] top-[32rem] h-[38rem] w-[38rem] rounded-full bg-[#d9d8f6] blur-3xl" />
      </div>

      <nav className="relative z-10 border-b border-[#14221f]/10 bg-[#f6f4ef]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="SurveyDeal home">
            <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#14221f] text-sm font-black tracking-tight text-[#f6f4ef] shadow-[4px_4px_0_#9acfc2]">SD</span>
            <span className="text-xl font-black tracking-[-0.04em]">SurveyDeal<span className="text-[#2f7d6e]">.</span></span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-7">
            <a href="#how-it-works" className="hidden text-sm font-semibold text-[#53635f] transition hover:text-[#14221f] sm:inline">How it works</a>
            <a href="#pricing" className="hidden text-sm font-semibold text-[#53635f] transition hover:text-[#14221f] sm:inline">Pricing</a>
            <Link href="/dashboard" className="hidden text-sm font-semibold text-[#53635f] transition hover:text-[#14221f] md:inline">Dashboard</Link>
            <Link href="/escrow/create" className="rounded-xl bg-[#14221f] px-4 py-2.5 text-sm font-bold text-white shadow-[3px_3px_0_#9acfc2] transition hover:-translate-y-0.5 hover:bg-[#2f7d6e]">Create a deal</Link>
          </div>
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 lg:grid-cols-[.92fr_1.08fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#2f7d6e]/25 bg-[#e3f1ec] px-3.5 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#2f7d6e]"><Sparkles className="h-3.5 w-3.5" /> The deal layer for digital work</div>
          <h1 className="max-w-2xl font-serif text-5xl font-bold leading-[.96] tracking-[-0.055em] text-[#14221f] sm:text-7xl">Good work deserves a <em className="text-[#2f7d6e]">better</em> deal.</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[#53635f]">SurveyDeal makes freelance, agency, and token-funded work easier to start — and much harder to misunderstand.</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href="/escrow/create" className="inline-flex items-center gap-2 rounded-2xl bg-[#2f7d6e] px-6 py-3.5 text-base font-extrabold text-white shadow-[5px_5px_0_#b7d9d1] transition hover:-translate-y-0.5 hover:bg-[#246456]">Start a protected deal <ArrowRight className="h-4 w-4" /></Link>
            <Link href="/dashboard" className="rounded-2xl border border-[#14221f]/20 bg-white/60 px-6 py-3.5 text-base font-bold text-[#14221f] transition hover:border-[#2f7d6e] hover:bg-white">See the workspace</Link>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-[#53635f]"><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#2f7d6e]" />Milestones first</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#2f7d6e]" />Clear fee preview</span><span className="flex items-center gap-2"><Check className="h-4 w-4 text-[#2f7d6e]" />Evidence stays attached</span></div>
        </div>

        <div className="relative lg:pl-8">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-[#b7d9d1]/50 blur-2xl" />
          <div className="relative rotate-[1deg] rounded-[2rem] border border-[#14221f]/10 bg-[#fffdfa] p-5 shadow-[12px_14px_0_#d8ded9] sm:p-7">
            <div className="flex items-start justify-between border-b border-[#14221f]/10 pb-5"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8b9892]">Live deal preview</p><p className="mt-1 text-xl font-black tracking-tight">Brand identity sprint</p><p className="mt-1 text-sm text-[#73807b]">Northstar Studio ↔ Kora Labs</p></div><span className="rounded-full bg-[#fff0c7] px-3 py-1.5 text-xs font-bold text-[#986e09]">Awaiting delivery</span></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[#14221f] p-4 text-white sm:col-span-2"><div className="flex items-center justify-between text-xs text-[#b8cdc6]"><span>Protected value</span><span className="text-[#9ce0c8]">● Funded</span></div><p className="mt-3 text-4xl font-black tracking-tight">4,800 <span className="text-base font-bold text-[#b8cdc6]">USDC</span></p><div className="mt-5 flex gap-1"><span className="h-2 flex-1 rounded-full bg-[#71c7af]" /><span className="h-2 flex-1 rounded-full bg-[#71c7af]" /><span className="h-2 flex-1 rounded-full bg-white/15" /></div><p className="mt-2 text-xs text-[#b8cdc6]">2 of 3 milestones ready</p></div><div className="rounded-2xl bg-[#e3f1ec] p-4"><WalletCards className="h-5 w-5 text-[#2f7d6e]" /><p className="mt-6 text-xs font-bold uppercase tracking-[0.13em] text-[#66837a]">Next move</p><p className="mt-1 font-black leading-5 text-[#245a4e]">Seller delivers final files</p></div></div>
            <div className="mt-5 space-y-3">{["Brief & moodboard", "Visual direction", "Final files + handoff"].map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl border border-[#14221f]/10 bg-[#f7f7f3] px-4 py-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${index < 2 ? "bg-[#d7eee5] text-[#2f7d6e]" : "bg-white text-[#8b9892] ring-1 ring-[#14221f]/10"}`}>{index < 2 ? <Check className="h-4 w-4" /> : index + 1}</span><span className="text-sm font-semibold text-[#3f504a]">{item}</span><span className="ml-auto text-xs font-bold text-[#8b9892]">{index < 2 ? "Approved" : "Next"}</span></div>)}</div>
            <div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#73807b]"><ShieldCheck className="h-4 w-4 text-[#2f7d6e]" /> Terms, approvals, and release history are attached to this deal.</div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-[#14221f]/10 bg-[#fffdfa]/80"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 lg:px-8"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#8b9892]">For the people who ship on trust</p><div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-bold text-[#53635f]"><span>Freelancers</span><span>Product studios</span><span>DAO contributors</span><span>OTC teams</span><span>Founders</span></div></div></section>

      <section id="how-it-works" className="relative z-10 mx-auto max-w-7xl px-5 py-24 lg:px-8"><div className="max-w-2xl"><p className="text-sm font-black uppercase tracking-[0.16em] text-[#2f7d6e]">Less chasing. More shipping.</p><h2 className="mt-3 font-serif text-4xl font-bold tracking-[-0.04em] text-[#14221f] sm:text-5xl">The shared source of truth your deal was missing.</h2></div><div className="mt-12 grid gap-5 md:grid-cols-3">{WORKFLOWS.map(({ icon: Icon, step, title, text }) => <article key={step} className="group rounded-3xl border border-[#14221f]/10 bg-[#fffdfa] p-7 transition hover:-translate-y-1 hover:shadow-[7px_8px_0_#d8ded9]"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e3f1ec] text-[#2f7d6e]"><Icon className="h-5 w-5" /></span><span className="font-serif text-3xl font-bold text-[#c7d2ce]">{step}</span></div><h3 className="mt-12 text-xl font-black tracking-tight">{title}</h3><p className="mt-3 leading-7 text-[#66736e]">{text}</p></article>)}</div></section>

      <section id="pricing" className="relative z-10 bg-[#14221f] py-20 text-white"><div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[1fr_.85fr] lg:items-center lg:px-8"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-[#9ce0c8]">Simple pilot pricing</p><h2 className="mt-3 max-w-xl font-serif text-4xl font-bold tracking-[-0.04em] sm:text-5xl">We only win when your deal moves forward.</h2><p className="mt-5 max-w-xl leading-7 text-[#b8cdc6]">Start without a monthly subscription. SurveyDeal’s operator model is a small success fee on released funds, with the exact amount shown before anyone signs.</p><div className="mt-8 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-3xl font-black">1%</p><p className="mt-1 text-sm text-[#b8cdc6]">on released funds during the pilot</p></div><div className="rounded-2xl border border-white/10 bg-white/5 p-5"><p className="text-3xl font-black">£0</p><p className="mt-1 text-sm text-[#b8cdc6]">monthly platform subscription</p></div></div></div><div className="rounded-3xl border border-white/10 bg-[#203630] p-6 sm:p-8"><div className="flex items-center gap-3"><CircleHelp className="h-5 w-5 text-[#9ce0c8]" /><p className="font-bold">What happens next?</p></div><ol className="mt-6 space-y-5">{["Create the terms", "Invite the other party", "Fund and track milestones", "Release when the work is accepted"].map((item, i) => <li key={item} className="flex items-center gap-3 text-sm text-[#d7e6e1]"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9ce0c8] text-xs font-black text-[#14221f]">{i + 1}</span>{item}</li>)}</ol><Link href="/escrow/create" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#f6f4ef] px-5 py-3 font-bold text-[#14221f] transition hover:bg-[#d7eee5]">Build your first deal <ArrowRight className="h-4 w-4" /></Link></div></div></section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-5 py-24 lg:grid-cols-[.9fr_1.1fr] lg:px-8"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-[#2f7d6e]">Clear answers</p><h2 className="mt-3 font-serif text-4xl font-bold tracking-[-0.04em] text-[#14221f]">Before you trust us with a deal.</h2><p className="mt-5 max-w-md leading-7 text-[#66736e]">We would rather be precise than impressive. Here is what the current product does — and what to check before funding.</p></div><div className="divide-y divide-[#14221f]/10 rounded-3xl border border-[#14221f]/10 bg-[#fffdfa] px-6">{FAQ.map(([question, answer], index) => <div key={question} className="py-5"><button className="flex w-full items-center justify-between gap-4 text-left font-black" onClick={() => setOpenFaq(openFaq === index ? -1 : index)} aria-expanded={openFaq === index}>{question}<ChevronDown className={`h-5 w-5 shrink-0 text-[#2f7d6e] transition ${openFaq === index ? "rotate-180" : ""}`} /></button>{openFaq === index && <p className="mt-3 max-w-2xl pr-8 text-sm leading-6 text-[#66736e]">{answer}</p>}</div>)}</div></section>

      {wallets.length > 0 && <section className="relative z-10 border-t border-[#14221f]/10 bg-[#eaf2ee] py-16"><div className="mx-auto max-w-7xl px-5 lg:px-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-black uppercase tracking-[0.16em] text-[#2f7d6e]">Published payment rails</p><h2 className="mt-2 font-serif text-3xl font-bold tracking-tight">Use the right asset on the right network.</h2></div><p className="max-w-sm text-sm leading-6 text-[#66736e]">Always verify the network before sending. A payment wallet is not the same thing as smart-contract escrow funding.</p></div><div className="mt-8 grid gap-3 md:grid-cols-3">{wallets.slice(0, 3).map((wallet) => <div key={wallet.id} className="rounded-2xl border border-[#14221f]/10 bg-[#fffdfa] p-4"><div className="flex items-center justify-between"><p className="font-black">{wallet.symbol} <span className="font-medium text-[#73807b]">on {wallet.network}</span></p><button onClick={() => copyWallet(wallet)} className="inline-flex items-center gap-1 rounded-lg bg-[#e3f1ec] px-3 py-2 text-xs font-bold text-[#2f7d6e]">{copied === wallet.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied === wallet.id ? "Copied" : "Copy"}</button></div><p className="mt-3 break-all rounded-xl bg-[#f6f4ef] px-3 py-2 font-mono text-xs text-[#66736e]">{shorten(wallet.address)}</p></div>)}</div></div></section>}

      <footer className="relative z-10 border-t border-[#14221f]/10 bg-[#f6f4ef] py-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-[#73807b] lg:px-8"><p>© 2026 SurveyDeal. Built for clearer digital deals.</p><div className="flex gap-5"><Link href="/dashboard" className="transition hover:text-[#14221f]">Dashboard</Link><Link href="/escrow/create" className="font-bold text-[#2f7d6e]">Create a deal <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link></div></div><div className="mx-auto mt-5 max-w-7xl px-5 text-xs leading-5 text-[#8b9892] lg:px-8">SurveyDeal is a software product, not legal or financial advice. Check the supported network, deployment status, fee preview, and risk disclosures before funding a live transaction.</div></footer>
    </main>
  );
}
