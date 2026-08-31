"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  Shield,
  Copy,
  Check,
  RefreshCw,
  Wallet,
  QrCode,
  AlertTriangle,
  MessageSquare,
  Flag,
  Undo2,
  Send,
  CheckCircle,
  Share2,
  Users,
} from "lucide-react";
import Nav from "@/components/Nav";

const QRCodeSVG = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  { ssr: false }
);

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export default function EscrowDetailPage() {
  const params = useParams();
  const escrowId = params?.id as string;
  const [token, setToken] = useState("");
  const [escrow, setEscrow] = useState<any>(null);
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeEvidence, setDisputeEvidence] = useState("");
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatRoomId, setChatRoomId] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [showVerifyInput, setShowVerifyInput] = useState(false);
  const [verifyTxHash, setVerifyTxHash] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ msg: string; fn: () => void } | null>(null);
  const [shareLink, setShareLink] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [multiSigStatus, setMultiSigStatus] = useState<any>(null);

  useEffect(() => {
    const stored =
      localStorage.getItem("user_token") ||
      localStorage.getItem("admin_token");
    if (stored) {
      setToken(stored);
      fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
        .then((r) => r.json())
        .then((d) => { if (d.id) setUserId(d.id); })
        .catch(() => {});
    }
  }, []);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const showMsg = (text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
  };

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

  const loadMultiSigStatus = useCallback(async () => {
    if (!token || !escrowId) return;
    try {
      const res = await fetch(`${API}/user/escrows/${escrowId}/multisig/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMultiSigStatus(data);
      }
    } catch {}
  }, [token, escrowId]);

  useEffect(() => {
    loadEscrow();
  }, [loadEscrow]);

  useEffect(() => {
    if (escrow?.mode === "MULTISIG") loadMultiSigStatus();
  }, [escrow?.mode, loadMultiSigStatus]);

  const generateShareLink = async () => {
    try {
      const res = await fetch(`${API}/deal/generate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ escrowId }),
      });
      const data = await res.json();
      if (data.shareToken) {
        const link = `${window.location.origin}/deal/${data.shareToken}`;
        setShareLink(link);
        showMsg("Share link generated!");
      } else {
        showMsg(data.error || "Failed to generate share link", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  const submitMultiSigApproval = async (action: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/user/escrows/${escrowId}/multisig/approve`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.approval) {
        showMsg(`Approval submitted for ${action}.`);
        loadMultiSigStatus();
        loadEscrow();
      } else {
        showMsg(data.error || "Failed to submit approval", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const generateDepositWallet = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/escrows/${escrowId}/deposit-wallet`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (data.success) {
        showMsg(
          data.depositWallet?.alreadyGenerated
            ? "Deposit wallet already generated."
            : "Deposit wallet generated successfully."
        );
        loadEscrow();
      } else {
        showMsg(data.error || "Failed to generate deposit wallet", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const verifyDeposit = async () => {
    if (!showVerifyInput) {
      setShowVerifyInput(true);
      return;
    }
    if (!verifyTxHash.trim()) {
      showMsg("Please enter a transaction hash", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/escrows/${escrowId}/verify-deposit`, {
        method: "POST",
        headers,
        body: JSON.stringify({ txHash: verifyTxHash.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        showMsg("Deposit verified and confirmed.");
        setShowVerifyInput(false);
        setVerifyTxHash("");
        loadEscrow();
      } else {
        showMsg(
          data.error || data.message || "Deposit not found or not confirmed yet",
          "error"
        );
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const deliverMilestone = async (milestoneIndex: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API}/escrows/${escrowId}/milestones/${milestoneIndex}/deliver`,
        { method: "POST", headers }
      );
      const data = await res.json();
      if (data.success) {
        showMsg(`Milestone ${milestoneIndex + 1} marked as delivered.`);
        loadEscrow();
      } else {
        showMsg(data.error || "Failed to deliver", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const approveMilestone = async (milestoneIndex: number) => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API}/escrows/${escrowId}/milestones/${milestoneIndex}/approve`,
        { method: "POST", headers }
      );
      const data = await res.json();
      if (data.success) {
        showMsg(`Milestone ${milestoneIndex + 1} approved.`);
        loadEscrow();
      } else {
        showMsg(data.error || "Failed to approve", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const adminApproveMilestone = async (
    milestoneIndex: number,
    force = false
  ) => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API}/admin/escrows/${escrowId}/approve-milestone/${milestoneIndex}`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ force }),
        }
      );
      const data = await res.json();
      if (data.success) {
        showMsg(
          `Milestone ${milestoneIndex + 1} released. TX: ${data.txHash?.slice(0, 16)}...`
        );
        loadEscrow();
      } else {
        showMsg(data.error || "Failed to approve", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const adminApproveAll = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `${API}/admin/escrows/${escrowId}/approve-all`,
        { method: "POST", headers }
      );
      const data = await res.json();
      if (data.success) {
        showMsg("All milestones released.");
        loadEscrow();
      } else {
        showMsg(data.error || "Failed", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const createDispute = async () => {
    if (!disputeReason.trim()) {
      showMsg("Please enter a reason for the dispute", "error");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/escrows/${escrowId}/disputes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          reason: disputeReason,
          evidence: disputeEvidence || undefined,
        }),
      });
      const data = await res.json();
      if (data.id) {
        showMsg("Dispute filed. The admin team will review it.");
        setShowDispute(false);
        setDisputeReason("");
        setDisputeEvidence("");
        loadEscrow();
      } else {
        showMsg(data.error || "Failed to file dispute", "error");
      }
    } catch {
      showMsg("Network error", "error");
    }
    setActionLoading(false);
  };

  const requestRefund = () => {
    setConfirmAction({
      msg: "Are you sure you want to request a refund? This will mark the escrow for review.",
      fn: async () => {
        setConfirmAction(null);
        setActionLoading(true);
        try {
          const res = await fetch(`${API}/escrows/${escrowId}/state`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ state: "REFUNDED" }),
          });
          const data = await res.json();
          if (data.id) {
            showMsg("Refund requested. The escrow has been marked for refund.");
            loadEscrow();
          } else {
            showMsg(data.error || "Failed to request refund", "error");
          }
        } catch {
          showMsg("Network error", "error");
        }
        setActionLoading(false);
      },
    });
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openChat = async () => {
    setShowChat(true);
    try {
      const res = await fetch(`${API}/chat/rooms`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          escrowId,
          subject: `Support for Escrow #${escrow?.onChainId}`,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setChatRoomId(data.id);
        setChatMessages(data.messages?.reverse() || []);
      }
    } catch {
      showMsg("Failed to open chat", "error");
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !chatRoomId) return;
    try {
      const res = await fetch(`${API}/chat/rooms/${chatRoomId}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: chatInput }),
      });
      const data = await res.json();
      if (data.id) {
        setChatMessages([...chatMessages, data]);
        setChatInput("");
      }
    } catch {
      showMsg("Failed to send message", "error");
    }
  };

  const refreshChat = async () => {
    if (!chatRoomId) return;
    try {
      const res = await fetch(`${API}/chat/rooms/${chatRoomId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setChatMessages(data);
    } catch {}
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
          <p className="text-text text-lg font-heading font-extrabold">
            Escrow not found
          </p>
          <Link
            href="/dashboard"
            className="btn btn-ghost mt-4 inline-flex"
          >
            <ChevronLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isBuyer = escrow.buyerId === userId;
  const isSeller = escrow.sellerId === userId;
  const isAdmin = !!localStorage.getItem("admin_token");
  const releasedMilestones =
    escrow.milestones?.filter((m: any) => m.released).length || 0;
  const totalMilestones = escrow.milestones?.length || 0;
  const progressPct =
    totalMilestones > 0 ? (releasedMilestones / totalMilestones) * 100 : 0;
  const isActiveOrFunded = ["ACTIVE", "FUNDED"].includes(escrow.state);
  const isActiveOrDisputed = ["ACTIVE", "DISPUTED"].includes(escrow.state);
  const canDispute = isActiveOrFunded && (isBuyer || isSeller);
  const canRefund = ["FUNDED", "DISPUTED"].includes(escrow.state) && isBuyer;

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
        {message && (
          <div
            className={`px-4 py-3 mb-6 text-sm border-2 ${
              messageType === "error"
                ? "border-accent bg-accent-100 text-accent-700"
                : "border-green-600 bg-green-600/5 text-green-700"
            }`}
          >
            {message}
            <button
              onClick={() => setMessage("")}
              className="float-right opacity-50 hover:opacity-100"
            >
              &times;
            </button>
          </div>
        )}
        {confirmAction && (
          <div className="px-4 py-3 mb-6 text-sm border-2 border-yellow-600 bg-yellow-600/5 flex items-center justify-between">
            <span className="text-yellow-700">{confirmAction.msg}</span>
            <div className="flex gap-2 flex-shrink-0 ml-4">
              <button onClick={confirmAction.fn} className="btn btn-primary text-xs px-3 py-1.5">Confirm</button>
              <button onClick={() => setConfirmAction(null)} className="btn btn-secondary text-xs px-3 py-1.5">Cancel</button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link
              href="/dashboard"
              className="text-accent text-sm hover:opacity-70 flex items-center gap-1"
            >
              <ChevronLeft size={14} />
              Dashboard
            </Link>
            <span className="text-accent text-[11px] font-semibold uppercase tracking-wider">
              ESCROW #{escrow.onChainId}
            </span>
            <span
              className={`tag ${
                isActiveOrDisputed ? "tag-accent" : "tag-neutral"
              }`}
            >
              {escrow.state}
            </span>
          </div>
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-text">
            {escrow.title}
          </h2>
          <p className="text-[13px] opacity-50 mt-1">
            {escrow.network} &middot; {escrow.token?.symbol || "N/A"} &middot;{" "}
            {escrow.mode === "MULTISIG" ? "Multi-Sig" : escrow.mode === "ARBITER" ? "Arbiter" : "Locked"} Mode
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs opacity-50">Progress</span>
            <span className="text-xs opacity-50">
              {releasedMilestones} of {totalMilestones} milestones released
            </span>
          </div>
          <div className="w-full h-2 bg-neutral-200 overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 2-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
          {/* Main */}
          <div className="space-y-4">
            {/* Parties */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                  Parties
                </h3>
              </div>
              <div className="grid grid-cols-3 divide-x-2 divide-divider">
                {[
                  { label: "Buyer", data: escrow.buyer, note: "Payer", isYou: isBuyer },
                  { label: "Seller", data: escrow.seller, note: "Recipient", isYou: isSeller },
                  { label: "Arbiter", data: escrow.arbiter, note: "Mediator", isYou: false },
                ].map((p) => (
                  <div key={p.label} className="px-5 py-4">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 mb-2">
                      {p.label}
                      {p.isYou && (
                        <span className="ml-1 text-accent">(You)</span>
                      )}
                    </p>
                    {p.data ? (
                      <>
                        <p className="text-sm font-mono text-text break-all">
                          {p.data.walletAddress?.slice(0, 8)}...
                          {p.data.walletAddress?.slice(-4)}
                        </p>
                        <p className="text-[11px] opacity-50 mt-1">
                          {p.data.displayName || p.note}
                        </p>
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
                {
                  label: "Released",
                  value: escrow.releasedAmount,
                  accent: true,
                },
                {
                  label: "Fees",
                  value: escrow.protocolFeeTotal,
                  accent: false,
                },
              ].map((a) => (
                <div key={a.label} className="bg-bg px-5 py-4">
                  <p className="text-[11px] uppercase tracking-wider opacity-50">
                    {a.label}
                  </p>
                  <p
                    className={`text-[18px] font-heading font-extrabold ${
                      a.accent ? "text-accent" : "text-text"
                    }`}
                  >
                    {a.value ?? "0"}
                  </p>
                  <p className="text-[11px] opacity-50">
                    {escrow.token?.symbol || "TOKEN"}
                  </p>
                </div>
              ))}
            </div>

            {/* Milestones */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider flex items-center justify-between">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                  Milestones
                </h3>
                {isActiveOrDisputed && isAdmin && (
                  <button
                    onClick={adminApproveAll}
                    disabled={actionLoading}
                    className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    {actionLoading ? "Processing..." : "Release All"}
                  </button>
                )}
              </div>
              <div>
                {escrow.milestones?.map((m: any, idx: number) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between px-5 py-4 ${
                      idx < (escrow.milestones?.length || 0) - 1
                        ? "border-b border-divider"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {m.released ? (
                        <div className="w-8 h-8 bg-accent flex items-center justify-center flex-shrink-0">
                          <Check size={16} className="text-white" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-neutral-300 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-heading font-extrabold text-text">
                            {m.index + 1}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-text">
                          {m.description}
                        </p>
                        <p className="text-xs opacity-50">
                          {m.amount} {escrow.token?.symbol}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                      {m.released && (
                        <span className="tag bg-accent text-white">
                          RELEASED
                        </span>
                      )}
                      {m.sellerDelivered && !m.released && (
                        <span className="tag tag-neutral">DELIVERED</span>
                      )}
                      {m.buyerApproved && !m.released && (
                        <span className="tag tag-neutral">APPROVED</span>
                      )}

                      {/* Seller: Mark as delivered */}
                      {!m.released &&
                        !m.sellerDelivered &&
                        isSeller &&
                        isActiveOrFunded && (
                          <button
                            onClick={() => deliverMilestone(m.index)}
                            disabled={actionLoading}
                            className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
                          >
                            <Send size={12} />
                            Deliver
                          </button>
                        )}

                      {/* Buyer: Approve delivery */}
                      {!m.released &&
                        m.sellerDelivered &&
                        !m.buyerApproved &&
                        isBuyer &&
                        isActiveOrFunded && (
                          <button
                            onClick={() => approveMilestone(m.index)}
                            disabled={actionLoading}
                            className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
                          >
                            <CheckCircle size={12} />
                            Approve
                          </button>
                        )}

                      {/* Admin: Release funds on-chain */}
                      {!m.released && isAdmin && isActiveOrDisputed && (
                        <div className="flex gap-1 ml-2">
                          <button
                            onClick={() =>
                              adminApproveMilestone(m.index, false)
                            }
                            disabled={actionLoading}
                            className="btn btn-primary text-xs px-3 py-1.5 disabled:opacity-40"
                          >
                            Release
                          </button>
                          <button
                            onClick={() =>
                              adminApproveMilestone(m.index, true)
                            }
                            disabled={actionLoading}
                            className="btn btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
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

            {/* Dispute Form */}
            {showDispute && (
              <div className="border-2 border-accent p-5">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider mb-4">
                  File a Dispute
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Reason *
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe the issue..."
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      className="sd-input w-full resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">
                      Evidence (optional)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Provide links, screenshots, or other evidence..."
                      value={disputeEvidence}
                      onChange={(e) => setDisputeEvidence(e.target.value)}
                      className="sd-input w-full resize-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={createDispute}
                      disabled={actionLoading || !disputeReason.trim()}
                      className="btn btn-primary flex-1 disabled:opacity-40"
                    >
                      {actionLoading ? "Submitting..." : "Submit Dispute"}
                    </button>
                    <button
                      onClick={() => setShowDispute(false)}
                      className="btn btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Disputes list */}
            {escrow.dispuInits?.length > 0 && (
              <div className="border-2 border-divider">
                <div className="px-5 py-3 border-b-2 border-divider">
                  <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                    Disputes
                  </h3>
                </div>
                {escrow.dispuInits.map((d: any) => (
                  <div
                    key={d.id}
                    className="px-5 py-4 border-b border-divider last:border-0"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`tag ${
                          d.outcome === "PENDING"
                            ? "tag-accent"
                            : "tag-neutral"
                        }`}
                      >
                        {d.outcome}
                      </span>
                      <span className="text-xs opacity-50">
                        {new Date(d.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{d.reason}</p>
                    {d.evidence && (
                      <p className="text-xs opacity-50 mt-1">{d.evidence}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Actions */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                  Quick Actions
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {escrow.state === "CREATED" && isBuyer && (
                  <button
                    onClick={generateDepositWallet}
                    disabled={actionLoading}
                    className="btn btn-primary w-full disabled:opacity-40"
                  >
                    <Wallet size={16} />
                    {escrow.depositWalletAddr
                      ? "View Deposit Info"
                      : "Fund Escrow"}
                  </button>
                )}
                {canDispute && (
                  <button
                    onClick={() => setShowDispute(!showDispute)}
                    className="btn btn-secondary w-full"
                  >
                    <Flag size={16} />
                    {showDispute ? "Cancel Dispute" : "File Dispute"}
                  </button>
                )}
                {canRefund && (
                  <button
                    onClick={requestRefund}
                    disabled={actionLoading}
                    className="btn btn-secondary w-full disabled:opacity-40"
                  >
                    <Undo2 size={16} />
                    Request Refund
                  </button>
                )}
                <button onClick={openChat} className="btn btn-secondary w-full">
                  <MessageSquare size={16} />
                  Support Chat
                </button>
                {isAdmin && isActiveOrDisputed && (
                  <div className="pt-3 border-t-2 border-divider">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 mb-2">
                      Admin Actions
                    </p>
                    <button
                      onClick={adminApproveAll}
                      disabled={actionLoading}
                      className="btn btn-primary w-full disabled:opacity-40"
                    >
                      {actionLoading
                        ? "Processing..."
                        : "Release All Milestones"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Share Link */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                  Share Deal
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {shareLink ? (
                  <>
                    <p className="text-xs opacity-50 break-all font-mono">{shareLink}</p>
                    <button onClick={copyShareLink} className="btn btn-secondary w-full">
                      {shareCopied ? <Check size={16} /> : <Copy size={16} />}
                      {shareCopied ? "Copied!" : "Copy Share Link"}
                    </button>
                  </>
                ) : (
                  <button onClick={generateShareLink} className="btn btn-secondary w-full">
                    <Share2 size={16} />
                    Generate Share Link
                  </button>
                )}
                <p className="text-xs opacity-40">
                  Anyone with this link can view the deal details publicly.
                </p>
              </div>
            </div>

            {/* Multi-Sig Approval */}
            {escrow.mode === "MULTISIG" && multiSigStatus && (
              <div className="border-2 border-divider">
                <div className="px-5 py-3 border-b-2 border-divider">
                  <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                    Multi-Sig Status
                  </h3>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs opacity-50">Required Signatures</span>
                    <span className="text-sm font-heading font-extrabold">{multiSigStatus.requiredSignatures || escrow.requiredSignatures}</span>
                  </div>
                  {multiSigStatus.pendingActions?.map((action: any) => (
                    <div key={action.action} className="border-2 border-divider p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold">{action.action}</span>
                        <span className="tag tag-neutral">
                          {action.approvals}/{action.required}
                        </span>
                      </div>
                      <div className="h-[4px] bg-neutral-200 mb-2">
                        <div
                          className="h-full bg-accent transition-all"
                          style={{ width: `${(action.approvals / action.required) * 100}%` }}
                        />
                      </div>
                      {(isBuyer || isSeller) && !action.userApproved && isActiveOrFunded && (
                        <button
                          onClick={() => submitMultiSigApproval(action.action)}
                          disabled={actionLoading}
                          className="btn btn-primary w-full text-xs py-1.5 disabled:opacity-40"
                        >
                          <Users size={14} />
                          {actionLoading ? "Submitting..." : "Approve"}
                        </button>
                      )}
                      {action.userApproved && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle size={12} /> You approved this action
                        </p>
                      )}
                    </div>
                  ))}
                  {(!multiSigStatus.pendingActions || multiSigStatus.pendingActions.length === 0) && (
                    <p className="text-xs opacity-50 text-center py-2">No pending approvals</p>
                  )}
                </div>
              </div>
            )}

            {/* Deposit Info */}
            {(escrow.state === "CREATED" || escrow.state === "FUNDED") && (
              <div className="border-2 border-divider">
                <div className="px-5 py-3 border-b-2 border-divider">
                  <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                    Deposit Info
                  </h3>
                </div>
                <div className="p-5 space-y-4">
                  {escrow.depositWalletAddr ? (
                    <>
                      <div className="flex justify-center">
                        <div className="bg-white p-3 border-2 border-divider">
                          <QRCodeSVG
                            value={escrow.depositWalletAddr}
                            size={160}
                            level="H"
                            includeMargin={false}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider opacity-50 mb-1">
                          Deposit Address
                        </p>
                        <p className="text-sm font-mono break-all text-text">
                          {escrow.depositWalletAddr}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] uppercase tracking-wider opacity-50 mb-1">
                          Expected Amount
                        </p>
                        <p className="text-sm font-heading font-extrabold text-text">
                          {escrow.totalAmount} {escrow.token?.symbol}
                        </p>
                      </div>
                      <div className="border-2 border-yellow-600 bg-yellow-600/5 p-3">
                        <p className="text-xs text-yellow-700 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          Send exactly {escrow.totalAmount}{" "}
                          {escrow.token?.symbol} on the{" "}
                          {escrow.network} network. Sending wrong tokens
                          or wrong amounts may result in loss of funds.
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          copyAddress(escrow.depositWalletAddr)
                        }
                        className="btn btn-secondary w-full"
                      >
                        {copied ? (
                          <Check size={16} />
                        ) : (
                          <Copy size={16} />
                        )}
                        {copied ? "Copied!" : "Copy Address"}
                      </button>
                      {showVerifyInput && (
                        <input
                          type="text"
                          placeholder="0x... transaction hash"
                          value={verifyTxHash}
                          onChange={(e) => setVerifyTxHash(e.target.value)}
                          className="sd-input w-full font-mono text-xs"
                        />
                      )}
                      <button
                        onClick={verifyDeposit}
                        disabled={actionLoading}
                        className="btn btn-secondary w-full disabled:opacity-40"
                      >
                        <RefreshCw size={16} />
                        {actionLoading ? "Checking..." : showVerifyInput ? "Submit Verification" : "Verify Deposit"}
                      </button>
                    </>
                  ) : escrow.state === "CREATED" && isBuyer ? (
                    <button
                      onClick={generateDepositWallet}
                      disabled={actionLoading}
                      className="btn btn-primary w-full disabled:opacity-40"
                    >
                      <QrCode size={16} />
                      {actionLoading
                        ? "Generating..."
                        : "Generate Deposit Wallet"}
                    </button>
                  ) : (
                    <p className="text-sm opacity-50 text-center py-4">
                      Waiting for buyer to generate deposit wallet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="border-2 border-divider">
              <div className="px-5 py-3 border-b-2 border-divider">
                <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                  Timeline
                </h3>
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
                      <span className="text-sm text-text">
                        {new Date(t.date).toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Transactions */}
            {escrow.transactions?.length > 0 && (
              <div className="border-2 border-divider">
                <div className="px-5 py-3 border-b-2 border-divider">
                  <h3 className="font-heading font-extrabold text-sm uppercase tracking-wider">
                    Transactions
                  </h3>
                </div>
                <div>
                  {escrow.transactions
                    .slice(0, 10)
                    .map((tx: any, idx: number) => (
                      <div
                        key={tx.id}
                        className={`px-5 py-3 ${
                          idx <
                          Math.min(escrow.transactions.length, 10) - 1
                            ? "border-b border-divider"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="tag tag-neutral">{tx.type}</span>
                          <span className="text-xs opacity-50">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs font-mono opacity-50 mt-1 break-all">
                          {tx.txHash?.slice(0, 20)}...
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat Panel */}
        {showChat && (
          <div className="fixed bottom-4 right-4 w-96 max-w-[calc(100vw-2rem)] border-2 border-divider bg-bg shadow-lg z-50">
            <div className="px-4 py-3 border-b-2 border-divider flex items-center justify-between bg-surface">
              <h4 className="font-heading font-extrabold text-sm">
                Support Chat
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={refreshChat}
                  className="opacity-50 hover:opacity-100"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  onClick={() => setShowChat(false)}
                  className="opacity-50 hover:opacity-100"
                >
                  &times;
                </button>
              </div>
            </div>
            <div className="h-64 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 && (
                <p className="text-sm opacity-50 text-center py-8">
                  No messages yet. Send a message to start.
                </p>
              )}
              {chatMessages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.senderId === userId ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 text-sm ${
                      msg.senderId === userId
                        ? "bg-accent text-white"
                        : "bg-surface border border-divider text-text"
                    }`}
                  >
                    {msg.sender?.isAdmin && (
                      <p className="text-[10px] font-semibold mb-1 opacity-70">
                        Admin
                      </p>
                    )}
                    <p>{msg.content}</p>
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.senderId === userId
                          ? "text-white/60"
                          : "opacity-40"
                      }`}
                    >
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t-2 border-divider flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Type a message..."
                className="sd-input flex-1 text-sm"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                className="btn btn-primary px-3 disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
