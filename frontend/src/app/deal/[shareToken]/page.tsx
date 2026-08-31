"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Shield,
  Clock,
  CheckCircle,
  AlertTriangle,
  Copy,
  ExternalLink,
} from "lucide-react";
import Nav from "@/components/Nav";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const STATE_STYLES: Record<string, { bg: string; text: string }> = {
  CREATED: { bg: "bg-blue-600", text: "text-white" },
  FUNDED: { bg: "bg-accent", text: "text-white" },
  ACTIVE: { bg: "bg-emerald-600", text: "text-white" },
  COMPLETED: { bg: "bg-green-700", text: "text-white" },
  DISPUTED: { bg: "bg-yellow-600", text: "text-white" },
  REFUNDED: { bg: "bg-neutral-600", text: "text-white" },
  EXPIRED: { bg: "bg-neutral-400", text: "text-white" },
};

export default function DealPage() {
  const params = useParams();
  const shareToken = params.shareToken as string;
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    fetchDeal();
  }, [shareToken]);

  const fetchDeal = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/deal/${shareToken}`);
      if (!res.ok) {
        setError("Deal not found or link has expired");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setDeal(data);
    } catch {
      setError("Failed to load deal");
    }
    setLoading(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-16 text-center">
          <p className="text-neutral-500">Loading deal...</p>
        </div>
      </div>
    );
  }

  if (error || !deal) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-accent mx-auto mb-4" />
          <h2 className="text-2xl font-heading font-extrabold mb-2">
            Deal Not Found
          </h2>
          <p className="text-sm opacity-60 mb-6">
            {error || "This deal link may have expired or is invalid."}
          </p>
          <Link href="/" className="btn btn-primary">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  const stateStyle = STATE_STYLES[deal.state] || STATE_STYLES.CREATED;
  const releasedCount =
    deal.milestones?.filter((m: any) => m.released).length || 0;
  const totalMilestones = deal.milestones?.length || 0;
  const progress =
    totalMilestones > 0 ? (releasedCount / totalMilestones) * 100 : 0;

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <main className="max-w-[720px] mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">
              Shared Deal
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold">
              {deal.title}
            </h1>
          </div>
          <span className={`tag ${stateStyle.bg} ${stateStyle.text}`}>
            {deal.state}
          </span>
        </div>

        {deal.description && (
          <p className="text-sm opacity-70 mb-6">{deal.description}</p>
        )}

        <div className="sd-card p-0 mb-6">
          <div className="px-5 py-4 border-b-2 border-divider">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider font-semibold opacity-50">
                Deal Summary
              </p>
              <button
                onClick={copyLink}
                className="flex items-center gap-1 text-xs text-accent hover:opacity-70 transition-opacity"
              >
                <Copy className="w-3 h-3" />
                {copied ? "Copied!" : "Copy Link"}
              </button>
            </div>
          </div>

          <div className="px-5 py-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs opacity-50">Amount</p>
              <p className="text-lg font-heading font-extrabold">
                {deal.totalAmount} {deal.token?.symbol}
              </p>
            </div>
            <div>
              <p className="text-xs opacity-50">Network</p>
              <p className="text-sm font-semibold">{deal.network}</p>
            </div>
            <div>
              <p className="text-xs opacity-50">Category</p>
              <span className="tag tag-neutral">
                {(deal.category || "CUSTOM").replace(/_/g, " ")}
              </span>
            </div>
            <div>
              <p className="text-xs opacity-50">Mode</p>
              <p className="text-sm font-semibold">{deal.mode}</p>
            </div>
            {deal.deadline && (
              <div>
                <p className="text-xs opacity-50">Deadline</p>
                <p className="text-sm flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(deal.deadline).toLocaleDateString()}
                </p>
              </div>
            )}
            {deal.isInsured && (
              <div>
                <p className="text-xs opacity-50">Insurance</p>
                <p className="text-sm flex items-center gap-1 text-emerald-600">
                  <Shield className="w-3 h-3" />
                  Insured
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[2px] bg-divider mb-6">
          <div className="bg-bg p-5">
            <p className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-2">
              Buyer
            </p>
            <p className="font-semibold">
              {deal.buyer?.displayName || "Anonymous"}
            </p>
            <p className="text-xs font-mono opacity-50 mt-1">
              {deal.buyer?.walletAddress}
            </p>
            {deal.buyer?.trustScore && (
              <div className="flex items-center gap-2 mt-2">
                <span className="tag tag-accent">
                  {deal.buyer.trustScore.level}
                </span>
                <span className="text-xs opacity-50">
                  Score: {deal.buyer.trustScore.score}
                </span>
              </div>
            )}
            <span className="tag tag-neutral mt-2">
              {deal.buyer?.verificationTier}
            </span>
          </div>
          <div className="bg-bg p-5">
            <p className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-2">
              Seller
            </p>
            <p className="font-semibold">
              {deal.seller?.displayName || "Anonymous"}
            </p>
            <p className="text-xs font-mono opacity-50 mt-1">
              {deal.seller?.walletAddress}
            </p>
            {deal.seller?.trustScore && (
              <div className="flex items-center gap-2 mt-2">
                <span className="tag tag-accent">
                  {deal.seller.trustScore.level}
                </span>
                <span className="text-xs opacity-50">
                  Score: {deal.seller.trustScore.score}
                </span>
              </div>
            )}
            <span className="tag tag-neutral mt-2">
              {deal.seller?.verificationTier}
            </span>
          </div>
        </div>

        <div className="sd-card p-0 mb-6">
          <div className="px-5 py-4 border-b-2 border-divider">
            <p className="text-xs uppercase tracking-wider font-semibold opacity-50">
              Milestones ({releasedCount}/{totalMilestones})
            </p>
            <div className="h-[6px] bg-neutral-200 mt-3">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <div className="divide-y divide-divider">
            {(deal.milestones || []).map((m: any) => (
              <div
                key={m.index}
                className="px-5 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-7 h-7 flex items-center justify-center text-xs font-bold ${
                      m.released
                        ? "bg-emerald-600 text-white"
                        : "bg-divider text-text"
                    }`}
                  >
                    {m.released ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      m.index + 1
                    )}
                  </span>
                  <span className="text-sm">{m.description}</span>
                </div>
                <span className="text-sm font-semibold font-mono">
                  {m.amount} {deal.token?.symbol}
                </span>
              </div>
            ))}
          </div>
        </div>

        {deal.state === "CREATED" && deal.depositAddress && (
          <div className="border-2 border-accent bg-accent/5 p-5 mb-6">
            <p className="text-sm font-semibold text-accent mb-2">
              Deposit Address
            </p>
            <p className="text-sm font-mono break-all">
              {deal.depositAddress}
            </p>
            <p className="text-xs opacity-50 mt-2">
              Send {deal.totalAmount} {deal.token?.symbol} to this address to
              fund the escrow
            </p>
          </div>
        )}

        {deal.template && (
          <div className="text-xs opacity-50 text-center mt-4">
            Template: {deal.template.name} ({deal.template.category})
          </div>
        )}
      </main>
    </div>
  );
}
