"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Search, LogOut, Check, Shield, AlertTriangle, Star, Ban, Eye } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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

function stateTag(state: string) {
  switch (state) {
    case "FUNDED":
    case "ACTIVE":
      return "tag tag-accent";
    case "COMPLETED":
      return "tag bg-green-600/10 text-green-700 border border-green-600/30";
    case "DISPUTED":
      return "tag bg-red-600/10 text-red-700 border border-red-600/30";
    case "REFUNDED":
      return "tag bg-yellow-600/10 text-yellow-700 border border-yellow-600/30";
    default:
      return "tag tag-neutral";
  }
}

const NETWORK_ABBR: Record<string, string> = {
  ETHEREUM: "ETH",
  BNB_CHAIN: "BNB",
  POLYGON: "POL",
  ARBITRUM: "ARB",
  BASE: "BASE",
  AVALANCHE: "AVAX",
  OPTIMISM: "OP",
  FANTOM: "FTM",
};

export default function AdminDashboard() {
  const [tab, setTab] = useState<"overview" | "users" | "escrows" | "tokens" | "disputes" | "deposits">("overview");
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [userAssets, setUserAssets] = useState<UserAsset[]>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAsset | null>(null);
  const [selectedEscrow, setSelectedEscrow] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [tokens, setTokens] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [depositAddresses, setDepositAddresses] = useState({ bnbBep20Usdt: "", tronTrc20Usdt: "", solana: "" });
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"error" | "success">("error");
  const [promptState, setPromptState] = useState<{ msg: string; value: string; fn: (val: string) => void } | null>(null);
  const [loginError, setLoginError] = useState("");

  const showFeedback = (msg: string, type: "error" | "success" = "error") => {
    setFeedback(msg);
    setFeedbackType(type);
  };

  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

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
      const res = await fetch(`${API}/admin/user-assets?search=${encodeURIComponent(search)}&page=${page}`, { headers });
      const data = await res.json();
      setUserAssets(data.users || []);
    } catch (err) {
      console.error("Failed to load user assets", err);
    }
    setLoading(false);
  }, [token, search, page]);

  const loadEscrows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/escrows?search=${encodeURIComponent(search)}&page=${page}`, { headers });
      const data = await res.json();
      setEscrows(data.escrows || []);
    } catch (err) {
      console.error("Failed to load escrows", err);
    }
    setLoading(false);
  }, [token, search, page]);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/tokens?page=${page}`, { headers });
      const data = await res.json();
      setTokens(data.tokens || []);
    } catch (err) {
      console.error("Failed to load tokens", err);
    }
    setLoading(false);
  }, [token, page]);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/disputes?page=${page}`, { headers });
      const data = await res.json();
      setDisputes(data.disputes || []);
    } catch (err) {
      console.error("Failed to load disputes", err);
    }
    setLoading(false);
  }, [token, page]);

  const loadDepositAddresses = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/deposit-addresses`, { headers });
      const data = await res.json();
      if (res.ok) setDepositAddresses(data.addresses || {});
    } catch { showFeedback("Failed to load deposit addresses"); }
  }, [token]);

  const saveDepositAddresses = async () => {
    try {
      const res = await fetch(`${API}/admin/deposit-addresses`, { method: "PATCH", headers, body: JSON.stringify(depositAddresses) });
      const data = await res.json();
      if (!res.ok) { showFeedback(data.error || "Failed to save deposit addresses"); return; }
      setDepositAddresses(data.addresses);
      showFeedback("Deposit addresses saved as display-only custodial destinations", "success");
    } catch { showFeedback("Failed to save deposit addresses"); }
  };

  const updateTokenStatus = async (tokenId: string, status: string) => {
    try {
      const res = await fetch(`${API}/admin/tokens/${tokenId}/status`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback(`Token status updated to ${status}`, "success");
        loadTokens();
      } else {
        showFeedback(data.error || "Failed to update token status");
      }
    } catch {
      showFeedback("Failed to update token status");
    }
  };

  const resolveDispute = (disputeId: string, outcome: string) => {
    setPromptState({
      msg: `Resolution notes for ${outcome} (optional):`,
      value: "",
      fn: async (notes: string) => {
        setPromptState(null);
        try {
          const res = await fetch(`${API}/admin/disputes/${disputeId}/resolve`, {
            method: "POST",
            headers,
            body: JSON.stringify({ outcome, notes }),
          });
          const data = await res.json();
          if (res.ok) {
            showFeedback(`Dispute resolved: ${outcome}`, "success");
            loadDisputes();
          } else {
            showFeedback(data.error || "Failed to resolve dispute");
          }
        } catch {
          showFeedback("Failed to resolve dispute");
        }
      },
    });
  };

  useEffect(() => {
    if (!token) return;
    if (tab === "overview") loadOverview();
    else if (tab === "users") loadUserAssets();
    else if (tab === "escrows") loadEscrows();
    else if (tab === "tokens") loadTokens();
    else if (tab === "disputes") loadDisputes();
    else if (tab === "deposits") loadDepositAddresses();
  }, [tab, token, page]);

  const approveMilestone = async (escrowId: string, milestoneIndex: number, force = false) => {
    try {
      const res = await fetch(`${API}/admin/escrows/${escrowId}/approve-milestone/${milestoneIndex}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(`Milestone approved. Tx: ${data.txHash?.slice(0, 16)}...`, "success");
        loadEscrows();
      } else {
        showFeedback(data.error || "Failed to approve milestone");
      }
    } catch {
      showFeedback("Failed to approve milestone");
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
        showFeedback(`All milestones approved. Tx: ${data.txHash?.slice(0, 16)}...`, "success");
        loadEscrows();
      } else {
        showFeedback(data.error || "Failed to approve all");
      }
    } catch {
      showFeedback("Failed to approve all");
    }
  };

  const toggleFreeze = (userId: string, currentlyFrozen: boolean) => {
    setPromptState({
      msg: `Reason to ${currentlyFrozen ? "unfreeze" : "freeze"} this user:`,
      value: "",
      fn: async (reason: string) => {
        setPromptState(null);
        try {
          await fetch(`${API}/admin/users/${userId}/status`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              status: currentlyFrozen ? "ACTIVE" : "FROZEN",
              reason,
            }),
          });
          showFeedback(`User ${currentlyFrozen ? "unfrozen" : "frozen"}`, "success");
          loadUserAssets();
        } catch {
          showFeedback("Failed to update user status");
        }
      },
    });
  };

  // Login Screen
  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-full max-w-md p-8 border-2 border-divider bg-surface">
          <div className="flex items-center gap-2 mb-6 justify-center">
            <Shield className="w-5 h-5 text-accent" />
            <h1 className="text-xl font-heading font-extrabold">Admin Login</h1>
          </div>
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
                setLoginError(data.error || "Login failed");
              }
            }}
            className="space-y-4"
          >
            {loginError && (
              <div className="border-2 border-accent bg-accent/5 text-accent px-4 py-3 text-sm">
                {loginError}
              </div>
            )}
            <input
              name="email"
              type="email"
              placeholder="Admin email"
              className="sd-input w-full"
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              className="sd-input w-full"
            />
            <button type="submit" className="btn btn-primary w-full">
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "users" as const, label: "Users & Assets" },
    { key: "escrows" as const, label: "Escrows" },
    { key: "tokens" as const, label: "Tokens" },
    { key: "disputes" as const, label: "Disputes" },
    { key: "deposits" as const, label: "Deposit Addresses" },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Header */}
      <nav className="sticky top-0 z-50 bg-bg border-b-2 border-divider">
        <div className="max-w-[1120px] mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" fill="#ec3013" />
              <path d="M8 10H12V20H8V10Z" fill="#f3f2f2" />
              <path d="M14 13H18V20H14V13Z" fill="#f3f2f2" opacity="0.8" />
              <path d="M20 8H24V20H20V8Z" fill="#f3f2f2" />
              <rect x="6" y="21" width="20" height="2" fill="#f3f2f2" />
            </svg>
            <span className="font-heading font-extrabold text-lg">SurveyDeal</span>
            <span className="tag tag-accent ml-1">ADMIN</span>
          </Link>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
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
                className="sd-input pl-10 w-72"
              />
            </div>
            <Link href="/dashboard" className="text-sm hover:text-accent transition-colors">
              Dashboard
            </Link>
            <button
              onClick={() => { localStorage.removeItem("admin_token"); setToken(""); }}
              className="text-sm opacity-60 hover:opacity-100 transition-opacity flex items-center gap-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1120px] mx-auto px-6 py-6">
        {/* Feedback */}
        {feedback && (
          <div className={`px-4 py-3 mb-6 text-sm border-2 ${
            feedbackType === "error"
              ? "border-accent bg-accent-100 text-accent-700"
              : "border-green-600 bg-green-600/5 text-green-700"
          }`}>
            {feedback}
            <button onClick={() => setFeedback("")} className="float-right opacity-50 hover:opacity-100">&times;</button>
          </div>
        )}
        {promptState && (
          <div className="px-4 py-3 mb-6 border-2 border-divider bg-surface">
            <p className="text-sm font-semibold mb-2">{promptState.msg}</p>
            <input
              type="text"
              value={promptState.value}
              onChange={(e) => setPromptState({ ...promptState, value: e.target.value })}
              className="sd-input w-full mb-2"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => promptState.fn(promptState.value)} className="btn btn-primary text-xs px-3 py-1.5">Submit</button>
              <button onClick={() => setPromptState(null)} className="btn btn-secondary text-xs px-3 py-1.5">Cancel</button>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-6">
          <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">Admin</p>
          <h2 className="text-3xl font-heading font-extrabold text-text">Protocol Management</h2>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-0 mb-6 border-b-2 border-divider">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); setSelectedUser(null); setSelectedEscrow(null); }}
              className={`px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-[2px] ${
                tab === t.key
                  ? "border-accent text-accent"
                  : "border-transparent opacity-50 hover:opacity-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && overview && (
          <div className="space-y-6">
            <div className="bg-divider grid grid-cols-2 md:grid-cols-4 gap-[2px]">
              {[
                { label: "Total Escrows", value: overview.totalEscrows },
                { label: "Active", value: overview.activeEscrows },
                { label: "Disputed", value: overview.disputedEscrows },
                { label: "Completed", value: overview.completedEscrows },
                { label: "Refunded", value: overview.refundedEscrows },
                { label: "Total Users", value: overview.totalUsers },
                { label: "Frozen Users", value: overview.frozenUsers },
                { label: "Total Volume", value: `${(Number(overview.totalVolume) / 1e18).toFixed(2)}` },
              ].map((stat) => (
                <div key={stat.label} className="bg-bg p-5">
                  <p className="text-xs opacity-50 uppercase tracking-wider font-semibold">{stat.label}</p>
                  <p className="text-2xl font-heading font-extrabold mt-1">{stat.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div className="space-y-4">
            {loading && <p className="text-sm opacity-50">Loading...</p>}

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
                  className="sd-card p-5 cursor-pointer hover:border-text/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-divider flex items-center justify-center text-sm font-bold font-mono">
                        {user.walletAddress.slice(2, 4).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">
                          {user.displayName || user.walletAddress.slice(0, 10) + "..."}
                        </p>
                        <p className="text-xs opacity-50 font-mono">{user.walletAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.isFrozen && <span className="tag bg-red-600/10 text-red-700 border border-red-600/30">FROZEN</span>}
                      {user.isAdmin && <span className="tag tag-accent">ADMIN</span>}
                      {user.wallets.length > 0 && (
                        <span className="tag tag-neutral">
                          {user.wallets.length} wallet{user.wallets.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs opacity-50">Buy Escrows</p>
                      <p className="text-sm font-semibold">{user.stats.totalBuyEscrows}</p>
                      <p className="text-xs opacity-40">{user.stats.activeBuyEscrows} active</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Sell Escrows</p>
                      <p className="text-sm font-semibold">{user.stats.totalSellEscrows}</p>
                      <p className="text-xs opacity-40">{user.stats.activeSellEscrows} active</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Buy Volume</p>
                      <p className="text-sm font-semibold">
                        {Number(user.stats.totalBuyVolume) > 0
                          ? (Number(user.stats.totalBuyVolume) / 1e18).toFixed(4)
                          : "0"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Sell Volume</p>
                      <p className="text-sm font-semibold">
                        {Number(user.stats.totalSellVolume) > 0
                          ? (Number(user.stats.totalSellVolume) / 1e18).toFixed(4)
                          : "0"}
                      </p>
                    </div>
                  </div>

                  {user.wallets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {user.wallets.map((w) => (
                        <span key={w.id} className="tag tag-neutral text-xs">
                          {NETWORK_ABBR[w.network] || w.network} {w.isPreferred ? "·P" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ESCROWS TAB */}
        {tab === "escrows" && (
          <div className="space-y-4">
            {loading && <p className="text-sm opacity-50">Loading...</p>}

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
                  className="sd-card p-5 cursor-pointer hover:border-text/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-heading font-extrabold">{escrow.title}</p>
                      <p className="text-xs opacity-50 mt-1">
                        #{escrow.onChainId} · {escrow.token?.symbol} · {NETWORK_ABBR[escrow.network] || escrow.network}
                      </p>
                    </div>
                    <span className={stateTag(escrow.state)}>
                      {escrow.state}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mt-4">
                    <div>
                      <p className="text-xs opacity-50">Buyer</p>
                      <p className="text-xs font-mono">{escrow.buyer?.walletAddress?.slice(0, 8)}...</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Seller</p>
                      <p className="text-xs font-mono">{escrow.seller?.walletAddress?.slice(0, 8)}...</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Amount</p>
                      <p className="text-sm font-semibold">{escrow.totalAmount}</p>
                    </div>
                    <div>
                      <p className="text-xs opacity-50">Milestones</p>
                      <p className="text-sm font-semibold">
                        {escrow.milestones?.filter((m: any) => m.released).length || 0}/{escrow.milestones?.length || 0}
                      </p>
                    </div>
                  </div>

                  {(escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && (
                    <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => approveAll(escrow.id)}
                        className="btn btn-primary text-xs py-1.5 px-3"
                      >
                        <Check className="w-3 h-3" />
                        Approve All
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* TOKENS TAB */}
        {tab === "tokens" && (
          <div className="space-y-4">
            {loading && <p className="text-sm opacity-50">Loading...</p>}
            {tokens.map((tk) => (
              <div key={tk.id} className="sd-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {tk.logoUrl ? (
                      <img src={tk.logoUrl} alt={tk.symbol} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 bg-divider flex items-center justify-center text-sm font-bold">
                        {tk.symbol?.slice(0, 2)}
                      </div>
                    )}
                    <div>
                      <p className="font-heading font-extrabold">{tk.symbol}</p>
                      <p className="text-xs opacity-50">{tk.name}</p>
                      <p className="text-xs opacity-40 font-mono mt-0.5">{tk.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tag tag-neutral text-xs">{NETWORK_ABBR[tk.network] || tk.network}</span>
                    <span className={`tag text-xs ${
                      tk.status === "FEATURED" ? "tag-accent" :
                      tk.status === "BLACKLISTED" ? "bg-red-600/10 text-red-700 border border-red-600/30" :
                      "tag-neutral"
                    }`}>
                      {tk.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div>
                    <p className="text-xs opacity-50">Chain ID</p>
                    <p className="text-sm font-semibold">{tk.chainId}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-50">Decimals</p>
                    <p className="text-sm font-semibold">{tk.decimals}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-50">Has Tax</p>
                    <p className="text-sm font-semibold">{tk.hasTax ? `Yes (${tk.taxBasisPoints} bps)` : "No"}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-50">Escrows</p>
                    <p className="text-sm font-semibold">{tk._count?.escrows ?? 0}</p>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {tk.status !== "ACTIVE" && (
                    <button
                      onClick={() => updateTokenStatus(tk.id, "ACTIVE")}
                      className="btn btn-secondary text-xs py-1.5 px-3 flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      Set Active
                    </button>
                  )}
                  {tk.status !== "FEATURED" && (
                    <button
                      onClick={() => updateTokenStatus(tk.id, "FEATURED")}
                      className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" />
                      Feature
                    </button>
                  )}
                  {tk.status !== "BLACKLISTED" && (
                    <button
                      onClick={() => updateTokenStatus(tk.id, "BLACKLISTED")}
                      className="btn btn-secondary text-xs py-1.5 px-3 border-red-600 text-red-700 hover:bg-red-600/5 flex items-center gap-1"
                    >
                      <Ban className="w-3 h-3" />
                      Blacklist
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!loading && tokens.length === 0 && (
              <div className="sd-card p-10 text-center">
                <p className="text-sm opacity-50">No tokens found.</p>
              </div>
            )}
          </div>
        )}

        {/* DISPUTES TAB */}
        {tab === "disputes" && (
          <div className="space-y-4">
            {loading && <p className="text-sm opacity-50">Loading...</p>}
            {disputes.map((d) => (
              <div key={d.id} className="sd-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-heading font-extrabold">
                      Dispute on Escrow #{d.escrow?.onChainId ?? d.escrowId?.slice(0, 8)}
                    </p>
                    <p className="text-xs opacity-50 mt-1">
                      {d.escrow?.title} · {NETWORK_ABBR[d.escrow?.network] || d.escrow?.network}
                    </p>
                  </div>
                  <span className={`tag text-xs ${
                    d.outcome === "PENDING" ? "bg-yellow-600/10 text-yellow-700 border border-yellow-600/30" :
                    d.outcome === "BUYER_FAVORED" ? "bg-blue-600/10 text-blue-700 border border-blue-600/30" :
                    d.outcome === "SELLER_FAVORED" ? "bg-green-600/10 text-green-700 border border-green-600/30" :
                    "tag-accent"
                  }`}>
                    {d.outcome}
                  </span>
                </div>

                <div className="mt-3 p-3 border-2 border-divider">
                  <p className="text-xs opacity-50 mb-1">Reason</p>
                  <p className="text-sm">{d.reason}</p>
                  {d.evidence && (
                    <>
                      <p className="text-xs opacity-50 mb-1 mt-2">Evidence</p>
                      <p className="text-sm opacity-80">{d.evidence}</p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mt-4">
                  <div>
                    <p className="text-xs opacity-50">Initiator</p>
                    <p className="text-xs font-mono">{d.initiator?.walletAddress?.slice(0, 10)}...</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-50">Milestone</p>
                    <p className="text-sm font-semibold">{d.milestone ? `#${d.milestone.index + 1}: ${d.milestone.description}` : "All"}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-50">Filed</p>
                    <p className="text-sm">{new Date(d.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                {d.outcome === "PENDING" && (
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => resolveDispute(d.id, "BUYER_FAVORED")}
                      className="btn btn-secondary text-xs py-1.5 px-3"
                    >
                      Favor Buyer
                    </button>
                    <button
                      onClick={() => resolveDispute(d.id, "SELLER_FAVORED")}
                      className="btn btn-secondary text-xs py-1.5 px-3"
                    >
                      Favor Seller
                    </button>
                    <button
                      onClick={() => resolveDispute(d.id, "SPLIT")}
                      className="btn btn-primary text-xs py-1.5 px-3"
                    >
                      Split
                    </button>
                  </div>
                )}

                {d.resolvedAt && (
                  <p className="text-xs opacity-40 mt-3">
                    Resolved {new Date(d.resolvedAt).toLocaleString()}
                    {d.resolver ? ` by ${d.resolver.walletAddress?.slice(0, 10)}...` : ""}
                  </p>
                )}
              </div>
            ))}
            {!loading && disputes.length === 0 && (
              <div className="sd-card p-10 text-center">
                <p className="text-sm opacity-50">No disputes found.</p>
              </div>
            )}
          </div>
        )}

        {/* DEPOSIT ADDRESSES TAB */}
        {tab === "deposits" && (
          <div className="sd-card p-6 max-w-3xl">
            <div className="border-2 border-yellow-700 bg-yellow-50 text-yellow-900 p-4 mb-6">
              <p className="text-sm"><strong>Display-only custodial addresses.</strong> These are shared receiving wallets, not per-escrow contract addresses. Do not enable this panel for real funds until monitoring, attribution, sweeping, recovery, and reconciliation are operational.</p>
            </div>
            <div className="space-y-5">
              {[
                ["bnbBep20Usdt", "BNB Smart Chain / BEP-20 USDT"],
                ["tronTrc20Usdt", "TRON / TRC-20 USDT"],
                ["solana", "Solana"],
              ].map(([key, label]) => (
                <label key={key} className="block">
                  <span className="block text-xs uppercase tracking-wider opacity-60 mb-2">{label}</span>
                  <input className="sd-input w-full font-mono text-sm" value={depositAddresses[key as keyof typeof depositAddresses]} onChange={(e) => setDepositAddresses({ ...depositAddresses, [key]: e.target.value })} />
                </label>
              ))}
            </div>
            <button onClick={saveDepositAddresses} className="btn btn-primary mt-6">Save display-only addresses</button>
          </div>
        )}

        {/* Pagination */}
        {(tab === "users" || tab === "escrows" || tab === "tokens" || tab === "disputes") && !selectedUser && !selectedEscrow && (
          <div className="flex justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="btn btn-secondary text-sm disabled:opacity-30"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm opacity-50">Page {page}</span>
            <button
              onClick={() => setPage(page + 1)}
              className="btn btn-secondary text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

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
      <button onClick={onBack} className="text-sm text-accent hover:opacity-70 transition-opacity flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Users
      </button>

      {/* User Header */}
      <div className="sd-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-divider flex items-center justify-center text-xl font-bold font-mono">
              {user.walletAddress.slice(2, 4).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-heading font-extrabold">
                {user.displayName || "Unnamed User"}
              </h2>
              <p className="text-sm opacity-50 font-mono">{user.walletAddress}</p>
              {user.email && <p className="text-xs opacity-40">{user.email}</p>}
            </div>
          </div>
          <div className="flex gap-2 items-center">
            {user.isFrozen && (
              <span className="tag bg-red-600/10 text-red-700 border border-red-600/30">FROZEN</span>
            )}
            <button
              onClick={() => onFreeze(user.id, user.isFrozen)}
              className={user.isFrozen ? "btn btn-primary text-sm" : "btn btn-secondary text-sm border-red-600 text-red-700 hover:bg-red-600/5"}
            >
              {user.isFrozen ? "Unfreeze" : "Freeze"}
            </button>
          </div>
        </div>

        <div className="bg-divider grid grid-cols-3 md:grid-cols-6 gap-[2px] mt-6">
          {[
            { label: "Total Volume", value: (Number(user.stats.totalVolume) / 1e18).toFixed(4) },
            { label: "Buy Escrows", value: user.stats.totalBuyEscrows },
            { label: "Sell Escrows", value: user.stats.totalSellEscrows },
            { label: "Active Buy", value: user.stats.activeBuyEscrows },
            { label: "Active Sell", value: user.stats.activeSellEscrows },
            { label: "Wallets", value: user.wallets.length },
          ].map((s) => (
            <div key={s.label} className="bg-bg p-3">
              <p className="text-xs opacity-50">{s.label}</p>
              <p className="text-lg font-heading font-extrabold">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Wallets */}
      <div className="sd-card p-6">
        <h3 className="text-base font-heading font-extrabold mb-4">Connected Wallets</h3>
        {user.wallets.length === 0 ? (
          <p className="text-sm opacity-50">No wallets connected</p>
        ) : (
          <div className="space-y-2">
            {user.wallets.map((w) => (
              <div key={w.id} className="flex items-center justify-between p-3 border-2 border-divider">
                <div className="flex items-center gap-3">
                  <span className="tag tag-neutral text-xs">{NETWORK_ABBR[w.network] || w.network}</span>
                  <div>
                    <p className="text-sm font-mono">{w.address}</p>
                    <p className="text-xs opacity-40">{w.network} {w.label ? `· ${w.label}` : ""}</p>
                  </div>
                </div>
                {w.isPreferred && (
                  <span className="tag tag-accent text-xs">Preferred</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Escrows */}
      <div className="grid grid-cols-2 gap-6">
        <div className="sd-card p-6">
          <h3 className="text-base font-heading font-extrabold mb-4">Buy Escrows</h3>
          {user.recentBuyEscrows.length === 0 ? (
            <p className="text-sm opacity-50">No buy escrows</p>
          ) : (
            <div className="space-y-2">
              {user.recentBuyEscrows.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 border-2 border-divider">
                  <div>
                    <p className="text-sm font-semibold">{e.token.symbol} · #{e.id.slice(0, 8)}</p>
                    <p className="text-xs opacity-40">{new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{e.totalAmount}</p>
                    <span className={stateTag(e.state) + " text-xs"}>{e.state}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sd-card p-6">
          <h3 className="text-base font-heading font-extrabold mb-4">Sell Escrows</h3>
          {user.recentSellEscrows.length === 0 ? (
            <p className="text-sm opacity-50">No sell escrows</p>
          ) : (
            <div className="space-y-2">
              {user.recentSellEscrows.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 border-2 border-divider">
                  <div>
                    <p className="text-sm font-semibold">{e.token.symbol} · #{e.id.slice(0, 8)}</p>
                    <p className="text-xs opacity-40">{new Date(e.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{e.totalAmount}</p>
                    <span className={stateTag(e.state) + " text-xs"}>{e.state}</span>
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
      <button onClick={onBack} className="text-sm text-accent hover:opacity-70 transition-opacity flex items-center gap-1">
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Escrows
      </button>

      <div className="sd-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-heading font-extrabold">{escrow.title}</h2>
            <p className="text-sm opacity-50 mt-1">
              Escrow #{escrow.onChainId} · {escrow.token?.symbol} · {NETWORK_ABBR[escrow.network] || escrow.network}
            </p>
          </div>
          <span className={stateTag(escrow.state)}>
            {escrow.state}
          </span>
        </div>

        {/* Parties */}
        <div className="bg-divider grid grid-cols-3 gap-[2px] mt-6">
          {[
            { label: "Buyer", data: escrow.buyer },
            { label: "Seller", data: escrow.seller },
            { label: "Arbiter", data: escrow.arbiter },
          ].map((p) => (
            <div key={p.label} className="bg-bg p-4">
              <p className="text-xs opacity-50 mb-1">{p.label}</p>
              {p.data ? (
                <>
                  <p className="text-sm font-mono">
                    {p.data.walletAddress?.slice(0, 8)}...
                  </p>
                  <p className="text-xs opacity-40">{p.data.displayName || "Unnamed"}</p>
                </>
              ) : (
                <p className="text-sm opacity-40">None</p>
              )}
            </div>
          ))}
        </div>

        {/* Amounts */}
        <div className="bg-divider grid grid-cols-4 gap-[2px] mt-[2px]">
          {[
            { label: "Total Amount", value: escrow.totalAmount },
            { label: "Funded", value: escrow.fundedAmount },
            { label: "Released", value: escrow.releasedAmount },
            { label: "Protocol Fees", value: escrow.protocolFeeTotal },
          ].map((a) => (
            <div key={a.label} className="bg-bg p-3">
              <p className="text-xs opacity-50">{a.label}</p>
              <p className="text-sm font-semibold">{a.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Milestones */}
      <div className="sd-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-heading font-extrabold">Milestones</h3>
          {(escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && (
            <button
              onClick={() => onApproveAll(escrow.id)}
              className="btn btn-primary text-sm"
            >
              <Check className="w-3.5 h-3.5" />
              Approve All
            </button>
          )}
        </div>
        <div className="space-y-2">
          {escrow.milestones?.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-4 border-2 border-divider">
              <div className="flex items-center gap-4">
                <span className="w-8 h-8 bg-divider flex items-center justify-center text-sm font-bold">
                  {m.index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{m.description}</p>
                  <p className="text-xs opacity-50">Amount: {m.amount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {m.sellerDelivered && <span className="tag tag-neutral text-xs">Delivered</span>}
                  {m.buyerApproved && <span className="tag bg-green-600/10 text-green-700 border border-green-600/30 text-xs">Approved</span>}
                  {m.adminApproved && <span className="tag tag-accent text-xs">Admin</span>}
                  {m.released && <span className="tag bg-green-600/10 text-green-700 border border-green-600/30 text-xs">Released</span>}
                  {m.disputed && <span className="tag bg-red-600/10 text-red-700 border border-red-600/30 text-xs">Disputed</span>}
                </div>
                {!m.released && (escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onApproveMilestone(escrow.id, m.index, false)}
                      className="btn btn-primary text-xs py-1 px-3"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onApproveMilestone(escrow.id, m.index, true)}
                      className="btn btn-secondary text-xs py-1 px-3"
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
        <div className="sd-card p-6">
          <h3 className="text-base font-heading font-extrabold mb-4">Transactions</h3>
          <div className="space-y-1">
            {escrow.transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-3 border-2 border-divider text-sm">
                <div>
                  <p className="font-semibold">{tx.type}</p>
                  <p className="text-xs opacity-40 font-mono">{tx.txHash?.slice(0, 16)}...</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{tx.amount}</p>
                  <p className="text-xs opacity-40">{new Date(tx.createdAt).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
