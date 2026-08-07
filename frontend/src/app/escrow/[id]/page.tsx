"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, Shield, Copy, Check, House, RefreshCw, Wallet, QrCode } from "lucide-react";
import Nav from "@/components/Nav";

const QRCodeSVG = dynamic(() => import("qrcode.react").then((mod) => mod.QRCodeSVG), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

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

  const approveMilestone = async (milestoneIndex: number, force = false) => {
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/escrows/${escrowId}/approve-milestone/${milestoneIndex}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`Milestone ${milestoneIndex + 1} approved.`);
        loadEscrow();
      } else {
        setMessage(`Error: ${data.error || "Failed to approve"}`);
      }
    } catch {
      setMessage("Error: Network error");
    }
    setActionLoading(false);
  };

  const approveAll = async () => {
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/admin/escrows/${escrowId}/approve-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessage("All milestones approved.");
        loadEscrow();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Error: Network error");
    }
    setActionLoading(false);
  };

  const generateDepositWallet = async () => {
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/escrows/${escrowId}/deposit-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setMessage(
          data.depositWallet?.alreadyGenerated
            ? "Deposit wallet already generated."
            : "Deposit wallet generated."
        );
        loadEscrow();
      } else {
        setMessage(`Error: ${data.error || "Failed to generate deposit wallet"}`);
      }
    } catch {
      setMessage("Error: Network error");
    }
    setActionLoading(false);
  };

  const verifyDeposit = async () => {
    const txHash = window.prompt("Enter the deposit transaction hash to verify:");
    if (!txHash) return;
    setActionLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/escrows/${escrowId}/verify-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ txHash }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(data.message || "Deposit verified and confirmed.");
        loadEscrow();
      } else {
        setMessage(`Error: ${data.error || data.message || "Deposit not found or not confirmed yet"}`);
      }
    } catch {
      setMessage("Error: Network error");
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-neutral-500 text-sm">Loading escrow...</p>
      </div>
    );
  }

  if (!escrow || escrow.error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-text text-lg font-heading font-extrabold">Escrow not found</p>
          <Link href="/dashboard" className="btn btn-ghost mt-4 inline-flex">
            <ChevronLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const releasedMilestones = escrow.milestones?.filter((m: any) => m.released).length || 0;
  const totalMilestones = escrow.milestones?.length || 0;
  const isAdmin = !!localStorage.getItem("admin_token");
  const progressPct = totalMilestones > 0 ? (releasedMilestones / totalMilestones) * 100 : 0;
  const isActiveOrDisputed = escrow.state === "ACTIVE" || escrow.state === "DISPUTED";

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
        {message && (
          <div className={`px-4 py-3 mb-6 text-sm border-2 ${
            message.startsWith("Error")
              ? "border-accent bg-accent-100 text-accent-700"
              : "border-divider bg-bg text-text"
          }`}>
            {message}
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-accent text-[11px] font-semibold uppercase tracking-wider">
              ESCROW #{escrow.onChainId}
            </span>
            <span className={`tag ${isActiveOrDisputed ? "tag-accent" : "tag-neutral"}`}>
              {escrow.state}
            </span>
          </div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-text">{escrow.title}</h2>
          <p className="text-[13px] opacity-50 mt-1">
            {escrow.network} &middot; {escrow.token?.symbol || "N/A"} &middot; {escrow.mode === "ARBITER" ? "Arbiter" : "Locked"} Mode
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs opacity-50">Progress</span>
            <span className="text-xs opacity-50">{releasedMilestones} of {totalMilestones} milestones released</span>
          </div>
          <div className="w-full h-2 bg-neutral-200 overflow-hidden">
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          {/* Main */}
          <div className="space-y-4">
            {/* Parties */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">Parties</h3>
              </div>
              <div className="grid grid-cols-3 divide-x-2 divide-divider">
                {[
                  { label: "Buyer", data: escrow.buyer, note: "Payer" },
                  { label: "Seller", data: escrow.seller, note: "Recipient" },
                  { label: "Arbiter", data: escrow.arbiter, note: "Mediator" },
                ].map((p) => (
                  <div key={p.label} className="px-5 py-4">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 mb-2">{p.label}</p>
                    {p.data ? (
                      <>
                        <p className="text-sm font-mono text-text break-all">
                          {p.data.walletAddress?.slice(0, 8)}...{p.data.walletAddress?.slice(-4)}
                        </p>
                        <p className="text-[11px] opacity-50 mt-1">{p.data.displayName || p.note}</p>
                      </>
                    ) : (
                      <p className="text-sm opacity-40">Not set</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Amounts */}
            <div className="bg-divider grid grid-cols-2 sm:grid-cols-4 gap-[2px]">
              {[
                { label: "Total", value: escrow.totalAmount, accent: false },
                { label: "Funded", value: escrow.fundedAmount, accent: false },
                { label: "Released", value: escrow.releasedAmount, accent: true },
                { label: "Fees", value: escrow.protocolFeeTotal, accent: false },
              ].map((a) => (
                <div key={a.label} className="bg-bg px-5 py-4">
                  <p className="text-[11px] uppercase tracking-wider opacity-50">{a.label}</p>
                  <p className={`text-[18px] font-heading font-extrabold ${a.accent ? "text-accent" : "text-text"}`}>
                    {a.value ?? "0"}
                  </p>
                  <p className="text-[11px] opacity-50">{escrow.token?.symbol || "TOKEN"}</p>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">Milestones</h3>
                {isActiveOrDisputed && isAdmin && (
                  <button onClick={approveAll} disabled={actionLoading} className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-40">
                    {actionLoading ? "Processing..." : "Approve All"}
                  </button>
                )}
              </div>
              <div>
                {escrow.milestones?.map((m: any, idx: number) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between px-5 py-4 ${
                      idx < (escrow.milestones?.length || 0) - 1 ? "border-b border-divider" : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {m.released ? (
                        <div className="w-8 h-8 bg-accent flex items-center justify-center flex-shrink-0">
                          <Check size={16} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-neutral-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-heading font-extrabold text-text">{m.index + 1}</span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-text">{m.description}</p>
                        <p className="text-xs opacity-50">{m.amount} {escrow.token?.symbol}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {m.released && <span className="tag bg-accent text-white">RELEASED</span>}
                        {m.sellerDelivered && !m.released && <span className="tag tag-neutral">DELIVERED</span>}
                        {m.buyerApproved && !m.released && <span className="tag tag-neutral">APPROVED</span>}
                        {m.disputed && <span className="tag tag-accent">DISPUTED</span>}
                      </div>
                      {!m.released && isAdmin && isActiveOrDisputed && (
                        <div className="flex gap-1 ml-2">
                          <button onClick={() => approveMilestone(m.index, false)} disabled={actionLoading} className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-40">Approve</button>
                          <button onClick={() => approveMilestone(m.index, true)} disabled={actionLoading} className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Force</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Actions */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">Quick Actions</h3>
              </div>
              <div className="p-5 space-y-3">
                {escrow.state === "CREATED" && (
                  <button className="btn btn-primary w-full"><Wallet size={16} />Fund Escrow</button>
                )}
                {isActiveOrDisputed && (
                  <button className="btn btn-secondary w-full"><Shield size={16} />Initiate Dispute</button>
                )}
                {isActiveOrDisputed && (
                  <button className="btn btn-secondary w-full"><House size={16} />Request Refund</button>
                )}
                {isAdmin && (
                  <div className="pt-3 border-t-2 border-divider">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 mb-2">Admin Actions</p>
                    <button onClick={approveAll} disabled={actionLoading} className="btn btn-primary w-full disabled:opacity-40">
                      {actionLoading ? "Processing..." : "Approve All Milestones"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Deposit Info */}
            {(escrow.state === "CREATED" || escrow.state === "FUNDED") && (
              <div className="border-2 border-divider">
                <div className="px-5 py-3 border-b-2 border-divider">
                  <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">Deposit Info</h3>
                </div>
                <div className="p-5 space-y-4">
                  {escrow.depositWalletAddr ? (
                    <>
                      <div className="flex justify-center">
                        <div className="bg-white p-3 border-2 border-divider">
                          <QRCodeSVG value={escrow.depositWalletAddr} size={160} level="H" includeMargin={false} />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider opacity-50 mb-1">Deposit Address</p>
                        <p className="text-sm font-mono break-all text-text">{escrow.depositWalletAddr}</p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider opacity-50 mb-1">Expected Amount</p>
                        <p className="text-sm font-heading font-extrabold text-text">{escrow.totalAmount} {escrow.token?.symbol}</p>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(escrow.depositWalletAddr)}
                        className="btn btn-secondary w-full"
                      >
                        <Copy size={16} />
                        Copy Address
                      </button>
                      <button
                        onClick={verifyDeposit}
                        disabled={actionLoading}
                        className="btn btn-secondary w-full disabled:opacity-40"
                      >
                        <RefreshCw size={16} />
                        {actionLoading ? "Checking..." : "Verify Deposit"}
                      </button>
                    </>
                  ) : escrow.state === "CREATED" ? (
                    <button
                      onClick={generateDepositWallet}
                      disabled={actionLoading}
                      className="btn btn-primary w-full disabled:opacity-40"
                    >
                      <QrCode size={16} />
                      {actionLoading ? "Generating..." : "Generate Deposit Wallet"}
                    </button>
                  ) : null}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">Timeline</h3>
              </div>
              <div>
                {[
                  { label: "Created", date: escrow.createdAt },
                  { label: "Funded", date: escrow.fundedAt },
                  { label: "Completed", date: escrow.completedAt },
                  { label: "Deadline", date: escrow.deadline },
                ]
                  .filter((t) => t.date)
                  .map((t, idx, arr) => (
                    <div
                      key={t.label}
                      className={`flex items-center justify-between px-5 py-3 ${
                        idx < arr.length - 1 ? "border-b border-divider" : ""
                      }`}
                    >
                      <span className="text-sm opacity-50">{t.label}</span>
                      <span className="text-sm text-text">{new Date(t.date).toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Transactions */}
            {escrow.transactions?.length > 0 && (
              <div className="border-2 border-divider">
                <div className="px-5 py-3 border-b-2 border-divider">
                  <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">Transactions</h3>
                </div>
                <div>
                  {escrow.transactions.slice(0, 10).map((tx: any, idx: number) => (
                    <div key={tx.id} className={`px-5 py-3 ${idx < Math.min(escrow.transactions.length, 10) - 1 ? "border-b border-divider" : ""}`}>
                      <div className="flex items-center justify-between">
                        <span className="tag tag-neutral">{tx.type}</span>
                        <span className="text-xs opacity-50">{new Date(tx.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs font-mono opacity-50 mt-1 break-all">{tx.txHash?.slice(0, 20)}...</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
