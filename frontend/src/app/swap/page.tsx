"use client";

import Nav from "@/components/Nav";
import DexSwapWidget from "@/components/DexSwapWidget";

export default function SwapPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">Trade</p>
          <h2 className="text-3xl font-heading font-extrabold">Token Swap</h2>
          <p className="text-sm opacity-60 mt-1">Swap tokens using decentralized exchanges via DexScreener.</p>
        </div>
        <DexSwapWidget />
      </main>
    </div>
  );
}
