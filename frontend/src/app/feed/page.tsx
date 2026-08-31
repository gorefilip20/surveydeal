"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Trophy, TrendingUp, ChevronDown } from "lucide-react";
import Nav from "@/components/Nav";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "CRYPTO_TRADE", label: "Crypto Trade" },
  { value: "FREELANCE", label: "Freelance" },
  { value: "REAL_ESTATE", label: "Real Estate" },
  { value: "DOMAIN_SALE", label: "Domain Sale" },
  { value: "VEHICLE_SALE", label: "Vehicle Sale" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "PARTNERSHIP", label: "Partnership" },
  { value: "INFLUENCER", label: "Influencer" },
  { value: "CUSTOM", label: "Custom" },
];

const NETWORKS = [
  { value: "", label: "All Networks" },
  { value: "ETHEREUM", label: "Ethereum" },
  { value: "BNB_CHAIN", label: "BNB Chain" },
  { value: "POLYGON", label: "Polygon" },
  { value: "ARBITRUM", label: "Arbitrum" },
  { value: "BASE", label: "Base" },
  { value: "AVALANCHE", label: "Avalanche" },
  { value: "OPTIMISM", label: "Optimism" },
  { value: "FANTOM", label: "Fantom" },
];

export default function FeedPage() {
  const [tab, setTab] = useState<"feed" | "leaderboard">("feed");
  const [deals, setDeals] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [network, setNetwork] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === "feed") {
      fetchFeed();
      fetchStats();
    } else {
      fetchLeaderboard();
    }
  }, [tab, category, network, page]);

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (category) params.set("category", category);
      if (network) params.set("network", network);
      const res = await fetch(`${API}/feed?${params}`);
      const data = await res.json();
      setDeals(data.deals || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch {
      setDeals([]);
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API}/feed/stats`);
      const data = await res.json();
      setStats(data);
    } catch {}
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/feed/leaderboard?limit=50`);
      const data = await res.json();
      setLeaderboard(data.leaderboard || []);
    } catch {
      setLeaderboard([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">
            Community
          </p>
          <h1 className="text-3xl font-heading font-extrabold">Deal Feed</h1>
          <p className="text-sm opacity-60 mt-1">
            Completed deals and top-rated traders
          </p>
        </div>

        {stats && (
          <div className="bg-divider grid grid-cols-2 md:grid-cols-4 gap-[2px] mb-8">
            <div className="bg-bg p-5">
              <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                Total Deals
              </p>
              <p className="text-[28px] font-heading font-extrabold">
                {stats.totalDeals}
              </p>
            </div>
            <div className="bg-bg p-5">
              <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                Total Volume
              </p>
              <p className="text-[28px] font-heading font-extrabold text-accent">
                {stats.totalVolume || "0"}
              </p>
            </div>
            {(stats.categories || []).slice(0, 2).map((c: any) => (
              <div key={c.category} className="bg-bg p-5">
                <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                  {(c.category || "OTHER").replace(/_/g, " ")}
                </p>
                <p className="text-[28px] font-heading font-extrabold">
                  {c.count}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="border-b-2 border-divider mb-6 flex gap-0">
          {(["feed", "leaderboard"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-semibold transition-colors -mb-[2px] border-b-2 flex items-center gap-2 ${
                tab === t
                  ? "border-accent text-accent"
                  : "border-transparent text-text hover:text-accent"
              }`}
            >
              {t === "feed" ? (
                <>
                  <TrendingUp className="w-4 h-4" /> Recent Deals
                </>
              ) : (
                <>
                  <Trophy className="w-4 h-4" /> Leaderboard
                </>
              )}
            </button>
          ))}
        </div>

        {tab === "feed" && (
          <>
            <div className="flex gap-3 mb-6">
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  className="sd-input pr-8 appearance-none"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
              </div>
              <div className="relative">
                <select
                  value={network}
                  onChange={(e) => {
                    setNetwork(e.target.value);
                    setPage(1);
                  }}
                  className="sd-input pr-8 appearance-none"
                >
                  {NETWORKS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40 pointer-events-none" />
              </div>
            </div>

            {loading ? (
              <p className="text-neutral-500 py-8">Loading deals...</p>
            ) : deals.length === 0 ? (
              <div className="text-center py-16 border-2 border-divider">
                <p className="text-neutral-600 text-lg mb-2">
                  No completed deals yet
                </p>
                <Link
                  href="/escrow/create"
                  className="text-accent hover:underline text-sm"
                >
                  Create your first escrow
                </Link>
              </div>
            ) : (
              <>
                <div className="border-2 border-divider overflow-x-auto">
                  <table className="sd-table">
                    <thead>
                      <tr>
                        <th>Deal</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Network</th>
                        <th>Buyer</th>
                        <th>Seller</th>
                        <th>Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deals.map((d) => (
                        <tr key={d.id}>
                          <td className="font-semibold">{d.title}</td>
                          <td>
                            <span className="tag tag-neutral">
                              {(d.category || "").replace(/_/g, " ")}
                            </span>
                          </td>
                          <td className="font-mono">
                            {d.amountDisplay} {d.tokenSymbol}
                          </td>
                          <td>{d.network}</td>
                          <td className="font-mono text-xs">
                            {d.buyerDisplay}
                          </td>
                          <td className="font-mono text-xs">
                            {d.sellerDisplay}
                          </td>
                          <td className="text-xs opacity-50">
                            {d.completedAt
                              ? new Date(d.completedAt).toLocaleDateString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="btn btn-secondary text-sm disabled:opacity-30"
                    >
                      Previous
                    </button>
                    <span className="text-sm opacity-60">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="btn btn-secondary text-sm disabled:opacity-30"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "leaderboard" && (
          <>
            {loading ? (
              <p className="text-neutral-500 py-8">Loading leaderboard...</p>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-16 border-2 border-divider">
                <p className="text-neutral-600 text-lg">
                  No traders ranked yet
                </p>
              </div>
            ) : (
              <div className="border-2 border-divider overflow-x-auto">
                <table className="sd-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Trader</th>
                      <th>Score</th>
                      <th>Level</th>
                      <th>Deals</th>
                      <th>Avg Rating</th>
                      <th>Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((l) => (
                      <tr key={l.userId}>
                        <td>
                          <span className="w-7 h-7 bg-accent flex items-center justify-center text-white text-xs font-bold inline-flex">
                            {l.rank}
                          </span>
                        </td>
                        <td>
                          <div>
                            <p className="font-semibold">
                              {l.displayName || "Anonymous"}
                            </p>
                            <p className="text-xs font-mono opacity-50">
                              {l.walletAddress}
                            </p>
                          </div>
                        </td>
                        <td className="font-heading font-extrabold text-accent">
                          {l.score}
                        </td>
                        <td>
                          <span className="tag tag-accent">{l.level}</span>
                        </td>
                        <td>{l.totalDeals}</td>
                        <td>
                          {l.avgRating > 0
                            ? `${l.avgRating.toFixed(1)} / 5`
                            : "—"}
                        </td>
                        <td>
                          <span className="tag tag-neutral">
                            {l.verificationTier}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
