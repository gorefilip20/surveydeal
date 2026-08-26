"use client";

import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

// ── Types ──────────────────────────────────────────
interface UserAsset {
  id: string;
  walletAddress: string;
  displayName: string | null;
  email: string | null;
  role: string;
  isAdmin: boolean;
  isArbiter: boolean;
  isFrozen: boolean;
  createdAt: string;
  wallets: Array<{
    id: string;
    address: string;
    network: string;
    label: string | null;
    isPreferred: boolean;
  }>;
  stats: {
    totalBuyVolume: string;
    totalSellVolume: string;
    totalBuyEscrows: number;
    totalSellEscrows: number;
    activeBuyEscrows: number;
    activeSellEscrows: number;
    totalVolume: string;
  };
  recentBuyEscrows: Array<{
    id: string;
    totalAmount: string;
    state: string;
    network: string;
    token: { symbol: string; decimals: number };
    createdAt: string;
  }>;
  recentSellEscrows: Array<{
    id: string;
    totalAmount: string;
    state: string;
    network: string;
    token: { symbol: string; decimals: number };
    createdAt: string;
  }>;
}

interface Overview {
  totalEscrows: number;
  activeEscrows: number;
  disputedEscrows: number;
  completedEscrows: number;
  refundedEscrows: number;
  totalUsers: number;
  frozenUsers: number;
  totalVolume: string;
  totalFees: string;
}

const STATE_COLORS: Record<string, string> = {
  CREATED: "bg-gray-500/20 text-gray-400",
  FUNDED: "bg-yellow-500/20 text-yellow-400",
  ACTIVE: "bg-blue-500/20 text-blue-400",
  COMPLETED: "bg-green-500/20 text-green-400",
  DISPUTED: "bg-red-500/20 text-red-400",
  REFUNDED: "bg-orange-500/20 text-orange-400",
};

const NETWORK_ICONS: Record<string, string> = {
  ETHEREUM: "🔷",
  BNB_CHAIN: "🟡",
  POLYGON: "🟣",
  ARBITRUM: "🔵",
  BASE: "🔷",
  AVALANCHE: "🔺",
  OPTIMISM: "🔴",
  FANTOM: "👻",
  SOLANA: "☀️",
  TRON: "🔴",
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<"overview" | "users" | "escrows" | "tokens" | "payments">("overview");
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAsset | null>(null);
  const [selectedEscrow, setSelectedEscrow] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [paymentWallets, setPaymentWallets] = useState<Array<{ id: string; symbol: string; network: string; address: string; label: string; instructions: string; isActive: boolean }>>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [walletsSaving, setWalletsSaving] = useState(false);

  // ── Auth ──
  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // ── Data Loading ──
  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/analytics/overview`, { headers });
      const data = await res.json();
      setOverview(data);
    } catch (err) {
      console.error("Failed to load overview", err);
    }
  }, [token]);

  const loadUserAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/user-assets?search=${search}&page=${page}`, { headers });
      const data = await res.json();
      setUserAssets(data.users || []);
    } catch (err) {
      console.error("Failed to load user assets", err);
    }
    setLoading(false);
  }, [token, search, page]);

  const loadPaymentWallets = useCallback(async () => {
    setWalletsLoading(true);
    try {
      const res = await fetch(`${API}/admin/payment-wallets`, { headers });
      const data = await res.json();
      setPaymentWallets(Array.isArray(data.wallets) ? data.wallets : []);
    } catch (err) {
      console.error("Failed to load payment wallets", err);
    } finally {
      setWalletsLoading(false);
    }
  }, [token]);

  const loadEscrows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/escrows?search=${search}&page=${page}`, { headers });
      const data = await res.json();
      setEscrows(data.escrows || []);
    } catch (err) {
      console.error("Failed to load escrows", err);
    }
    setLoading(false);
  }, [token, search, page]);

  useEffect(() => {
    if (!token) return;
    if (tab === "overview") loadOverview();
    else if (tab === "users") loadUserAssets();
    else if (tab === "escrows") loadEscrows();
    else if (tab === "payments") loadPaymentWallets();
  }, [tab, token, page]);

  // ── Admin Actions ──
  const approveMilestone = async (escrowId: string, milestoneIndex: number, force = false) => {
    try {
      const res = await fetch(`${API}/admin/escrows/${escrowId}/approve-milestone/${milestoneIndex}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`Approved! Tx: ${data.txHash}`);
        loadEscrows();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to approve milestone");
    }
  };

  const approveAll = async (escrowId: string) => {
    try {
      const res = await fetch(`${API}/admin/escrows/${escrowId}/approve-all`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (data.success) {
        alert(`All milestones approved! Tx: ${data.txHash}`);
        loadEscrows();
      }
    } catch (err) {
      alert("Failed to approve all");
    }
  };

  const savePaymentWallets = async () => {
    setWalletsSaving(true);
    try {
      const res = await fetch(`${API}/admin/payment-wallets`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ wallets: paymentWallets }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to save payment wallets");
      setPaymentWallets(data.wallets || []);
      alert("Payment wallets published to the frontend.");
    } catch (err: any) {
      alert(err.message || "Failed to save payment wallets");
    } finally {
      setWalletsSaving(false);
    }
  };

  const toggleFreeze = async (userId: string, currentlyFrozen: boolean) => {
    const reason = prompt(`Reason to ${currentlyFrozen ? "unfreeze" : "freeze"} this user:`);
    if (reason === null) return;
    try {
      await fetch(`${API}/admin/users/${userId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status: currentlyFrozen ? "ACTIVE" : "FROZEN",
          reason,
        }),
      });
      loadUserAssets();
    } catch (err) {
      alert("Failed to update user status");
    }
  };

  // ── Login ──
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-full max-w-md p-8 bg-gray-900 rounded-2xl border border-gray-800">
          <h1 className="text-2xl font-bold text-white text-center mb-6">🔐 Admin Login</h1>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const res = await fetch(`${API}/admin/auth/simple-login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  email: form.get("email"),
                  password: form.get("password"),
                }),
              });
              const data = await res.json();
              if (data.token) {
                localStorage.setItem("admin_token", data.token);
                setToken(data.token);
              } else {
                alert(data.error || "Login failed");
              }
            }}
            className="space-y-4"
          >
            <input
              name="email"
              type="email"
              placeholder="Admin email"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white"
              defaultValue="admin@surveydeal.io"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 text-white"
            />
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Main Layout ──
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-lg font-bold">
              SD
            </div>
            <div>
              <h1 className="text-lg font-bold">SurveyDeal Admin</h1>
              <p className="text-xs text-gray-400">Crypto Escrow Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Search users, escrows, wallets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (tab === "users") loadUserAssets();
                    else if (tab === "escrows") loadEscrows();
                  }
                }}
                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white w-72 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => { localStorage.removeItem("admin_token"); setToken(""); }}
              className="text-sm text-gray-400 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit">
          {(["overview", "users", "escrows", "tokens", "payments"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPage(1); setSelectedUser(null); setSelectedEscrow(null); }}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition ${
                tab === t
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {t === "overview" ? "📊 Overview" : t === "users" ? "👥 Users & Assets" : t === "escrows" ? "📋 Escrows" : t === "tokens" ? "🪙 Tokens" : "💳 Payment Wallets"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && overview && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Escrows", value: overview.totalEscrows, color: "blue" },
                { label: "Active", value: overview.activeEscrows, color: "green" },
                { label: "Disputed", value: overview.disputedEscrows, color: "red" },
                { label: "Completed", value: overview.completedEscrows, color: "emerald" },
                { label: "Refunded", value: overview.refundedEscrows, color: "orange" },
                { label: "Total Users", value: overview.totalUsers, color: "purple" },
                { label: "Frozen Users", value: overview.frozenUsers, color: "red" },
                {
                  label: "Total Volume",
                  value: `${(Number(overview.totalVolume) / 1e18).toFixed(2)}`,
                  color: "yellow",
                },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
                  <p className="text-sm text-gray-400">{stat.label}</p>
                  <p className={`text-2xl font-bold mt-1 text-${stat.color}-400`}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── USERS & ASSETS TAB ── */}
        {tab === "users" && (
          <div className="space-y-4">
            {loading && <p className="text-gray-400">Loading...</p>}

            {selectedUser ? (
              <UserDetail
                user={selectedUser}
                onBack={() => setSelectedUser(null)}
                onFreeze={toggleFreeze}
              />
            ) : (
              userAssets.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="bg-gray-900 rounded-xl border border-gray-800 p-5 cursor-pointer hover:border-gray-600 transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-sm text-blue-400 font-mono">
                        {user.walletAddress.slice(2, 4).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-white">
                          {user.displayName || user.walletAddress.slice(0, 10) + "..."}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{user.walletAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.isFrozen && (
                        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded-full">FROZEN</span>
                      )}
                      {user.isAdmin && (
                        <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">ADMIN</span>
                      )}
                      {user.wallets.length > 0 && (
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded-full">
                          {user.wallets.length} wallet{user.wallets.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500">Buy Escrows</p>
                      <p className="text-sm font-medium text-white">{user.stats.totalBuyEscrows}</p>
                      <p className="text-xs text-gray-400">{user.stats.activeBuyEscrows} active</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Sell Escrows</p>
                      <p className="text-sm font-medium text-white">{user.stats.totalSellEscrows}</p>
                      <p className="text-xs text-gray-400">{user.stats.activeSellEscrows} active</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Buy Volume</p>
                      <p className="text-sm font-medium text-white">
                        {Number(user.stats.totalBuyVolume) > 0
                          ? (Number(user.stats.totalBuyVolume) / 1e18).toFixed(4)
                          : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Sell Volume</p>
                      <p className="text-sm font-medium text-white">
                        {Number(user.stats.totalSellVolume) > 0
                          ? (Number(user.stats.totalSellVolume) / 1e18).toFixed(4)
                          : "0"}
                      </p>
                    </div>
                  </div>

                  {/* Wallet Badges */}
                  {user.wallets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {user.wallets.map((w) => (
                        <span
                          key={w.id}
                          className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full border border-gray-700"
                        >
                          {NETWORK_ICONS[w.network] || "🔗"} {w.network} {w.isPreferred ? "⭐" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── ESCROWS TAB ── */}
        {tab === "escrows" && (
          <div className="space-y-4">
            {loading && <p className="text-gray-400">Loading...</p>}

            {selectedEscrow ? (
              <EscrowDetail
                escrow={selectedEscrow}
                onBack={() => setSelectedEscrow(null)}
                onApproveMilestone={approveMilestone}
                onApproveAll={approveAll}
              />
            ) : (
              escrows.map((escrow) => (
                <div
                  key={escrow.id}
                  onClick={() => setSelectedEscrow(escrow)}
                  className="bg-gray-900 rounded-xl border border-gray-800 p-5 cursor-pointer hover:border-gray-600 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-white">{escrow.title}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        #{escrow.onChainId} • {escrow.token?.symbol} • {NETWORK_ICONS[escrow.network] || ""} {escrow.network}
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full ${STATE_COLORS[escrow.state] || "bg-gray-500/20 text-gray-400"}`}>
                      {escrow.state}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs text-gray-500">Buyer</p>
                      <p className="text-xs text-gray-300 font-mono">{escrow.buyer?.walletAddress?.slice(0, 8)}...</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Seller</p>
                      <p className="text-xs text-gray-300 font-mono">{escrow.seller?.walletAddress?.slice(0, 8)}...</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="text-sm font-medium text-white">{escrow.totalAmount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Milestones</p>
                      <p className="text-sm font-medium text-white">
                        {escrow.milestones?.filter((m: any) => m.released).length || 0}/{escrow.milestones?.length || 0}
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {escrow.state === "ACTIVE" || escrow.state === "DISPUTED" ? (
                    <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => approveAll(escrow.id)}
                        className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition"
                      >
                        ✅ Approve All
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "payments" && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-400">Payment rails</p>
                  <h2 className="mt-2 text-2xl font-black text-white">Public payment wallets</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">These addresses will be visible on the public homepage. Only add wallets controlled by your organization, and always label the exact network to prevent mistaken deposits.</p>
                </div>
                <button onClick={() => setPaymentWallets([...paymentWallets, { id: `wallet-${Date.now()}`, symbol: "", network: "", address: "", label: "", instructions: "", isActive: true }])} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500">+ Add wallet</button>
              </div>
            </div>
            {walletsLoading ? <p className="text-gray-400">Loading payment wallets…</p> : paymentWallets.length === 0 ? <div className="rounded-2xl border border-dashed border-gray-700 p-10 text-center text-gray-400">No payment wallets configured yet. Add one to publish a deposit option on the homepage.</div> : <div className="space-y-4">{paymentWallets.map((wallet, index) => <div key={wallet.id} className="rounded-2xl border border-gray-800 bg-gray-900 p-5"><div className="grid gap-3 md:grid-cols-2"><input value={wallet.symbol} onChange={(e) => setPaymentWallets(paymentWallets.map((item, i) => i === index ? { ...item, symbol: e.target.value } : item))} placeholder="Coin symbol (e.g. USDC)" className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white" /><input value={wallet.network} onChange={(e) => setPaymentWallets(paymentWallets.map((item, i) => i === index ? { ...item, network: e.target.value } : item))} placeholder="Network (e.g. Base, ERC-20)" className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white" /><input value={wallet.address} onChange={(e) => setPaymentWallets(paymentWallets.map((item, i) => i === index ? { ...item, address: e.target.value } : item))} placeholder="Wallet address" className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white md:col-span-2" /><input value={wallet.label} onChange={(e) => setPaymentWallets(paymentWallets.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} placeholder="Label (optional)" className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white" /><input value={wallet.instructions} onChange={(e) => setPaymentWallets(paymentWallets.map((item, i) => i === index ? { ...item, instructions: e.target.value } : item))} placeholder="Instructions (optional)" className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white" /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" checked={wallet.isActive} onChange={(e) => setPaymentWallets(paymentWallets.map((item, i) => i === index ? { ...item, isActive: e.target.checked } : item))} className="h-4 w-4 accent-blue-600" /> Visible on frontend</label><button onClick={() => setPaymentWallets(paymentWallets.filter((_, i) => i !== index))} className="text-sm font-bold text-red-400 hover:text-red-300">Remove</button></div></div>)}</div>}
            <div className="flex justify-end"><button disabled={walletsSaving} onClick={savePaymentWallets} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white hover:bg-emerald-500 disabled:opacity-50">{walletsSaving ? "Publishing…" : "Publish wallets to frontend"}</button></div>
          </div>
        )}

        {/* Pagination */}
        {(tab === "users" || tab === "escrows") && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-40 hover:bg-gray-700 transition text-sm"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-gray-400 text-sm">Page {page}</span>
            <button
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── User Detail Component ──
function UserDetail({
  user,
  onBack,
  onFreeze,
}: {
  user: UserAsset;
  onBack: () => void;
  onFreeze: (userId: string, frozen: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">
        ← Back to Users
      </button>

      {/* User Header */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-500/20 flex items-center justify-center text-xl text-blue-400 font-mono">
              {user.walletAddress.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {user.displayName || "Unnamed User"}
              </h2>
              <p className="text-sm text-gray-400 font-mono">{user.walletAddress}</p>
              {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {user.isFrozen && (
              <span className="text-sm bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full">FROZEN</span>
            )}
            <button
              onClick={() => onFreeze(user.id, user.isFrozen)}
              className={`text-sm px-4 py-2 rounded-lg transition ${
                user.isFrozen
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }`}
            >
              {user.isFrozen ? "Unfreeze" : "Freeze"}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-6 gap-4 mt-6">
          {[
            { label: "Total Volume", value: (Number(user.stats.totalVolume) / 1e18).toFixed(4) },
            { label: "Buy Escrows", value: user.stats.totalBuyEscrows },
            { label: "Sell Escrows", value: user.stats.totalSellEscrows },
            { label: "Active Buy", value: user.stats.activeBuyEscrows },
            { label: "Active Sell", value: user.stats.activeSellEscrows },
            { label: "Wallets", value: user.wallets.length },
          ].map((s) => (
            <div key={s.label} className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wallets */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Connected Wallets</h3>
        {user.wallets.length === 0 ? (
          <p className="text-sm text-gray-500">No wallets connected</p>
        ) : (
          <div className="space-y-3">
            {user.wallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{NETWORK_ICONS[w.network] || "🔗"}</span>
                  <div>
                    <p className="text-sm text-white font-mono">{w.address}</p>
                    <p className="text-xs text-gray-400">{w.network} {w.label ? `• ${w.label}` : ""}</p>
                  </div>
                </div>
                {w.isPreferred && (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">Preferred</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Escrows */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Buy Escrows</h3>
          {user.recentBuyEscrows.length === 0 ? (
            <p className="text-sm text-gray-500">No buy escrows</p>
          ) : (
            <div className="space-y-3">
              {user.recentBuyEscrows.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{e.token.symbol} • #{e.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">{e.totalAmount}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATE_COLORS[e.state]}`}>{e.state}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Sell Escrows</h3>
          {user.recentSellEscrows.length === 0 ? (
            <p className="text-sm text-gray-500">No sell escrows</p>
          ) : (
            <div className="space-y-3">
              {user.recentSellEscrows.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{e.token.symbol} • #{e.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-white">{e.totalAmount}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATE_COLORS[e.state]}`}>{e.state}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Escrow Detail Component ──
function EscrowDetail({
  escrow,
  onBack,
  onApproveMilestone,
  onApproveAll,
}: {
  escrow: any;
  onBack: () => void;
  onApproveMilestone: (id: string, index: number, force?: boolean) => void;
  onApproveAll: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <button onClick={onBack} className="text-sm text-blue-400 hover:text-blue-300">
        ← Back to Escrows
      </button>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">{escrow.title}</h2>
            <p className="text-sm text-gray-400 mt-1">
              Escrow #{escrow.onChainId} • {escrow.token?.symbol} • {escrow.network}
            </p>
          </div>
          <span className={`text-sm px-4 py-1.5 rounded-full ${STATE_COLORS[escrow.state]}`}>
            {escrow.state}
          </span>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-3 gap-6 mt-6">
          {[
            { label: "Buyer", data: escrow.buyer },
            { label: "Seller", data: escrow.seller },
            { label: "Arbiter", data: escrow.arbiter },
          ].map((p) => (
            <div key={p.label} className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">{p.label}</p>
              {p.data ? (
                <>
                  <p className="text-sm text-white font-mono">
                    {p.data.walletAddress?.slice(0, 8)}...
                  </p>
                  <p className="text-xs text-gray-400">{p.data.displayName || "Unnamed"}</p>
                </>
              ) : (
                <p className="text-sm text-gray-500">None</p>
              )}
            </div>
          ))}
        </div>

        {/* Amounts */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: "Total Amount", value: escrow.totalAmount },
            { label: "Funded", value: escrow.fundedAmount },
            { label: "Released", value: escrow.releasedAmount },
            { label: "Protocol Fees", value: escrow.protocolFeeTotal },
          ].map((a) => (
            <div key={a.label} className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{a.label}</p>
              <p className="text-sm font-medium text-white">{a.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Milestones</h3>
          {(escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && (
            <button
              onClick={() => onApproveAll(escrow.id)}
              className="text-sm bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
            >
              ✅ Approve All Milestones
            </button>
          )}
        </div>
        <div className="space-y-3">
          {escrow.milestones?.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-300">
                  {m.index + 1}
                </span>
                <div>
                  <p className="text-sm text-white">{m.description}</p>
                  <p className="text-xs text-gray-400">Amount: {m.amount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {m.sellerDelivered && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">Delivered</span>
                  )}
                  {m.buyerApproved && (
                    <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">Approved</span>
                  )}
                  {m.adminApproved && (
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">Admin</span>
                  )}
                  {m.released && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">Released</span>
                  )}
                  {m.disputed && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Disputed</span>
                  )}
                </div>
                {!m.released && (escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onApproveMilestone(escrow.id, m.index, false)}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onApproveMilestone(escrow.id, m.index, true)}
                      className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded-lg transition"
                    >
                      Force
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions */}
      {escrow.transactions?.length > 0 && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Transactions</h3>
          <div className="space-y-2">
            {escrow.transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg text-sm">
                <div>
                  <p className="text-gray-300">{tx.type}</p>
                  <p className="text-xs text-gray-500 font-mono">{tx.txHash?.slice(0, 16)}...</p>
                </div>
                <div className="text-right">
                  <p className="text-white">{tx.amount}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
