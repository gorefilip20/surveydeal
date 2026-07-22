"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

// Dynamically import QRCodeSVG to avoid SSR issues
const QRCodeSVG = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), {
  ssr: false,
});

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const STATE_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  CREATED: { color: "text-gray-400", bg: "bg-gray-500/20", icon: "📝", label: "Created" },
  FUNDED: { color: "text-yellow-400", bg: "bg-yellow-500/20", icon: "💰", label: "Funded" },
  ACTIVE: { color: "text-blue-400", bg: "bg-blue-500/20", icon: "🔄", label: "Active" },
  COMPLETED: { color: "text-green-400", bg: "bg-green-500/20", icon: "✅", label: "Completed" },
  DISPUTED: { color: "text-red-400", bg: "bg-red-500/20", icon: "⚠️", label: "Disputed" },
  REFUNDED: { color: "text-orange-400", bg: "bg-orange-500/20", icon: "↩️", label: "Refunded" },
};

const NETWORK_ICONS: Record<string, string> = {
  ETHEREUM: "🔷", BNB_CHAIN: "🟡", POLYGON: "🟣", ARBITRUM: "🔵",
  BASE: "🔷", AVALANCHE: "🔺", OPTIMISM: "🔴", FANTOM: "👻",
  SOLANA: "☀️", TRON: "🔴",
};

export default function EscrowDetailPage() {
  const params = useParams();
  const escrowId = params?.id as string;
  const [token, setToken] = useState("");
  const [escrow, setEscrow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("user_token") || localStorage.getItem("admin_token");
    if (stored) setToken(stored);
  }, []);

  const loadEscrow = useCallback(async () => {
    if (!token || !escrowId) return;
    try {
      // Try admin endpoint first, then user endpoint
      let res = await fetch(`${API}/admin/escrows/${escrowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        res = await fetch(`${API}/escrows/${escrowId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      const data = await res.json();
      setEscrow(data);
    } catch (err) {
      console.error("Failed to load escrow", err);
    }
    setLoading(false);
  }, [token, escrowId]);

  useEffect(() => {
    loadEscrow();
  }, [loadEscrow]);

  // Admin approve milestone
  const approveMilestone = async (milestoneIndex: number, force = false) => {
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/escrows/${escrowId}/approve-milestone/${milestoneIndex}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ Milestone ${milestoneIndex + 1} approved! TX: ${data.txHash?.slice(0, 16)}...`);
        loadEscrow();
      } else {
        setMessage(`❌ ${data.error || "Failed to approve"}`);
      }
    } catch (err) {
      setMessage("❌ Network error");
    }
    setActionLoading(false);
  };

  // Admin approve all
  const approveAll = async () => {
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/escrows/${escrowId}/approve-all`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ All milestones approved! TX: ${data.txHash?.slice(0, 16)}...`);
        loadEscrow();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage("❌ Network error");
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">Loading escrow...</div>
      </div>
    );
  }

  if (!escrow || escrow.error) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 text-lg">Escrow not found</p>
          <a href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const stateConf = STATE_CONFIG[escrow.state] || STATE_CONFIG.CREATED;
  const releasedMilestones = escrow.milestones?.filter((m: any) => m.released).length || 0;
  const totalMilestones = escrow.milestones?.length || 0;
  const isAdmin = !!localStorage.getItem("admin_token");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-lg font-bold">
              SD
            </div>
            <div>
              <h1 className="text-lg font-bold">{escrow.title}</h1>
              <p className="text-xs text-gray-400">Escrow #{escrow.onChainId} • {escrow.network}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm px-4 py-1.5 rounded-full ${stateConf.bg} ${stateConf.color}`}>
              {stateConf.icon} {stateConf.label}
            </span>
            <a href="/dashboard" className="text-sm text-gray-400 hover:text-white transition">
              ← Dashboard
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Message */}
        {message && (
          <div className={`px-4 py-3 rounded-lg mb-6 text-sm ${
            message.startsWith("✅")
              ? "bg-green-500/10 border border-green-500/30 text-green-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}>
            {message}
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Progress</span>
            <span className="text-sm text-white">{releasedMilestones}/{totalMilestones} milestones released</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
              style={{ width: `${totalMilestones > 0 ? (releasedMilestones / totalMilestones) * 100 : 0}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Parties */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Parties</h3>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Buyer", data: escrow.buyer, role: "buyer" },
                  { label: "Seller", data: escrow.seller, role: "seller" },
                  { label: "Arbiter", data: escrow.arbiter, role: "arbiter" },
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
                      <p className="text-sm text-gray-500">Not set</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Token Info */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Token Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Token</p>
                  <p className="text-sm font-medium text-white">{escrow.token?.symbol || "N/A"}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Network</p>
                  <p className="text-sm font-medium text-white">
                    {NETWORK_ICONS[escrow.network] || ""} {escrow.network}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">CA</p>
                  <p className="text-xs text-gray-300 font-mono">
                    {escrow.token?.address?.slice(0, 8)}...
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mode</p>
                  <p className="text-sm font-medium text-white">
                    {escrow.mode === "ARBITER" ? "👨‍⚖️ Arbiter" : "🔒 Locked"}
                  </p>
                </div>
              </div>
            </div>

            {/* Amounts */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Amounts</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total Amount", value: escrow.totalAmount, color: "text-white" },
                  { label: "Funded", value: escrow.fundedAmount, color: "text-yellow-400" },
                  { label: "Released", value: escrow.releasedAmount, color: "text-green-400" },
                  { label: "Protocol Fees", value: escrow.protocolFeeTotal, color: "text-purple-400" },
                ].map((a) => (
                  <div key={a.label} className="bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">{a.label}</p>
                    <p className={`text-sm font-medium ${a.color}`}>{a.value} {escrow.token?.symbol}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Milestones */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Milestones</h3>
                {(escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && isAdmin && (
                  <button
                    onClick={approveAll}
                    disabled={actionLoading}
                    className="text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white px-4 py-2 rounded-lg transition"
                  >
                    {actionLoading ? "Processing..." : "✅ Approve All"}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {escrow.milestones?.map((m: any) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition ${
                      m.released
                        ? "bg-green-500/5 border-green-500/30"
                        : "bg-gray-800/50 border-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                          m.released
                            ? "bg-green-600 text-white"
                            : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {m.released ? "✓" : m.index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{m.description}</p>
                        <p className="text-xs text-gray-400">
                          {m.amount} {escrow.token?.symbol}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Status badges */}
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {m.sellerDelivered && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                            Delivered
                          </span>
                        )}
                        {m.buyerApproved && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                            Approved
                          </span>
                        )}
                        {m.adminApproved && (
                          <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                        {m.disputed && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                            Disputed
                          </span>
                        )}
                        {m.released && (
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                            Released ✓
                          </span>
                        )}
                      </div>

                      {/* Admin action buttons */}
                      {!m.released && isAdmin && (escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && (
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() => approveMilestone(m.index, false)}
                            disabled={actionLoading}
                            className="text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => approveMilestone(m.index, true)}
                            disabled={actionLoading}
                            className="text-xs bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition"
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-3">
                {escrow.state === "CREATED" && (
                  <button className="w-full bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-xl transition text-sm font-medium">
                    💰 Fund Escrow
                  </button>
                )}
                {escrow.state === "FUNDED" && (
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl transition text-sm font-medium">
                    🔄 Activate Escrow
                  </button>
                )}
                {(escrow.state === "ACTIVE" || escrow.state === "DISPUTED") && (
                  <button className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 py-3 rounded-xl transition text-sm font-medium border border-red-500/30">
                    ⚠️ Initiate Dispute
                  </button>
                )}
                {escrow.state !== "COMPLETED" && escrow.state !== "REFUNDED" && (
                  <button className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl transition text-sm font-medium">
                    ↩️ Request Refund
                  </button>
                )}
                {isAdmin && (
                  <div className="pt-3 border-t border-gray-700">
                    <p className="text-xs text-gray-500 mb-2">Admin Actions</p>
                    <button
                      onClick={approveAll}
                      disabled={actionLoading}
                      className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white py-3 rounded-xl transition text-sm font-medium"
                    >
                      {actionLoading ? "Processing..." : "🔐 Approve All Milestones"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Deposit Info */}
            {escrow.state === "CREATED" || escrow.state === "FUNDED" ? (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold mb-4">Deposit Info</h3>
                {escrow.depositWalletAddr ? (
                  <div className="space-y-4">
                    {/* QR Code */}
                    <div className="flex justify-center">
                      <div className="bg-white p-4 rounded-xl">
                        <QRCodeSVG
                          value={escrow.depositWalletAddr}
                          size={160}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Deposit Address</p>
                      <p className="text-sm text-white font-mono break-all">{escrow.depositWalletAddr}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Expected Amount</p>
                      <p className="text-sm text-white">{escrow.totalAmount} {escrow.token?.symbol}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Network</p>
                      <p className="text-sm text-white">{NETWORK_ICONS[escrow.network] || ""} {escrow.network}</p>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(escrow.depositWalletAddr)}
                      className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm py-2 rounded-lg transition"
                    >
                      📋 Copy Address
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Deposit wallet not yet generated</p>
                )}
              </div>
            ) : null}

            {/* Transactions */}
            {escrow.transactions?.length > 0 && (
              <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
                <h3 className="text-lg font-semibold mb-4">Transactions</h3>
                <div className="space-y-3">
                  {escrow.transactions.slice(0, 10).map((tx: any) => (
                    <div key={tx.id} className="p-3 bg-gray-800/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{tx.type}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 font-mono mt-1 break-all">
                        {tx.txHash?.slice(0, 20)}...
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4">Timeline</h3>
              <div className="space-y-3">
                {[
                  { label: "Created", date: escrow.createdAt },
                  { label: "Funded", date: escrow.fundedAt },
                  { label: "Completed", date: escrow.completedAt },
                  { label: "Deadline", date: escrow.deadline },
                ]
                  .filter((t) => t.date)
                  .map((t) => (
                    <div key={t.label} className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">{t.label}</span>
                      <span className="text-sm text-white">
                        {new Date(t.date).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
