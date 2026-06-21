"use client";

import { Shield } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import DexSwapWidget from "@/components/DexSwapWidget";

export default function SwapPage() {
  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#080c14]/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">
              Survey<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">deal</span>
            </span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">Dashboard</a>
            <a href="/escrow/create" className="text-sm text-slate-400 hover:text-white transition-colors">Create Escrow</a>
            <ConnectButton />
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DexSwapWidget />
      </main>
    </div>
  );
}
