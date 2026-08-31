"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Star,
  Users,
  Bell,
  Key,
  Copy,
  Trash2,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import WalletLogin from "@/components/WalletLogin";
import Nav from "@/components/Nav";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const LEVEL_COLORS: Record<string, string> = {
  NEW: "bg-neutral-300",
  BRONZE: "bg-amber-700",
  SILVER: "bg-neutral-400",
  GOLD: "bg-yellow-500",
  PLATINUM: "bg-cyan-500",
  DIAMOND: "bg-purple-500",
};

export default function AccountPage() {
  const [token, setToken] = useState("");
  const [tab, setTab] = useState<
    "trust" | "referral" | "notifications" | "verification" | "apikeys"
  >("trust");
  const [trustScore, setTrustScore] = useState<any>(null);
  const [referral, setReferral] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifPagination, setNotifPagination] = useState<any>(null);
  const [notifPrefs, setNotifPrefs] = useState<any>(null);
  const [verification, setVerification] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"error" | "success">(
    "error"
  );

  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState("");
  const [verifyPhone, setVerifyPhone] = useState("");
  const [copied, setCopied] = useState(false);

  const showFeedback = (msg: string, type: "error" | "success" = "error") => {
    setFeedback(msg);
    setFeedbackType(type);
    setTimeout(() => setFeedback(""), 4000);
  };

  useEffect(() => {
    const stored = localStorage.getItem("user_token");
    if (stored) setToken(stored);
  }, []);

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const loadTab = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      if (tab === "trust") {
        const res = await fetch(`${API}/user/trust-score`, { headers });
        setTrustScore(await res.json());
      } else if (tab === "referral") {
        const res = await fetch(`${API}/user/referral`, { headers });
        setReferral(await res.json());
      } else if (tab === "notifications") {
        const [nRes, pRes] = await Promise.all([
          fetch(`${API}/user/notifications?limit=20`, { headers }),
          fetch(`${API}/user/notifications/preferences`, { headers }),
        ]);
        const nData = await nRes.json();
        setNotifications(nData.notifications || []);
        setNotifPagination(nData.pagination || null);
        setNotifPrefs(await pRes.json());
      } else if (tab === "verification") {
        const res = await fetch(`${API}/user/verification`, { headers });
        setVerification(await res.json());
      } else if (tab === "apikeys") {
        const res = await fetch(`${API}/user/api-keys`, { headers });
        setApiKeys(await res.json());
      }
    } catch {}
    setLoading(false);
  }, [token, tab]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const generateReferral = async () => {
    try {
      const res = await fetch(`${API}/user/referral/generate`, {
        method: "POST",
        headers,
      });
      const data = await res.json();
      if (data.code) {
        setReferral((prev: any) => ({ ...prev, code: data.code }));
        showFeedback("Referral code generated", "success");
      }
    } catch {
      showFeedback("Failed to generate code");
    }
  };

  const copyReferral = (code: string) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/join/${code}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const markAllRead = async () => {
    try {
      const ids = notifications.filter((n) => !n.isRead).map((n) => n.id);
      if (ids.length === 0) return;
      await fetch(`${API}/user/notifications/read`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ids }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, isRead: true }))
      );
      showFeedback("All marked as read", "success");
    } catch {
      showFeedback("Failed to mark as read");
    }
  };

  const updateNotifPref = async (key: string, value: boolean) => {
    try {
      await fetch(`${API}/user/notifications/preferences`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ [key]: value }),
      });
      setNotifPrefs((prev: any) => ({ ...prev, [key]: value }));
    } catch {
      showFeedback("Failed to update preference");
    }
  };

  const submitEmail = async () => {
    if (!verifyEmail) return;
    try {
      const res = await fetch(`${API}/user/verification/email`, {
        method: "POST",
        headers,
        body: JSON.stringify({ email: verifyEmail }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback("Email verified", "success");
        loadTab();
      } else {
        showFeedback(data.error || "Failed");
      }
    } catch {
      showFeedback("Network error");
    }
  };

  const submitPhone = async () => {
    if (!verifyPhone) return;
    try {
      const res = await fetch(`${API}/user/verification/phone`, {
        method: "POST",
        headers,
        body: JSON.stringify({ phone: verifyPhone }),
      });
      const data = await res.json();
      if (data.success) {
        showFeedback("Phone verified", "success");
        loadTab();
      } else {
        showFeedback(data.error || "Failed");
      }
    } catch {
      showFeedback("Network error");
    }
  };

  const createApiKey = async () => {
    if (!newKeyName) return;
    try {
      const res = await fetch(`${API}/user/api-keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newKeyName, permissions: ["read", "create"] }),
      });
      const data = await res.json();
      if (data.key) {
        setCreatedKey(data.key);
        setNewKeyName("");
        loadTab();
        showFeedback("API key created — save it now!", "success");
      } else {
        showFeedback(data.error || "Failed");
      }
    } catch {
      showFeedback("Network error");
    }
  };

  const deleteApiKey = async (id: string) => {
    try {
      await fetch(`${API}/user/api-keys/${id}`, {
        method: "DELETE",
        headers,
      });
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      showFeedback("API key deleted", "success");
    } catch {
      showFeedback("Failed to delete key");
    }
  };

  if (!token) {
    return <WalletLogin onAuthenticated={(t) => setToken(t)} />;
  }

  const tabs = [
    { key: "trust" as const, label: "Trust Score", icon: Star },
    { key: "referral" as const, label: "Referral", icon: Users },
    { key: "notifications" as const, label: "Notifications", icon: Bell },
    { key: "verification" as const, label: "Verification", icon: Shield },
    { key: "apikeys" as const, label: "API Keys", icon: Key },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />
      <main className="max-w-[1120px] mx-auto px-4 sm:px-6 py-8">
        {feedback && (
          <div
            className={`px-4 py-3 mb-6 text-sm border-2 ${
              feedbackType === "error"
                ? "border-accent bg-accent-100 text-accent-700"
                : "border-green-600 bg-green-600/5 text-green-700"
            }`}
          >
            {feedback}
          </div>
        )}

        <div className="mb-8">
          <p className="text-xs uppercase tracking-wider font-semibold text-accent mb-1">
            Settings
          </p>
          <h1 className="text-3xl font-heading font-extrabold">My Account</h1>
        </div>

        <div className="border-b-2 border-divider mb-6 flex gap-0 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-3 text-sm font-semibold transition-colors -mb-[2px] border-b-2 flex items-center gap-2 whitespace-nowrap ${
                  tab === t.key
                    ? "border-accent text-accent"
                    : "border-transparent text-text hover:text-accent"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <p className="text-neutral-500 py-8">Loading...</p>
        ) : (
          <>
            {tab === "trust" && (
              <div>
                <div className="bg-divider grid grid-cols-2 md:grid-cols-4 gap-[2px] mb-6">
                  <div className="bg-bg p-5">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                      Score
                    </p>
                    <p className="text-[28px] font-heading font-extrabold text-accent">
                      {trustScore?.score || 0}
                    </p>
                  </div>
                  <div className="bg-bg p-5">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                      Level
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`w-3 h-3 ${LEVEL_COLORS[trustScore?.level || "NEW"]}`}
                      />
                      <span className="text-lg font-heading font-extrabold">
                        {trustScore?.level || "NEW"}
                      </span>
                    </div>
                  </div>
                  <div className="bg-bg p-5">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                      Deals
                    </p>
                    <p className="text-[28px] font-heading font-extrabold">
                      {trustScore?.totalDealsCompleted || 0}
                    </p>
                  </div>
                  <div className="bg-bg p-5">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                      Avg Rating
                    </p>
                    <p className="text-[28px] font-heading font-extrabold">
                      {trustScore?.avgRating
                        ? trustScore.avgRating.toFixed(1)
                        : "—"}
                    </p>
                  </div>
                </div>

                <div className="sd-card p-5 mb-6">
                  <p className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-3">
                    Level Thresholds
                  </p>
                  <div className="space-y-2">
                    {[
                      { level: "BRONZE", min: 100 },
                      { level: "SILVER", min: 300 },
                      { level: "GOLD", min: 600 },
                      { level: "PLATINUM", min: 1000 },
                      { level: "DIAMOND", min: 2000 },
                    ].map((l) => (
                      <div
                        key={l.level}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-3 h-3 ${LEVEL_COLORS[l.level]}`}
                          />
                          <span className="text-sm font-semibold">
                            {l.level}
                          </span>
                        </div>
                        <span className="text-sm opacity-50">
                          {l.min}+ points
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {trustScore?.ratings?.length > 0 && (
                  <div className="sd-card p-0">
                    <div className="px-5 py-3 border-b-2 border-divider">
                      <p className="text-xs uppercase tracking-wider font-semibold opacity-50">
                        Recent Ratings
                      </p>
                    </div>
                    <div className="divide-y divide-divider">
                      {trustScore.ratings.map((r: any) => (
                        <div
                          key={r.id}
                          className="px-5 py-3 flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-semibold">
                              {"★".repeat(r.rating)}
                              {"☆".repeat(5 - r.rating)}
                            </p>
                            {r.review && (
                              <p className="text-xs opacity-50 mt-1">
                                {r.review}
                              </p>
                            )}
                          </div>
                          <span className="text-xs opacity-40">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "referral" && (
              <div>
                <div className="bg-divider grid grid-cols-2 md:grid-cols-3 gap-[2px] mb-6">
                  <div className="bg-bg p-5">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                      Your Code
                    </p>
                    {referral?.code ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-heading font-extrabold text-accent">
                          {referral.code}
                        </span>
                        <button onClick={() => copyReferral(referral.code)}>
                          <Copy className="w-4 h-4 opacity-50 hover:opacity-100" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={generateReferral}
                        className="btn btn-primary text-xs mt-1"
                      >
                        Generate Code
                      </button>
                    )}
                  </div>
                  <div className="bg-bg p-5">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                      Total Referrals
                    </p>
                    <p className="text-[28px] font-heading font-extrabold">
                      {referral?.totalReferrals || 0}
                    </p>
                  </div>
                  <div className="bg-bg p-5">
                    <p className="text-[11px] uppercase tracking-wider opacity-50 font-semibold mb-1">
                      Earnings
                    </p>
                    <p className="text-[28px] font-heading font-extrabold text-accent">
                      {referral?.totalEarnings || "0"}
                    </p>
                  </div>
                </div>

                {copied && (
                  <div className="border-2 border-green-600 bg-green-600/5 px-4 py-3 mb-4 text-sm text-green-700">
                    Referral link copied to clipboard!
                  </div>
                )}

                <div className="sd-card p-5">
                  <p className="text-sm font-semibold mb-2">How it works</p>
                  <ul className="space-y-2 text-sm opacity-60">
                    <li>1. Generate your unique referral code</li>
                    <li>
                      2. Share your link with friends and business partners
                    </li>
                    <li>
                      3. Earn 10% of the protocol fee on every deal they
                      complete
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {tab === "notifications" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm opacity-50">
                    {notifications.filter((n) => !n.isRead).length} unread
                  </p>
                  <button
                    onClick={markAllRead}
                    className="btn btn-secondary text-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark All Read
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <div className="text-center py-16 border-2 border-divider">
                    <Bell className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                    <p className="text-neutral-600">No notifications yet</p>
                  </div>
                ) : (
                  <div className="border-2 border-divider divide-y divide-divider mb-6">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-5 py-3 ${!n.isRead ? "bg-accent/5" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{n.title}</p>
                          <span className="text-xs opacity-40">
                            {new Date(n.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm opacity-60 mt-1">{n.message}</p>
                        <span className="tag tag-neutral mt-2">
                          {n.type?.replace(/_/g, " ")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {notifPrefs && (
                  <div className="sd-card p-5">
                    <p className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-4">
                      Preferences
                    </p>
                    <div className="space-y-3">
                      {[
                        {
                          key: "emailEnabled",
                          label: "Email Notifications",
                        },
                        { key: "pushEnabled", label: "Push Notifications" },
                        { key: "dealUpdates", label: "Deal Updates" },
                        { key: "disputeAlerts", label: "Dispute Alerts" },
                        { key: "referralAlerts", label: "Referral Alerts" },
                        {
                          key: "marketingEmails",
                          label: "Marketing Emails",
                        },
                      ].map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <span className="text-sm">{p.label}</span>
                          <button
                            onClick={() =>
                              updateNotifPref(p.key, !notifPrefs[p.key])
                            }
                            className={`w-10 h-6 flex items-center p-0.5 transition-colors ${
                              notifPrefs[p.key]
                                ? "bg-accent justify-end"
                                : "bg-neutral-300 justify-start"
                            }`}
                          >
                            <span className="w-5 h-5 bg-white block shadow" />
                          </button>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "verification" && verification && (
              <div>
                <div className="bg-divider grid grid-cols-1 md:grid-cols-3 gap-[2px] mb-6">
                  {Object.entries(verification.tiers || {}).map(
                    ([tier, info]: [string, any]) => (
                      <div
                        key={tier}
                        className={`bg-bg p-5 ${tier === verification.currentTier ? "border-l-4 border-accent" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="tag tag-accent">{tier}</span>
                          {tier === verification.currentTier && (
                            <CheckCircle className="w-4 h-4 text-accent" />
                          )}
                        </div>
                        <p className="text-sm opacity-70 mb-2">
                          {info.description}
                        </p>
                        <p className="text-xs opacity-50">
                          Max single: {info.maxSingle} | Max total:{" "}
                          {info.maxTotal}
                        </p>
                      </div>
                    )
                  )}
                </div>

                <div className="sd-card p-5 mb-4">
                  <p className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-4">
                    Verify Email
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      placeholder={
                        verification.email || "Enter your email address"
                      }
                      value={verifyEmail}
                      onChange={(e) => setVerifyEmail(e.target.value)}
                      className="sd-input flex-1"
                    />
                    <button
                      onClick={submitEmail}
                      className="btn btn-primary"
                    >
                      Verify
                    </button>
                  </div>
                  {verification.email && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Email set: {verification.email}
                    </p>
                  )}
                </div>

                <div className="sd-card p-5">
                  <p className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-4">
                    Verify Phone
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      placeholder={
                        verification.phone || "Enter your phone number"
                      }
                      value={verifyPhone}
                      onChange={(e) => setVerifyPhone(e.target.value)}
                      className="sd-input flex-1"
                    />
                    <button
                      onClick={submitPhone}
                      className="btn btn-primary"
                    >
                      Verify
                    </button>
                  </div>
                  {verification.phone && (
                    <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Phone set: {verification.phone}
                    </p>
                  )}
                </div>
              </div>
            )}

            {tab === "apikeys" && (
              <div>
                <div className="sd-card p-5 mb-6">
                  <p className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-4">
                    Create New API Key
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Key name (e.g. My Integration)"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      className="sd-input flex-1"
                    />
                    <button
                      onClick={createApiKey}
                      className="btn btn-primary"
                    >
                      Create
                    </button>
                  </div>
                </div>

                {createdKey && (
                  <div className="border-2 border-accent bg-accent/5 p-5 mb-6">
                    <p className="text-sm font-semibold text-accent mb-2">
                      Save this key — it will not be shown again
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-white p-2 flex-1 break-all border border-divider">
                        {showKey ? createdKey : "••••••••••••••••••••"}
                      </code>
                      <button onClick={() => setShowKey(!showKey)}>
                        {showKey ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdKey);
                          showFeedback("Copied!", "success");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {apiKeys.length === 0 ? (
                  <div className="text-center py-16 border-2 border-divider">
                    <Key className="w-12 h-12 text-neutral-300 mx-auto mb-2" />
                    <p className="text-neutral-600">No API keys yet</p>
                  </div>
                ) : (
                  <div className="border-2 border-divider divide-y divide-divider">
                    {apiKeys.map((k) => (
                      <div
                        key={k.id}
                        className="px-5 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold">{k.name}</p>
                          <p className="text-xs font-mono opacity-50">
                            {k.keyPrefix}...
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className={`tag ${k.isActive ? "tag-accent" : "tag-neutral"}`}
                            >
                              {k.isActive ? "ACTIVE" : "INACTIVE"}
                            </span>
                            {k.permissions?.map((p: string) => (
                              <span key={p} className="tag tag-neutral">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs opacity-40">
                            {k.lastUsedAt
                              ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                              : "Never used"}
                          </span>
                          <button
                            onClick={() => deleteApiKey(k.id)}
                            className="text-accent hover:opacity-70"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
