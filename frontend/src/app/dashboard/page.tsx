"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import WalletLogin from "@/components/WalletLogin";
import Nav from "@/components/Nav";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const CHAINS = [
  { id: "ETHEREUM", name: "Ethereum", icon: "ETH", chainId: 1, nativeCurrency: "ETH" },
  { id: "BNB_CHAIN", name: "BNB Chain", icon: "BNB", chainId: 56, nativeCurrency: "BNB" },
  { id: "POLYGON", name: "Polygon", icon: "PLY", chainId: 137, nativeCurrency: "MATIC" },
  { id: "ARBITRUM", name: "Arbitrum", icon: "ARB", chainId: 42161, nativeCurrency: "ETH" },
  { id: "BASE", name: "Base", icon: "BAS", chainId: 8453, nativeCurrency: "ETH" },
  { id: "AVALANCHE", name: "Avalanche", icon: "AVA", chainId: 43114, nativeCurrency: "AVAX" },
  { id: "OPTIMISM", name: "Optimism", icon: "OPT", chainId: 10, nativeCurrency: "ETH" },
  { id: "FANTOM", name: "Fantom", icon: "FTM", chainId: 250, nativeCurrency: "FTM" },
];

const NETWORK_ABBR: Record<string, string> = {
  ETHEREUM: "ETH", BNB_CHAIN: "BNB", POLYGON: "PLY", ARBITRUM: "ARB",
  BASE: "BAS", AVALANCHE: "AVA", OPTIMISM: "OPT", FANTOM: "FTM",
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
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"error" | "success">("error");
  const [confirmAction, setConfirmAction] = useState<{ msg: string; fn: () => void } | null>(null);

  const showFeedback = (msg: string, type: "error" | "success" = "error") => {
    setFeedback(msg);
    setFeedbackType(type);
  };

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
        showFeedback("Wallet added successfully", "success");
      } else {
        showFeedback(data.error || "Failed to add wallet");
      }
    } catch {
      showFeedback("Network error");
    }
  };

  const deleteWallet = async (walletId: string) => {
    setConfirmAction({
      msg: "Remove this wallet?",
      fn: async () => {
        try {
          await fetch(`${API}/wallets/${walletId}`, { method: "DELETE", headers });
          setWallets(wallets.filter((w) => w.id !== walletId));
          showFeedback("Wallet removed", "success");
        } catch {
          showFeedback("Failed to delete wallet");
        }
        setConfirmAction(null);
      },
    });
  };

  const setPreferred = async (walletId: string) => {
    try {
      await fetch(`${API}/wallets/${walletId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ isPreferred: true }),
      });
      loadData();
    } catch {
      showFeedback("Failed to update wallet");
    }
  };

  const filteredEscrows = escrows.filter((e) => {
    if (filter === "all") return true;
    if (filter === "buying") return e.buyerId === user?.id;
    if (filter === "selling") return e.sellerId === user?.id;
    if (filter === "active") return ["ACTIVE", "FUNDED"].includes(e.state);
    if (filter === "completed") return e.state === "COMPLETED";
    if (filter === "disputed") return e.state === "DISPUTED";
    return true;
  });

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

  const totalEscrows = escrows.length;
  const activeCount = escrows.filter((e) => ["ACTIVE", "FUNDED"].includes(e.state)).length;
  const disputedCount = escrows.filter((e) => e.state === "DISPUTED").length;
  const completedCount = escrows.filter((e) => e.state === "COMPLETED").length;

  if (!token) {
    return <WalletLogin onAuthenticated={(t) => setToken(t)} />;
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
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
        {confirmAction && (
          <div className="px-4 py-3 mb-6 text-sm border-2 border-yellow-600 bg-yellow-600/5 flex items-center justify-between">
            <span className="text-yellow-700">{confirmAction.msg}</span>
            <div className="flex gap-2">
              <button onClick={confirmAction.fn} className="btn btn-primary text-xs px-3 py-1.5">Confirm</button>
              <button onClick={() => setConfirmAction(null)} className="btn btn-secondary text-xs px-3 py-1.5">Cancel</button>
            </div>
          </div>
        )}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">Dashboard</p>
            <h2 className="text-3xl font-heading font-extrabold text-text">My Escrows</h2>
          </div>
          <Link href="/escrow/create" className="btn btn-primary text-left">
            <Plus size={16} />
            New Escrow
          </Link>
        </div>

        <div className="bg-divider grid grid-cols-2 md:grid-cols-4 gap-[2px] mb-8">
          {[
            { label: "Total Escrows", value: totalEscrows, color: "text-text" },
            { label: "Active", value: activeCount, color: "text-accent" },
            { label: "Disputed", value: disputedCount, color: "text-accent-700" },
            { label: "Completed", value: completedCount, color: "text-neutral-600" },
          ].map((s) => (
            <div key={s.label} className="bg-bg p-5">
              <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">{s.label}</p>
              <p className={`text-[28px] font-heading font-extrabold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="border-b-2 border-divider mb-6 flex gap-0">
          {(["escrows", "wallets", "holdings"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold transition-colors -mb-[2px] border-b-2 ${
                tab === t ? "border-accent text-accent" : "border-transparent text-text hover:text-accent"
              }`}
            >
              {t === "escrows" ? "My Escrows" : t === "wallets" ? "Wallets" : "Holdings"}
            </button>
          ))}
        </div>

        {tab === "escrows" && (
          <div>
            <div className="flex gap-2 flex-wrap mb-6">
              {["all", "buying", "selling", "active", "completed", "disputed"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-sm px-4 py-2 font-semibold transition-colors capitalize ${
                    filter === f
                      ? "bg-accent text-white border-2 border-accent"
                      : "bg-transparent border-2 border-divider text-text hover:border-accent"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-neutral-500 py-8">Loading...</p>
            ) : filteredEscrows.length === 0 ? (
              <div className="text-center py-16 border-2 border-divider">
                <p className="text-neutral-600 text-lg mb-2">No escrows found</p>
                <Link href="/escrow/create" className="text-accent hover:underline text-sm">Create your first escrow</Link>
              </div>
            ) : (
              <div className="border-2 border-divider overflow-x-auto">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Token</th>
                      <th>Network</th>
                      <th>Amount</th>
                      <th>Role</th>
                      <th>Milestones</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEscrows.map((escrow) => {
                      const role = escrow.buyerId === user?.id ? "Buyer" : escrow.sellerId === user?.id ? "Seller" : "Arbiter";
                      const milestoneDone = escrow.milestones?.filter((m: any) => m.released).length || 0;
                      const milestoneTotal = escrow.milestones?.length || 0;
                      return (
                        <tr key={escrow.id} onClick={() => (window.location.href = `/escrow/${escrow.id}`)} className="cursor-pointer">
                          <td className="font-semibold">{escrow.title}</td>
                          <td>{escrow.token?.symbol || "---"}</td>
                          <td>{escrow.network}</td>
                          <td className="font-mono">{escrow.totalAmount}</td>
                          <td>{role}</td>
                          <td>{milestoneDone}/{milestoneTotal}</td>
                          <td>
                            <span className={`tag ${["ACTIVE", "DISPUTED"].includes(escrow.state) ? "tag-accent" : "tag-neutral"}`}>
                              {escrow.state}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "wallets" && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-heading font-extrabold">Connected Wallets</h3>
              <button onClick={() => setShowAddWallet(!showAddWallet)} className="btn btn-secondary text-left">
                <Plus size={16} />
                Add Wallet
              </button>
            </div>
            {showAddWallet && (
              <div className="border-2 border-divider bg-bg p-6 mb-6">
                <h4 className="text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-4">Add New Wallet</h4>
                <div className="space-y-3">
                  <select value={newWalletNetwork} onChange={(e) => setNewWalletNetwork(e.target.value)} className="sd-input">
                    {CHAINS.map((c) => (<option key={c.id} value={c.id}>{c.name} ({c.nativeCurrency})</option>))}
                  </select>
                  <input type="text" placeholder="Wallet address (0x...)" value={newWalletAddress} onChange={(e) => setNewWalletAddress(e.target.value)} className="sd-input font-mono" />
                  <input type="text" placeholder="Label (optional)" value={newWalletLabel} onChange={(e) => setNewWalletLabel(e.target.value)} className="sd-input" />
                  <div className="flex gap-2">
                    <button onClick={addWallet} className="btn btn-primary text-left flex-1">Add Wallet</button>
                    <button onClick={() => setShowAddWallet(false)} className="btn btn-secondary text-left">Cancel</button>
                  </div>
                </div>
              </div>
            )}
            {wallets.length === 0 ? (
              <div className="text-center py-16 border-2 border-divider">
                <p className="text-neutral-600 text-lg mb-1">No wallets connected</p>
              </div>
            ) : (
              <div className="space-y-0">
                {wallets.map((w) => (
                  <div key={w.id} className="flex items-center justify-between p-4 border-2 border-divider -mt-[2px] first:mt-0 bg-bg">
                    <div className="flex items-center gap-4">
                      <div className="w-9 h-9 bg-surface border-2 border-divider flex items-center justify-center text-[11px] font-heading font-extrabold text-text">
                        {NETWORK_ABBR[w.network] || "---"}
                      </div>
                      <div>
                        <p className="text-sm text-text font-mono">{w.address.slice(0, 8)}...{w.address.slice(-6)}</p>
                        <p className="text-xs text-neutral-500">{CHAINS.find((c) => c.id === w.network)?.name || w.network}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {w.isPreferred && <span className="tag tag-accent">PREFERRED</span>}
                      {!w.isPreferred && <button onClick={() => setPreferred(w.id)} className="btn btn-ghost text-sm text-left">Set Preferred</button>}
                      <button onClick={() => deleteWallet(w.id)} className="btn btn-ghost text-sm text-left text-accent">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "holdings" && (
          <div>
            <h3 className="text-xl font-heading font-extrabold mb-4">Escrow Holdings</h3>
            {Object.keys(holdings).length === 0 ? (
              <div className="text-center py-16 border-2 border-divider">
                <p className="text-neutral-600 text-lg mb-1">No tokens in escrow</p>
              </div>
            ) : (
              <div className="bg-divider grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[2px]">
                {Object.values(holdings).map((h: any) => (
                  <div key={`${h.symbol}-${h.network}`} className="bg-bg p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-accent flex items-center justify-center text-[11px] font-heading font-extrabold text-white">
                        {h.symbol.slice(0, 3)}
                      </div>
                      <div>
                        <p className="font-semibold text-text">{h.symbol}</p>
                        <p className="text-xs text-neutral-500">{h.network}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Total Held", value: `${h.totalAmount.toString()} ${h.symbol}` },
                        { label: "Escrows", value: h.escrowCount },
                        { label: "As Buyer", value: h.asBuyer },
                        { label: "As Seller", value: h.asSeller },
                      ].map((row) => (
                        <div key={row.label} className="flex justify-between border-b border-divider pb-2 last:border-0">
                          <span className="text-xs text-neutral-500 uppercase tracking-wider">{row.label}</span>
                          <span className="text-sm text-text">{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
