"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Plus,
  X,
  Check,
  Search,
  AlertTriangle,
  Shield,
} from "lucide-react";
import WalletLogin from "@/components/WalletLogin";
import Nav from "@/components/Nav";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const CHAINS = [
  { id: "ETHEREUM", name: "Ethereum", abbr: "ETH", chainId: 1, nativeCurrency: "ETH" },
  { id: "BNB_CHAIN", name: "BNB Chain", abbr: "BNB", chainId: 56, nativeCurrency: "BNB" },
  { id: "POLYGON", name: "Polygon", abbr: "POL", chainId: 137, nativeCurrency: "MATIC" },
  { id: "ARBITRUM", name: "Arbitrum", abbr: "ARB", chainId: 42161, nativeCurrency: "ETH" },
  { id: "BASE", name: "Base", abbr: "BASE", chainId: 8453, nativeCurrency: "ETH" },
  { id: "AVALANCHE", name: "Avalanche", abbr: "AVAX", chainId: 43114, nativeCurrency: "AVAX" },
  { id: "OPTIMISM", name: "Optimism", abbr: "OP", chainId: 10, nativeCurrency: "ETH" },
  { id: "FANTOM", name: "Fantom", abbr: "FTM", chainId: 250, nativeCurrency: "FTM" },
];

interface Wallet_ {
  id: string;
  address: string;
  network: string;
  label?: string;
  isPreferred: boolean;
}

interface TokenResult {
  address: string;
  name: string;
  symbol: string;
  chainId: number;
  logoUrl?: string;
  price?: number;
  volume24h?: number;
  liquidity?: number;
  priceChange24h?: number;
}

interface Milestone {
  description: string;
  amount: string;
}

export default function CreateEscrowPage() {
  const [token, setToken] = useState("");
  const [step, setStep] = useState(1);

  const [selectedChain, setSelectedChain] = useState(CHAINS[1]);
  const [sellerAddress, setSellerAddress] = useState("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenResults, setTokenResults] = useState<TokenResult[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenResult | null>(null);
  const [totalAmount, setTotalAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState(0);
  const [arbiterAddress, setArbiterAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([{ description: "", amount: "" }]);
  const [userWallets, setUserWallets] = useState<Wallet_[]>([]);
  const [preferredWallet, setPreferredWallet] = useState<Wallet_ | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user_token");
    if (stored) {
      setToken(stored);
      fetch(`${API}/wallets`, {
        headers: { Authorization: `Bearer ${stored}` },
      })
        .then((r) => r.json())
        .then((data) => {
          setUserWallets(Array.isArray(data) ? data : []);
          const preferred = data.find((w: Wallet_) => w.isPreferred && w.network === selectedChain.id);
          if (preferred) setPreferredWallet(preferred);
        })
        .catch(() => {});
    }
  }, []);

  const searchTokens = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTokenResults([]);
      return;
    }
    try {
      const res = await fetch(`https://api.dexscreener.com/dex/search/v1/?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const pairs = data.pairs || [];
      const uniqueTokens: TokenResult[] = [];
      const seen = new Set<string>();

      for (const pair of pairs) {
        const key = `${pair.baseToken?.address}-${pair.chainId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        uniqueTokens.push({
          address: pair.baseToken?.address || "",
          name: pair.baseToken?.name || "Unknown",
          symbol: pair.baseToken?.symbol || "???",
          chainId: ({ bsc: 56, ethereum: 1, polygon: 137, arbitrum: 42161, base: 8453, avalanche: 43114, optimism: 10, fantom: 250 } as Record<string, number>)[pair.chainId] || 0,
          price: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
          volume24h: pair.volume?.h24,
          liquidity: pair.liquidity?.usd,
          priceChange24h: pair.priceChange?.h24,
        });

        if (uniqueTokens.length >= 10) break;
      }

      setTokenResults(uniqueTokens);
    } catch (err) {
      console.error("Token search failed", err);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => searchTokens(tokenSearch), 400);
    return () => clearTimeout(debounce);
  }, [tokenSearch, searchTokens]);

  const addMilestone = () => {
    setMilestones([...milestones, { description: "", amount: "" }]);
  };
  const removeMilestone = (index: number) => {
    if (milestones.length > 1) {
      setMilestones(milestones.filter((_, i) => i !== index));
    }
  };
  const updateMilestone = (index: number, field: keyof Milestone, value: string) => {
    const updated = [...milestones];
    updated[index] = { ...updated[index], [field]: value };
    setMilestones(updated);
  };

  const milestoneTotal = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  const handleSubmit = async () => {
    if (!sellerAddress || !selectedToken || !totalAmount || !title || milestoneTotal === 0) {
      setError("Please fill all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/escrows`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          chainId: selectedChain.chainId,
          network: selectedChain.id,
          title,
          description,
          sellerWallet: sellerAddress,
          arbiterWallet: mode === 1 ? arbiterAddress : undefined,
          tokenAddress: selectedToken.address,
          totalAmount,
          mode,
          deadline: deadline || undefined,
          milestones: milestones.filter((m) => m.description && m.amount),
        }),
      });

      const data = await res.json();
      if (data.id) {
        setSuccess(`Escrow created! ID: ${data.id}`);
        setTimeout(() => {
          window.location.href = `/escrow/${data.id}`;
        }, 2000);
      } else {
        setError(data.error || "Failed to create escrow");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  const steps = [
    { num: 1, label: "Network & Token" },
    { num: 2, label: "Details" },
    { num: 3, label: "Milestones" },
    { num: 4, label: "Review" },
  ];

  const amountsMatch = Math.abs(milestoneTotal - parseFloat(totalAmount || "0")) < 0.0001;

  if (!token) {
    return <WalletLogin onAuthenticated={(t) => setToken(t)} />;
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">New Escrow</p>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-text">Create Escrow</h1>
          </div>
          <Link href="/dashboard" className="btn btn-ghost text-left">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="grid grid-cols-4 border-2 border-divider mb-10">
          {steps.map((s, i) => {
            const isCurrent = step === s.num;
            const isDone = step > s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center gap-2 px-2 sm:px-3 py-3 ${
                  i < steps.length - 1 ? "border-r-2 border-divider" : ""
                } ${isCurrent ? "bg-accent text-white" : isDone ? "bg-accent-100" : "bg-bg"}`}
              >
                <div
                  className={`w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isCurrent
                      ? "bg-white text-accent"
                      : isDone
                      ? "bg-accent text-white"
                      : "bg-divider text-text opacity-60"
                  }`}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" /> : s.num}
                </div>
                <span
                  className={`text-xs font-semibold hidden sm:inline ${
                    isCurrent ? "text-white" : isDone ? "text-accent-700" : "text-text opacity-50"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Error/Success */}
        {error && (
          <div className="border-2 border-accent bg-accent/5 text-accent px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="border-2 border-green-600 bg-green-600/5 text-green-700 px-4 py-3 mb-6 text-sm">
            {success}
          </div>
        )}

        {/* STEP 1: Network & Token */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-heading font-extrabold mb-1">Select Network</h2>
              <p className="text-sm opacity-60">Choose the blockchain for this escrow</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain)}
                  className={`flex flex-col items-center gap-2 p-4 border-2 transition-colors ${
                    selectedChain.id === chain.id
                      ? "border-accent bg-accent/5"
                      : "border-divider hover:border-text/30"
                  }`}
                >
                  <div className="w-7 h-7 border-2 border-divider flex items-center justify-center text-[10px] font-bold">
                    {chain.abbr}
                  </div>
                  <span className="text-sm font-semibold">{chain.name}</span>
                  <span className="text-xs opacity-50">{chain.nativeCurrency}</span>
                </button>
              ))}
            </div>

            {/* Token Search */}
            <div>
              <h3 className="text-base font-heading font-extrabold mb-1">Search Token</h3>
              <p className="text-sm opacity-60 mb-3">
                Search by token name or contract address — powered by DexScreener
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                <input
                  type="text"
                  placeholder="Enter token name or CA (e.g. PEPE, BONK, 0x...)"
                  value={tokenSearch}
                  onChange={(e) => setTokenSearch(e.target.value)}
                  className="sd-input pl-10 w-full"
                />
              </div>

              {tokenResults.length > 0 && (
                <div className="mt-3 space-y-1 max-h-64 overflow-y-auto border-2 border-divider">
                  {tokenResults.map((t, i) => (
                    <button
                      key={`${t.address}-${i}`}
                      onClick={() => {
                        setSelectedToken(t);
                        setTokenSearch(`${t.symbol} — ${t.name}`);
                        setTokenResults([]);
                      }}
                      className={`w-full flex items-center justify-between p-3 transition-colors ${
                        selectedToken?.address === t.address
                          ? "bg-accent/5"
                          : "hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-divider flex items-center justify-center text-xs font-bold">
                          {t.symbol.slice(0, 3)}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold">
                            {t.symbol} <span className="opacity-50 font-normal">{t.name}</span>
                          </p>
                          <p className="text-xs opacity-40 font-mono">
                            {t.address.slice(0, 10)}...{t.address.slice(-6)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {t.price !== undefined && (
                          <p className="text-sm">${t.price < 0.01 ? t.price.toPrecision(3) : t.price.toFixed(2)}</p>
                        )}
                        {t.priceChange24h !== undefined && (
                          <p className={`text-xs ${t.priceChange24h >= 0 ? "text-green-600" : "text-accent"}`}>
                            {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedToken && (
                <div className="mt-3 p-4 border-2 border-accent bg-accent/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedToken.symbol} — {selectedToken.name}</p>
                      <p className="text-xs opacity-50 font-mono mt-1">CA: {selectedToken.address}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedToken(null); setTokenSearch(""); }}
                      className="text-xs opacity-60 hover:opacity-100 transition-opacity"
                    >
                      Change
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    {selectedToken.price !== undefined && (
                      <div>
                        <p className="text-xs opacity-50">Price</p>
                        <p className="text-sm font-semibold">${selectedToken.price < 0.01 ? selectedToken.price.toPrecision(3) : selectedToken.price.toFixed(2)}</p>
                      </div>
                    )}
                    {selectedToken.volume24h !== undefined && (
                      <div>
                        <p className="text-xs opacity-50">24h Volume</p>
                        <p className="text-sm font-semibold">${(selectedToken.volume24h / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                    {selectedToken.liquidity !== undefined && (
                      <div>
                        <p className="text-xs opacity-50">Liquidity</p>
                        <p className="text-sm font-semibold">${(selectedToken.liquidity / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => selectedToken && setStep(2)}
              disabled={!selectedToken}
              className="btn btn-primary w-full disabled:opacity-40"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 2: Details */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-heading font-extrabold mb-1">Escrow Details</h2>
              <p className="text-sm opacity-60">Set up the trade terms</p>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Buy 1M PEPE tokens"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="sd-input w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Seller Wallet Address *</label>
                  <input
                    type="text"
                    placeholder={`Seller's ${selectedChain.nativeCurrency} wallet address (0x...)`}
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                    className="sd-input w-full font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea
                  placeholder="Describe the trade terms..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="sd-input w-full resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold mb-1">
                    Total Amount ({selectedToken?.symbol}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    className="sd-input w-full font-heading font-extrabold text-lg"
                  />
                  {selectedToken?.price && totalAmount && (
                    <p className="text-xs opacity-50 mt-1">
                      ≈ ${(parseFloat(totalAmount) * selectedToken.price).toFixed(2)} USD
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">Deadline (optional)</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="sd-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2">Escrow Mode</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setMode(0)}
                    className={`text-left p-4 border-2 transition-colors ${
                      mode === 0
                        ? "bg-accent text-white border-accent"
                        : "bg-bg border-divider hover:border-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Shield className="w-5 h-5" />
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase border-2 ${
                          mode === 0 ? "border-white text-white" : "border-divider text-text"
                        }`}
                      >
                        2-OF-2
                      </span>
                    </div>
                    <p className="font-heading font-extrabold mb-1">Locked Mode</p>
                    <p className={`text-xs ${mode === 0 ? "text-white/80" : "opacity-60"}`}>
                      Both parties must cooperate. No third-party intervention.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode(1)}
                    className={`text-left p-4 border-2 transition-colors ${
                      mode === 1
                        ? "bg-accent text-white border-accent"
                        : "bg-bg border-divider hover:border-accent"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <ArrowLeftRight className="w-5 h-5" />
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase border-2 ${
                          mode === 1 ? "border-white text-white" : "border-divider text-text"
                        }`}
                      >
                        2-OF-3
                      </span>
                    </div>
                    <p className="font-heading font-extrabold mb-1">Arbiter Mode</p>
                    <p className={`text-xs ${mode === 1 ? "text-white/80" : "opacity-60"}`}>
                      Trusted arbiter resolves disputes.
                    </p>
                  </button>
                </div>
              </div>

              {mode === 1 && (
                <div>
                  <label className="block text-sm font-semibold mb-1">Arbiter Wallet Address</label>
                  <input
                    type="text"
                    placeholder="Neutral third-party wallet address"
                    value={arbiterAddress}
                    onChange={(e) => setArbiterAddress(e.target.value)}
                    className="sd-input w-full font-mono text-sm"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="btn btn-secondary">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => sellerAddress && totalAmount && title && setStep(3)}
                disabled={!sellerAddress || !totalAmount || !title}
                className="btn btn-primary flex-1 disabled:opacity-40"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Milestones */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-heading font-extrabold mb-1">Payment Milestones</h2>
              <p className="text-sm opacity-60">
                Split the payment into stages. Funds release as each milestone is completed.
              </p>
            </div>

            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3 p-4 border-2 border-divider bg-surface">
                  <span className="w-8 h-8 bg-accent flex items-center justify-center text-sm font-bold text-white flex-shrink-0 mt-1">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      placeholder="Milestone description (e.g. 'Deliver wallet seed phrase')"
                      value={m.description}
                      onChange={(e) => updateMilestone(i, "description", e.target.value)}
                      className="sd-input w-full"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder={`Amount in ${selectedToken?.symbol}`}
                      value={m.amount}
                      onChange={(e) => updateMilestone(i, "amount", e.target.value)}
                      className="sd-input w-full"
                    />
                  </div>
                  {milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(i)}
                      className="text-accent hover:opacity-70 transition-opacity mt-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addMilestone}
              className="w-full border-2 border-dashed border-divider hover:border-text/30 py-3 transition-colors text-sm flex items-center justify-center gap-1 opacity-60 hover:opacity-100"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </button>

            {/* Total Check */}
            <div className="p-4 bg-accent-100 border-2 border-accent">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-accent-700">Milestone Total</span>
                <span className="font-heading font-extrabold text-accent-700">
                  {milestoneTotal.toFixed(6)} {selectedToken?.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t-2 border-accent/20">
                <span className="text-sm font-semibold text-accent-700">Escrow Total</span>
                <span className="font-heading font-extrabold text-accent-700">
                  {parseFloat(totalAmount || "0").toFixed(6)} {selectedToken?.symbol}
                </span>
              </div>
            </div>

            {!amountsMatch && (
              <div className="flex items-center gap-2 border-2 border-yellow-600 bg-yellow-600/5 px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-yellow-700 flex-shrink-0" />
                <p className="text-xs text-yellow-700">
                  Milestone amounts must equal the total. Difference: {Math.abs(milestoneTotal - parseFloat(totalAmount || "0")).toFixed(6)}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="btn btn-secondary">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() =>
                  amountsMatch &&
                  milestones.every((m) => m.description && m.amount) &&
                  setStep(4)
                }
                disabled={
                  !amountsMatch ||
                  !milestones.every((m) => m.description && m.amount)
                }
                className="btn btn-primary flex-1 disabled:opacity-40"
              >
                Review & Create
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Review */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-heading font-extrabold mb-1">Review & Confirm</h2>
              <p className="text-sm opacity-60">Verify all details before creating the escrow</p>
            </div>

            <div className="sd-card p-0">
              <div className="flex items-center justify-between px-5 py-3 border-b-2 border-divider">
                <div>
                  <p className="font-heading font-extrabold">{title}</p>
                  <p className="text-xs opacity-50 mt-0.5">{selectedChain.name} · {selectedToken?.symbol}</p>
                </div>
                <span className="tag tag-accent">{selectedChain.abbr}</span>
              </div>

              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs opacity-50">Token</p>
                  <p className="text-sm font-semibold">{selectedToken?.symbol} — {selectedToken?.name}</p>
                </div>
                <div>
                  <p className="text-xs opacity-50">Total Amount</p>
                  <p className="text-sm font-semibold">{totalAmount} {selectedToken?.symbol}</p>
                </div>
                <div>
                  <p className="text-xs opacity-50">Seller</p>
                  <p className="text-sm font-mono">{sellerAddress.slice(0, 10)}...{sellerAddress.slice(-6)}</p>
                </div>
                <div>
                  <p className="text-xs opacity-50">Mode</p>
                  <p className="text-sm font-semibold">{mode === 0 ? "Locked (2-of-2)" : "Arbiter (2-of-3)"}</p>
                </div>
                {deadline && (
                  <div>
                    <p className="text-xs opacity-50">Deadline</p>
                    <p className="text-sm">{new Date(deadline).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div className="px-5 py-4 border-t-2 border-divider">
                <p className="text-xs opacity-50 mb-2">Milestones ({milestones.length})</p>
                {milestones.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-accent flex items-center justify-center text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <span className="text-sm">{m.description}</span>
                    </div>
                    <span className="text-sm font-semibold">{m.amount} {selectedToken?.symbol}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-2 border-yellow-600 bg-yellow-600/5 p-4">
              <p className="text-sm text-yellow-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Once created, the escrow will be set up on {selectedChain.name}. The buyer will need to send {totalAmount} {selectedToken?.symbol} to the deposit address.
              </p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="btn btn-secondary">
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn btn-primary flex-1 disabled:opacity-40"
              >
                {loading ? "Creating Escrow..." : "Create Escrow"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
