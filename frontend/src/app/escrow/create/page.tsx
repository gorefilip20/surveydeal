"use client";

import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const CHAINS = [
  { id: "ETHEREUM", name: "Ethereum", icon: "🔷", chainId: 1, nativeCurrency: "ETH", color: "#627EEA" },
  { id: "BNB_CHAIN", name: "BNB Chain", icon: "🟡", chainId: 56, nativeCurrency: "BNB", color: "#F0B90B" },
  { id: "POLYGON", name: "Polygon", icon: "🟣", chainId: 137, nativeCurrency: "MATIC", color: "#8247E5" },
  { id: "ARBITRUM", name: "Arbitrum", icon: "🔵", chainId: 42161, nativeCurrency: "ETH", color: "#28A0F0" },
  { id: "BASE", name: "Base", icon: "🔷", chainId: 8453, nativeCurrency: "ETH", color: "#0052FF" },
  { id: "AVALANCHE", name: "Avalanche", icon: "🔺", chainId: 43114, nativeCurrency: "AVAX", color: "#E84142" },
  { id: "OPTIMISM", name: "Optimism", icon: "🔴", chainId: 10, nativeCurrency: "ETH", color: "#FF0013" },
  { id: "FANTOM", name: "Fantom", icon: "👻", chainId: 250, nativeCurrency: "FTM", color: "#1969FF" },
  { id: "SOLANA", name: "Solana", icon: "☀️", chainId: 0, nativeCurrency: "SOL", color: "#9945FF" },
  { id: "TRON", name: "TRON", icon: "🔴", chainId: 0, nativeCurrency: "TRX", color: "#FF0013" },
];

interface Wallet {
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

  // Form state
  const [selectedChain, setSelectedChain] = useState(CHAINS[1]); // Default BNB
  const [sellerAddress, setSellerAddress] = useState("");
  const [tokenSearch, setTokenSearch] = useState("");
  const [tokenResults, setTokenResults] = useState<TokenResult[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenResult | null>(null);
  const [totalAmount, setTotalAmount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState(0); // 0=Locked, 1=Arbiter
  const [arbiterAddress, setArbiterAddress] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([{ description: "", amount: "" }]);
  const [userWallets, setUserWallets] = useState<Wallet[]>([]);
  const [preferredWallet, setPreferredWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Load user wallets
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
          const preferred = data.find((w: Wallet) => w.isPreferred && w.network === selectedChain.id);
          if (preferred) setPreferredWallet(preferred);
        })
        .catch(() => {});
    }
  }, []);

  // Search tokens via DexScreener
  const searchTokens = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setTokenResults([]);
      return;
    }
    try {
      const res = await fetch(`https://api.dexscreener.com/dex/search/v1/?q=${query}`);
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
          chainId: pair.chainId === "bsc" ? 56 : pair.chainId === "ethereum" ? 1 : pair.chainId === "polygon" ? 137 : pair.chainId === "arbitrum" ? 42161 : pair.chainId === "base" ? 8453 : 0,
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

  // Milestone management
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

  // Calculate milestone totals
  const milestoneTotal = milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);

  // Submit escrow
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
          onChainId: 0,
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

  // Steps
  const steps = [
    { num: 1, label: "Network & Token" },
    { num: 2, label: "Details" },
    { num: 3, label: "Milestones" },
    { num: 4, label: "Review" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">
              SD
            </div>
            <span className="text-lg font-bold">Create Escrow</span>
          </div>
          <a href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
            ← Back to Dashboard
          </a>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition ${
                    step >= s.num
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-500"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </div>
                <span
                  className={`text-sm hidden sm:inline ${
                    step >= s.num ? "text-white" : "text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 ${
                    step > s.num ? "bg-blue-600" : "bg-gray-800"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error/Success */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg mb-6 text-sm">
            {success}
          </div>
        )}

        {/* ── STEP 1: Network & Token ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Select Network</h2>
              <p className="text-sm text-gray-400">Choose the blockchain for this escrow</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {CHAINS.map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    selectedChain.id === chain.id
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
                  }`}
                >
                  <span className="text-2xl">{chain.icon}</span>
                  <span className="text-sm font-medium">{chain.name}</span>
                  <span className="text-xs text-gray-400">{chain.nativeCurrency}</span>
                </button>
              ))}
            </div>

            {/* Token Search */}
            <div>
              <h3 className="text-lg font-semibold mb-2">Search Token</h3>
              <p className="text-sm text-gray-400 mb-3">
                Search by token name or contract address (CA) — powered by DexScreener
              </p>
              <input
                type="text"
                placeholder="Enter token name or CA (e.g. PEPE, BONK, 0x...)"
                value={tokenSearch}
                onChange={(e) => setTokenSearch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition"
              />

              {/* Token Results */}
              {tokenResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                  {tokenResults.map((t, i) => (
                    <button
                      key={`${t.address}-${i}`}
                      onClick={() => {
                        setSelectedToken(t);
                        setTokenSearch(`${t.symbol} — ${t.name}`);
                        setTokenResults([]);
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition ${
                        selectedToken?.address === t.address
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-gray-700 bg-gray-800/50 hover:border-gray-500"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs">
                          {t.symbol.slice(0, 3)}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-white">
                            {t.symbol} <span className="text-gray-400 font-normal">{t.name}</span>
                          </p>
                          <p className="text-xs text-gray-500 font-mono">
                            {t.address.slice(0, 10)}...{t.address.slice(-6)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        {t.price !== undefined && (
                          <p className="text-sm text-white">${t.price < 0.01 ? t.price.toPrecision(3) : t.price.toFixed(2)}</p>
                        )}
                        {t.priceChange24h !== undefined && (
                          <p className={`text-xs ${t.priceChange24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {t.priceChange24h >= 0 ? "+" : ""}{t.priceChange24h.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedToken && (
                <div className="mt-3 p-4 bg-blue-500/5 border border-blue-500/30 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-white">{selectedToken.symbol} — {selectedToken.name}</p>
                      <p className="text-xs text-gray-400 font-mono mt-1">CA: {selectedToken.address}</p>
                    </div>
                    <button
                      onClick={() => { setSelectedToken(null); setTokenSearch(""); }}
                      className="text-xs text-gray-400 hover:text-white"
                    >
                      Change
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3">
                    {selectedToken.price !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">Price</p>
                        <p className="text-sm font-medium text-white">${selectedToken.price < 0.01 ? selectedToken.price.toPrecision(3) : selectedToken.price.toFixed(2)}</p>
                      </div>
                    )}
                    {selectedToken.volume24h !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">24h Volume</p>
                        <p className="text-sm font-medium text-white">${(selectedToken.volume24h / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                    {selectedToken.liquidity !== undefined && (
                      <div>
                        <p className="text-xs text-gray-500">Liquidity</p>
                        <p className="text-sm font-medium text-white">${(selectedToken.liquidity / 1000).toFixed(1)}K</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => selectedToken && setStep(2)}
              disabled={!selectedToken}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── STEP 2: Details ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Escrow Details</h2>
              <p className="text-sm text-gray-400">Set up the trade terms</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Buy 1M PEPE tokens"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                <textarea
                  placeholder="Describe the trade terms..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Seller Wallet Address *</label>
                <input
                  type="text"
                  placeholder={`Seller's ${selectedChain.nativeCurrency} wallet address (0x...)`}
                  value={sellerAddress}
                  onChange={(e) => setSellerAddress(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Total Amount ({selectedToken?.symbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
                />
                {selectedToken?.price && totalAmount && (
                  <p className="text-xs text-gray-400 mt-1">
                    ≈ ${(parseFloat(totalAmount) * selectedToken.price).toFixed(2)} USD
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Escrow Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value={0}>🔒 Locked (2-of-2 agreement)</option>
                    <option value={1}>👨‍⚖️ Arbiter (2-of-3 with dispute resolution)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Deadline (optional)</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {mode === 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Arbiter Wallet Address</label>
                  <input
                    type="text"
                    placeholder="Neutral third-party wallet address"
                    value={arbiterAddress}
                    onChange={(e) => setArbiterAddress(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="px-6 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={() => sellerAddress && totalAmount && title && setStep(3)}
                disabled={!sellerAddress || !totalAmount || !title}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Milestones ── */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Payment Milestones</h2>
              <p className="text-sm text-gray-400">
                Split the payment into stages. Funds release as each milestone is completed.
              </p>
            </div>

            <div className="space-y-3">
              {milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                  <span className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                    {i + 1}
                  </span>
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      placeholder="Milestone description (e.g. 'Deliver wallet seed phrase')"
                      value={m.description}
                      onChange={(e) => updateMilestone(i, "description", e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder={`Amount in ${selectedToken?.symbol}`}
                      value={m.amount}
                      onChange={(e) => updateMilestone(i, "amount", e.target.value)}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  {milestones.length > 1 && (
                    <button
                      onClick={() => removeMilestone(i)}
                      className="text-red-400 hover:text-red-300 text-sm mt-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addMilestone}
              className="w-full border-2 border-dashed border-gray-700 hover:border-gray-500 text-gray-400 hover:text-white py-3 rounded-xl transition text-sm"
            >
              + Add Milestone
            </button>

            {/* Total Check */}
            <div className={`p-4 rounded-xl border ${
              Math.abs(milestoneTotal - parseFloat(totalAmount || "0")) < 0.0001
                ? "bg-green-500/5 border-green-500/30"
                : "bg-yellow-500/5 border-yellow-500/30"
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-300">Milestone Total</span>
                <span className="font-medium text-white">
                  {milestoneTotal.toFixed(6)} {selectedToken?.symbol}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-gray-300">Escrow Total</span>
                <span className="font-medium text-white">
                  {parseFloat(totalAmount || "0").toFixed(6)} {selectedToken?.symbol}
                </span>
              </div>
              {Math.abs(milestoneTotal - parseFloat(totalAmount || "0")) >= 0.0001 && (
                <p className="text-xs text-yellow-400 mt-2">
                  ⚠️ Milestone amounts must equal the total escrow amount. Difference: {Math.abs(milestoneTotal - parseFloat(totalAmount || "0")).toFixed(6)}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="px-6 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={() =>
                  Math.abs(milestoneTotal - parseFloat(totalAmount || "0")) < 0.0001 &&
                  milestones.every((m) => m.description && m.amount) &&
                  setStep(4)
                }
                disabled={
                  Math.abs(milestoneTotal - parseFloat(totalAmount || "0")) >= 0.0001 ||
                  !milestones.every((m) => m.description && m.amount)
                }
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-xl transition"
              >
                Review & Create →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Review ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-2">Review & Confirm</h2>
              <p className="text-sm text-gray-400">Verify all details before creating the escrow</p>
            </div>

            <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-700">
                <span className="text-2xl">{selectedChain.icon}</span>
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="text-sm text-gray-400">{selectedChain.name} • {selectedToken?.symbol}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Token</p>
                  <p className="text-sm text-white">{selectedToken?.symbol} — {selectedToken?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Amount</p>
                  <p className="text-sm text-white">{totalAmount} {selectedToken?.symbol}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Seller</p>
                  <p className="text-sm text-white font-mono">{sellerAddress.slice(0, 10)}...{sellerAddress.slice(-6)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mode</p>
                  <p className="text-sm text-white">{mode === 0 ? "🔒 Locked (2-of-2)" : "👨‍⚖️ Arbiter (2-of-3)"}</p>
                </div>
                {deadline && (
                  <div>
                    <p className="text-xs text-gray-500">Deadline</p>
                    <p className="text-sm text-white">{new Date(deadline).toLocaleString()}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-700">
                <p className="text-xs text-gray-500 mb-2">Milestones ({milestones.length})</p>
                {milestones.map((m, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-300">{m.description}</span>
                    </div>
                    <span className="text-sm text-white font-medium">{m.amount} {selectedToken?.symbol}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-yellow-500/5 border border-yellow-500/30 rounded-xl p-4">
              <p className="text-sm text-yellow-400">
                ⚠️ Once created, the escrow contract will be deployed on {selectedChain.name}. The buyer will need to send {totalAmount} {selectedToken?.symbol} to the deposit address to fund it.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(3)}
                className="px-6 bg-gray-800 hover:bg-gray-700 text-white py-3 rounded-xl transition"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 text-white font-semibold py-3 rounded-xl transition"
              >
                {loading ? "Creating Escrow..." : "🔐 Create Escrow"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
