"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Shield,
  Plus,
  Wallet,
  Loader2,
  Copy,
  Check,
  Clock,
  AlertCircle,
  BarChart3,
  ArrowRightLeft,
  Filter,
  RefreshCw,
  PackageCheck,
  ShieldCheck,
  Gavel,
  RotateCcw,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import DexSwapWidget from "@/components/DexSwapWidget";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const STATE_LABELS: Record<string, string> = {
  CREATED: "Created", FUNDED: "Funded", ACTIVE: "Active",
  COMPLETED: "Completed", DISPUTED: "Disputed", REFUNDED: "Refunded",
};
const STATE_COLORS: Record<string, string> = {
  CREATED: "bg-slate-500/20 text-slate-300",
  FUNDED: "bg-blue-500/20 text-blue-300",
  ACTIVE: "bg-emerald-500/20 text-emerald-300",
  COMPLETED: "bg-green-500/20 text-green-300",
  DISPUTED: "bg-red-500/20 text-red-300",
  REFUNDED: "bg-amber-500/20 text-amber-300",
};

interface Escrow {
  id: string;
  onChainId: number;
  title: string;
  description: string;
  state: string;
  mode: string;
  totalAmount: string;
  fundedAmount: string | null;
  releasedAmount: string | null;
  deadline: string | null;
  createdAt: string;
  buyer: { walletAddress: string; displayName: string | null };
  seller: { walletAddress: string; displayName: string | null };
  token: { symbol: string; decimals: number } | null;
  milestones: { released: boolean }[];
}

interface GeneratedWallet {
  address: string;
  label: string;
  createdAt: string;
  privateKey?: string;
  mnemonic?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [jwt, setJwt] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");

  const [activeTab, setActiveTab] = useState<"escrows" | "wallets" | "activity" | "swap">("escrows");
  const [roleFilter, setRoleFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [totalEscrows, setTotalEscrows] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [wallets, setWallets] = useState<GeneratedWallet[]>([]);
  const [generatingWallet, setGeneratingWallet] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("surveydeal_jwt");
    if (stored) setJwt(stored);
  }, []);

  const authenticate = useCallback(async () => {
    if (!address || jwt || isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError("");
    try {
      const message = `Sign in to Surveydeal\nWallet: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, signature, message }),
      });
      if (!res.ok) throw new Error("Authentication failed");
      const data = await res.json();
      localStorage.setItem("surveydeal_jwt", data.token);
      setJwt(data.token);
    } catch (err: any) {
      setAuthError(err.message || "Failed to sign in");
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, jwt, isAuthenticating, signMessageAsync]);

  useEffect(() => {
    if (isConnected && address && !jwt && !isAuthenticating) {
      authenticate();
    }
  }, [isConnected, address, jwt, isAuthenticating, authenticate]);

  const fetchEscrows = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (roleFilter) params.set("role", roleFilter);
      if (stateFilter) params.set("state", stateFilter);
      const res = await fetch(`${API}/escrows?${params}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("surveydeal_jwt");
        setJwt(null);
        return;
      }
      const data = await res.json();
      setEscrows(data.escrows || []);
      setTotalEscrows(data.pagination?.total || 0);
    } catch {} finally {
      setLoading(false);
    }
  }, [jwt, page, roleFilter, stateFilter]);

  useEffect(() => {
    if (jwt) fetchEscrows();
  }, [jwt, fetchEscrows]);

  async function generateWallet() {
    if (!jwt) return;
    setGeneratingWallet(true);
    try {
      const res = await fetch(`${API}/wallets/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ label: `Wallet ${wallets.length + 1}` }),
      });
      const data = await res.json();
      if (data.wallet) {
        setWallets((prev) => [data.wallet, ...prev]);
      }
    } catch {} finally {
      setGeneratingWallet(false);
    }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(""), 2000);
  }

  function getRole(escrow: Escrow): string {
    if (!address) return "";
    const addr = address.toLowerCase();
    if (escrow.buyer?.walletAddress?.toLowerCase() === addr) return "Buyer";
    if (escrow.seller?.walletAddress?.toLowerCase() === addr) return "Seller";
    return "Arbiter";
  }

  const stats = {
    total: totalEscrows,
    active: escrows.filter((e) => e.state === "ACTIVE").length,
    disputed: escrows.filter((e) => e.state === "DISPUTED").length,
    completed: escrows.filter((e) => e.state === "COMPLETED").length,
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#080c14]/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Survey<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">deal</span></span>
          </a>
          <div className="flex items-center gap-4">
            <a href="/escrow/create" className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Escrow
            </a>
            <ConnectButton />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

        {/* Connect/Auth Prompt */}
        {!isConnected && (
          <div className="mb-8 p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h2>
            <p className="text-slate-400 text-sm mb-4">Connect your wallet to view your escrows, generate wallets, and manage deals.</p>
            <ConnectButton />
          </div>
        )}

        {isConnected && !jwt && (
          <div className="mb-8 p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center">
            {isAuthenticating ? (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-white mb-1">Signing In...</h2>
                <p className="text-sm text-slate-400">Please sign the message in your wallet to authenticate.</p>
              </>
            ) : (
              <>
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-white mb-1">Authentication Required</h2>
                <p className="text-sm text-slate-400 mb-4">{authError || "Sign a message with your wallet to access your dashboard."}</p>
                <button onClick={authenticate} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 transition-opacity">
                  Sign In with Wallet
                </button>
              </>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Escrows", value: stats.total, icon: ArrowRightLeft, color: "emerald" },
            { label: "Active Deals", value: stats.active, icon: PackageCheck, color: "blue" },
            { label: "Disputed", value: stats.disputed, icon: Gavel, color: "red" },
            { label: "Completed", value: stats.completed, icon: ShieldCheck, color: "green" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider">{label}</span>
                <Icon className={`w-4 h-4 text-${color}-400`} />
              </div>
              <span className="text-2xl font-bold text-white">{value}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-lg bg-white/[0.03] border border-white/5 w-fit">
          {(["escrows", "wallets", "swap", "activity"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${activeTab === tab ? "bg-emerald-500/20 text-emerald-400" : "text-slate-400 hover:text-white"}`}>
              {tab === "escrows" ? "My Escrows" : tab === "wallets" ? "My Wallets" : tab === "swap" ? "DEX Swap" : "Activity"}
            </button>
          ))}
        </div>

        {/* Escrows Tab */}
        {activeTab === "escrows" && (
          <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-slate-300 focus:border-emerald-500/50 focus:outline-none">
                <option value="">All Roles</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="arbiter">Arbiter</option>
              </select>
              <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-slate-300 focus:border-emerald-500/50 focus:outline-none">
                <option value="">All States</option>
                {Object.keys(STATE_LABELS).map((s) => (
                  <option key={s} value={s}>{STATE_LABELS[s]}</option>
                ))}
              </select>
              <button onClick={fetchEscrows} className="px-3 py-2 rounded-lg border border-white/10 text-slate-400 hover:bg-white/5 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
              </div>
            ) : escrows.length === 0 ? (
              <div className="text-center py-20">
                <ArrowRightLeft className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No Escrows Yet</h3>
                <p className="text-slate-400 mb-6">Create your first escrow deal to get started.</p>
                <a href="/escrow/create" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4" /> Create Escrow
                </a>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {escrows.map((escrow) => {
                  const role = getRole(escrow);
                  const releasedMs = escrow.milestones?.filter((m) => m.released).length || 0;
                  const totalMs = escrow.milestones?.length || 0;
                  const counterparty = role === "Buyer" ? escrow.seller : escrow.buyer;

                  return (
                    <button key={escrow.id} onClick={() => router.push(`/escrow/${escrow.onChainId}`)} className="p-5 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all text-left group">
                      <div className="flex items-center justify-between mb-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATE_COLORS[escrow.state]}`}>
                          {STATE_LABELS[escrow.state]}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${role === "Buyer" ? "bg-purple-500/10 text-purple-400" : role === "Seller" ? "bg-orange-500/10 text-orange-400" : "bg-pink-500/10 text-pink-400"}`}>
                          {role}
                        </span>
                      </div>
                      <h3 className="font-semibold text-white mb-1 truncate group-hover:text-emerald-400 transition-colors">
                        {escrow.title || `Escrow #${escrow.onChainId}`}
                      </h3>
                      <p className="text-sm text-slate-500 mb-3">
                        with {counterparty?.walletAddress ? `${counterparty.walletAddress.slice(0, 6)}...${counterparty.walletAddress.slice(-4)}` : "Unknown"}
                      </p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">
                          {escrow.token?.symbol || "TOKEN"} {escrow.totalAmount ? (Number(escrow.totalAmount) / 1e18).toFixed(2) : "0"}
                        </span>
                        <span className="text-slate-500">{releasedMs}/{totalMs} milestones</span>
                      </div>
                      {totalMs > 0 && (
                        <div className="w-full h-1 rounded-full bg-white/5 mt-3 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(releasedMs / totalMs) * 100}%` }} />
                        </div>
                      )}
                      {escrow.deadline && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {new Date(escrow.deadline).toLocaleDateString()}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {totalEscrows > 12 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-slate-400 hover:bg-white/5 disabled:opacity-30">
                  Previous
                </button>
                <span className="text-sm text-slate-500">Page {page}</span>
                <button onClick={() => setPage(page + 1)} disabled={escrows.length < 12} className="px-3 py-1.5 rounded-lg border border-white/10 text-sm text-slate-400 hover:bg-white/5 disabled:opacity-30">
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* Wallets Tab */}
        {activeTab === "wallets" && (
          <div>
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02] mb-6">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-400" /> Connected Wallet
              </h3>
              <div className="flex items-center gap-2">
                <code className="text-sm text-emerald-400 font-mono">{address}</code>
                <button onClick={() => copyText(address!)} className="p-1 rounded hover:bg-white/5 transition-colors">
                  {copied === address ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Generated Wallets</h3>
              <button onClick={generateWallet} disabled={generatingWallet} className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-sm flex items-center gap-2 disabled:opacity-50">
                {generatingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Generate Wallet
              </button>
            </div>

            {wallets.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Wallet className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No wallets generated yet. Click &quot;Generate Wallet&quot; to create one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wallets.map((w, i) => (
                  <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-white">{w.label}</span>
                      <span className="text-xs text-slate-500">{new Date(w.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-emerald-400 font-mono break-all">{w.address}</code>
                      <button onClick={() => copyText(w.address)} className="p-1 rounded hover:bg-white/5 transition-colors shrink-0">
                        {copied === w.address ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-500" />}
                      </button>
                    </div>
                    {w.privateKey && (
                      <details className="mt-2">
                        <summary className="text-xs text-amber-400 cursor-pointer">Show Private Key (dev only)</summary>
                        <code className="text-xs text-amber-300 font-mono break-all block mt-1">{w.privateKey}</code>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DEX Swap Tab */}
        {activeTab === "swap" && (
          <div className="max-w-2xl">
            <DexSwapWidget />
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === "activity" && (
          <div>
            {escrows.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No activity yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {escrows.map((escrow) => (
                  <button key={escrow.id} onClick={() => router.push(`/escrow/${escrow.onChainId}`)} className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors flex items-center gap-4 text-left">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${escrow.state === "ACTIVE" ? "bg-emerald-500/20" : escrow.state === "DISPUTED" ? "bg-red-500/20" : escrow.state === "COMPLETED" ? "bg-green-500/20" : "bg-slate-500/20"}`}>
                      {escrow.state === "ACTIVE" ? <PackageCheck className="w-5 h-5 text-emerald-400" /> : escrow.state === "DISPUTED" ? <Gavel className="w-5 h-5 text-red-400" /> : escrow.state === "COMPLETED" ? <ShieldCheck className="w-5 h-5 text-green-400" /> : <Clock className="w-5 h-5 text-slate-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-white truncate">{escrow.title || `Escrow #${escrow.onChainId}`}</h4>
                      <p className="text-xs text-slate-500">{STATE_LABELS[escrow.state]} · {new Date(escrow.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm text-slate-400 shrink-0">
                      {escrow.token?.symbol || "TOKEN"} {escrow.totalAmount ? (Number(escrow.totalAmount) / 1e18).toFixed(2) : "0"}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
