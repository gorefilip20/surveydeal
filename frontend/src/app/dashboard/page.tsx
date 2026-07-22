"use client";

import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const CHAINS = [
  { id: "ETHEREUM", name: "Ethereum", icon: "🔷", chainId: 1, nativeCurrency: "ETH" },
  { id: "BNB_CHAIN", name: "BNB Chain", icon: "🟡", chainId: 56, nativeCurrency: "BNB" },
  { id: "POLYGON", name: "Polygon", icon: "🟣", chainId: 137, nativeCurrency: "MATIC" },
  { id: "ARBITRUM", name: "Arbitrum", icon: "🔵", chainId: 42161, nativeCurrency: "ETH" },
  { id: "BASE", name: "Base", icon: "🔷", chainId: 8453, nativeCurrency: "ETH" },
  { id: "SOLANA", name: "Solana", icon: "☀️", chainId: 0, nativeCurrency: "SOL" },
  { id: "TRON", name: "TRON", icon: "🔴", chainId: 0, nativeCurrency: "TRX" },
  { id: "AVALANCHE", name: "Avalanche", icon: "🔺", chainId: 43114, nativeCurrency: "AVAX" },
];

const STATE_COLORS: Record<string, string> = {
  CREATED: "bg-gray-500/20 text-gray-400",
  FUNDED: "bg-yellow-500/20 text-yellow-400",
  ACTIVE: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-green-500/20 text-green-400",
  DISPUTED: "bg-red-500/20 text-red-400",
  REFUNDED: "bg-orange-500/20 text-orange-400",
};

const NETWORK_ICONS: Record<string, string> = {
  ETHEREUM: "🔷", BNB_CHAIN: "🟡", POLYGON: "🟣", ARBITRUM: "🔵",
  BASE: "🔷", AVALANCHE: "🔺", OPTIMISM: "🔴", FANTOM: "👻",
  SOLANA: "☀️", TRON: "🔴",
};

export default function DashboardPage() {
  const [token, setToken] = useState("");
  const [user, setUser] = useState<any>(null);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [tab, setTab] = useState<"escrows" | "wallets" | "holdings">("escrows");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWalletAddress, setNewWalletAddress] = useState("");
  const [newWalletNetwork, setNewWalletNetwork] = useState("BNB_CHAIN");
  const [newWalletLabel, setNewWalletLabel] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user_token");
    if (stored) setToken(stored);
  }, []);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [userRes, escrowsRes, walletsRes] = await Promise.all([
        fetch(`${API}/auth/me`, { headers }),
        fetch(`${API}/escrows?limit=50`, { headers }),
        fetch(`${API}/wallets`, { headers }),
      ]);

      const userData = await userRes.json();
      if (!userData.error) setUser(userData);

      const escrowsData = await escrowsRes.json();
      setEscrows(escrowsData.escrows || []);

      const walletsData = await walletsRes.json();
      setWallets(Array.isArray(walletsData) ? walletsData : []);
    } catch (err) {
      console.error("Failed to load dashboard data", err);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Add wallet
  const addWallet = async () => {
    if (!newWalletAddress) return;
    try {
      const res = await fetch(`${API}/wallets`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          address: newWalletAddress,
          network: newWalletNetwork,
          label: newWalletLabel || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setWallets([...wallets, data]);
        setNewWalletAddress("");
        setNewWalletLabel("");
        setShowAddWallet(false);
      } else {
        alert(data.error || "Failed to add wallet");
      }
    } catch (err) {
      alert("Network error");
    }
  };

  // Delete wallet
  const deleteWallet = async (walletId: string) => {
    if (!confirm("Remove this wallet?")) return;
    try {
      await fetch(`${API}/wallets/${walletId}`, { method: "DELETE", headers });
      setWallets(wallets.filter((w) => w.id !== walletId));
    } catch (err) {
      alert("Failed to delete wallet");
    }
  };

  // Set preferred wallet
  const setPreferred = async (walletId: string) => {
    try {
      await fetch(`${API}/wallets/${walletId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isPreferred: true }),
      });
      loadData();
    } catch (err) {
      alert("Failed to update wallet");
    }
  };

  // Filter escrows
  const filteredEscrows = escrows.filter((e) => {
    if (filter === "all") return true;
    if (filter === "buying") return e.buyerId === user?.id;
    if (filter === "selling") return e.sellerId === user?.id;
    if (filter === "active") return ["ACTIVE", "FUNDED"].includes(e.state);
    if (filter === "completed") return e.state === "COMPLETED";
    if (filter === "disputed") return e.state === "DISPUTED";
    return true;
  });

  // Calculate holdings
  const holdings = escrows
    .filter((e) => ["ACTIVE", "FUNDED", "CREATED"].includes(e.state))
    .reduce((acc: Record<string, any>, e) => {
      const key = `${e.token?.symbol || "UNKNOWN"}-${e.network}`;
      if (!acc[key]) {
        acc[key] = {
          symbol: e.token?.symbol || "UNKNOWN",
          network: e.network,
          totalAmount: BigInt(0),
          escrowCount: 0,
          asBuyer: 0,
          asSeller: 0,
        };
      }
      acc[key].totalAmount += BigInt(e.totalAmount || "0");
      acc[key].escrowCount++;
      if (e.buyerId === user?.id) acc[key].asBuyer++;
      if (e.sellerId === user?.id) acc[key].asSeller++;
      return acc;
    }, {});

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg mb-4">Please connect your wallet first</p>
          <a href="/" className="text-blue-400 hover:text-blue-300">
            ← Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">
              SD
            </div>
            <div>
              <h1 className="text-lg font-bold">Dashboard</h1>
              {user && (
                <p className="text-xs text-gray-400">
                  {user.displayName || user.walletAddress?.slice(0, 10) + "..."}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/escrow/create"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
            >
              + New Escrow
            </a>
            <a
              href="/admin"
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Admin
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Total Escrows",
              value: escrows.length,
              color: "blue",
            },
            {
              label: "Active",
              value: escrows.filter((e) => ["ACTIVE", "FUNDED"].includes(e.state)).length,
              color: "green",
            },
            {
              label: "Disputed",
              value: escrows.filter((e) => e.state === "DISPUTED").length,
              color: "red",
            },
            {
              label: "Completed",
              value: escrows.filter((e) => e.state === "COMPLETED").length,
              color: "emerald",
            },
          ].map((s) => (
            <div key={s.label} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
              <p className="text-sm text-gray-400">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 text-${s.color}-400`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
          {[
            { key: "escrows", label: "📋 My Escrows" },
            { key: "wallets", label: "💳 Wallets" },
            { key: "holdings", label: "🏦 Escrow Holdings" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── ESCROWS TAB ── */}
        {tab === "escrows" && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "all", label: "All" },
                { key: "buying", label: "Buying" },
                { key: "selling", label: "Selling" },
                { key: "active", label: "Active" },
                { key: "completed", label: "Completed" },
                { key: "disputed", label: "Disputed" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-sm px-4 py-2 rounded-lg transition ${
                    filter === f.key
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Escrow List */}
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : filteredEscrows.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No escrows found</p>
                <a
                  href="/escrow/create"
                  className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block"
                >
                  Create your first escrow →
                </a>
              </div>
            ) : (
              filteredEscrows.map((escrow) => (
                <a
                  key={escrow.id}
                  href={`/escrow/${escrow.id}`}
                  className="block bg-gray-900 rounded-xl border border-gray-800 p-5 hover:border-gray-600 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">{escrow.title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        #{escrow.onChainId} • {escrow.token?.symbol} • {NETWORK_ICONS[escrow.network] || ""} {escrow.network}
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full ${STATE_COLORS[escrow.state]}`}>
                      {escrow.state}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500">
                        {escrow.buyerId === user?.id ? "Seller" : "Buyer"}
                      </p>
                      <p className="text-xs text-gray-300 font-mono">
                        {escrow.buyerId === user?.id
                          ? escrow.seller?.walletAddress?.slice(0, 8) + "..."
                          : escrow.buyer?.walletAddress?.slice(0, 8) + "..."}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="text-sm font-medium text-white">{escrow.totalAmount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Role</p>
                      <p className="text-sm text-white">
                        {escrow.buyerId === user?.id ? "Buyer" : escrow.sellerId === user?.id ? "Seller" : "Arbiter"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Milestones</p>
                      <p className="text-sm text-white">
                        {escrow.milestones?.filter((m: any) => m.released).length || 0}/{escrow.milestones?.length || 0}
                      </p>
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        )}

        {/* ── WALLETS TAB ── */}
        {tab === "wallets" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Connected Wallets</h3>
              <button
                onClick={() => setShowAddWallet(!showAddWallet)}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                + Add Wallet
              </button>
            </div>

            {/* Add Wallet Form */}
            {showAddWallet && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Add New Wallet</h4>
                <div className="space-y-3">
                  <select
                    value={newWalletNetwork}
                    onChange={(e) => setNewWalletNetwork(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm"
                  >
                    {CHAINS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name} ({c.nativeCurrency})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Wallet address (0x...)"
                    value={newWalletAddress}
                    onChange={(e) => setNewWalletAddress(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono"
                  />
                  <input
                    type="text"
                    placeholder="Label (optional, e.g. 'Trading Wallet')"
                    value={newWalletLabel}
                    onChange={(e) => setNewWalletLabel(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={addWallet}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-lg transition"
                    >
                      Add Wallet
                    </button>
                    <button
                      onClick={() => setShowAddWallet(false)}
                      className="px-4 bg-gray-800 hover:bg-gray-700 text-white text-sm py-2.5 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Wallet List */}
            {wallets.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No wallets connected</p>
                <p className="text-gray-500 text-sm mt-1">Add a wallet to start trading</p>
              </div>
            ) : (
              <div className="space-y-3">
                {wallets.map((w) => {
                  const chain = CHAINS.find((c) => c.id === w.network);
                  return (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-4 bg-gray-900 rounded-xl border border-gray-800"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{chain?.icon || "🔗"}</span>
                        <div>
                          <p className="text-sm text-white font-mono">
                            {w.address.slice(0, 8)}...{w.address.slice(-6)}
                          </p>
                          <p className="text-xs text-gray-400">
                            {chain?.name || w.network} {w.label ? `• ${w.label}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {w.isPreferred && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
                            ⭐ Preferred
                          </span>
                        )}
                        {!w.isPreferred && (
                          <button
                            onClick={() => setPreferred(w.id)}
                            className="text-xs text-gray-400 hover:text-white transition"
                          >
                            Set Preferred
                          </button>
                        )}
                        <button
                          onClick={() => deleteWallet(w.id)}
                          className="text-xs text-red-400 hover:text-red-300 transition"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HOLDINGS TAB ── */}
        {tab === "holdings" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Escrow Holdings</h3>
            <p className="text-sm text-gray-400">
              Tokens currently held in escrow. These funds are locked until the escrow is completed or refunded.
            </p>

            {Object.keys(holdings).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No tokens in escrow</p>
                <p className="text-gray-500 text-sm mt-1">Create an escrow to start holding tokens</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(holdings).map((h: any) => (
                  <div
                    key={`${h.symbol}-${h.network}`}
                    className="bg-gray-900 rounded-xl border border-gray-800 p-5"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{NETWORK_ICONS[h.network] || "🔗"}</span>
                      <div>
                        <p className="font-medium text-white">{h.symbol}</p>
                        <p className="text-xs text-gray-400">{h.network}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Total Held</span>
                        <span className="text-sm font-medium text-white">
                          {h.totalAmount.toString()} {h.symbol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">Escrows</span>
                        <span className="text-sm text-white">{h.escrowCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">As Buyer</span>
                        <span className="text-sm text-blue-400">{h.asBuyer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-400">As Seller</span>
                        <span className="text-sm text-green-400">{h.asSeller}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
