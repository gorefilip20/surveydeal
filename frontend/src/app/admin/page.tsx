"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Coins,
  Settings,
  ClipboardList,
  LogOut,
  Shield,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Ban,
  UserCheck,
  Edit,
  Star,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  DollarSign,
  Activity,
  TrendingUp,
  BarChart3,
  Inbox,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "escrows", label: "Escrows", icon: FileText },
  { id: "users", label: "Users", icon: Users },
  { id: "tokens", label: "Tokens", icon: Coins },
  { id: "config", label: "Config", icon: Settings },
  { id: "audit", label: "Audit Log", icon: ClipboardList },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
  { id: "deposits", label: "Deposits", icon: Inbox },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function api(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...authHeaders(), ...(opts.headers as Record<string, string> || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    window.location.reload();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

function shortAddr(addr: string) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(d: string | number) {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function formatUsd(v: number | string) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "$0.00";
  return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Reusable UI Components ─────────────────────────────────────────────────

function Spinner() {
  return <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />;
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  const colors: Record<string, string> = {
    green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    gray: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border ${colors[color] || colors.gray}`}>
      {children}
    </span>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  const gradients: Record<string, string> = {
    green: "from-emerald-500/20 to-emerald-500/5",
    blue: "from-blue-500/20 to-blue-500/5",
    red: "from-red-500/20 to-red-500/5",
    yellow: "from-yellow-500/20 to-yellow-500/5",
    purple: "from-purple-500/20 to-purple-500/5",
  };
  const iconColors: Record<string, string> = {
    green: "text-emerald-400",
    blue: "text-blue-400",
    red: "text-red-400",
    yellow: "text-yellow-400",
    purple: "text-purple-400",
  };
  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br ${gradients[color] || gradients.green} p-5`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
        <Icon className={`w-8 h-8 ${iconColors[color] || iconColors.green} opacity-60`} />
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "danger" | "ghost" | "outline";
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base = "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:from-emerald-600 hover:to-blue-600 shadow-lg shadow-emerald-500/20",
    danger: "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30",
    ghost: "text-slate-400 hover:text-white hover:bg-white/5",
    outline: "border border-white/10 text-slate-300 hover:border-emerald-500/30 hover:text-white",
  };
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 rounded-xl border border-white/10 bg-[#0d1321] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-sm appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-[#0d1321]">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Login Screen ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string, user: any) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/admin/auth/simple-login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem("admin_token", data.token);
      localStorage.setItem("admin_user", JSON.stringify(data.user));
      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-500 mb-4 shadow-lg shadow-emerald-500/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Surveydeal Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to the admin dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <InputField label="Email" value={email} onChange={setEmail} type="email" placeholder="admin@surveydeal.com" />
          <InputField label="Password" value={password} onChange={setPassword} type="password" placeholder="Enter password" />

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-blue-500 text-white font-medium text-sm hover:from-emerald-600 hover:to-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {loading ? <Spinner /> : <Lock className="w-4 h-4" />}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    api("/admin/analytics/overview")
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  if (error) return <div className="text-red-400 text-center py-10">{error}</div>;
  if (!stats) return null;

  const cards = [
    { label: "Total Escrows", value: stats.totalEscrows ?? 0, icon: FileText, color: "green" },
    { label: "Active", value: stats.activeEscrows ?? 0, icon: Activity, color: "blue" },
    { label: "Disputed", value: stats.disputedEscrows ?? 0, icon: AlertTriangle, color: "red" },
    { label: "Completed", value: stats.completedEscrows ?? 0, icon: CheckCircle2, color: "green" },
    { label: "Total Users", value: stats.totalUsers ?? 0, icon: Users, color: "purple" },
    { label: "Frozen Users", value: stats.frozenUsers ?? 0, icon: Ban, color: "red" },
    { label: "Total Volume", value: formatUsd(stats.totalVolume ?? 0), icon: TrendingUp, color: "green" },
    { label: "Total Fees", value: formatUsd(stats.totalFees ?? 0), icon: DollarSign, color: "yellow" },
  ];

  const recent = stats.recentTransactions || stats.recentEscrows || [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Dashboard Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {recent.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Recent Transactions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Buyer</th>
                  <th className="px-5 py-3">Seller</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">State</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {recent.map((tx: any) => (
                  <tr key={tx.id || tx._id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{(tx.id || tx._id || "").toString().slice(-8)}</td>
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{shortAddr(tx.buyer || tx.buyerAddress || "")}</td>
                    <td className="px-5 py-3 text-slate-300 font-mono text-xs">{shortAddr(tx.seller || tx.sellerAddress || "")}</td>
                    <td className="px-5 py-3 text-white">{tx.amount ?? tx.totalAmount ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge color={tx.state === "COMPLETED" ? "green" : tx.state === "DISPUTED" ? "red" : "blue"}>
                        {tx.state || "—"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{formatDate(tx.createdAt || tx.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Escrows Tab ─────────────────────────────────────────────────────────────

function EscrowsTab() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stateFilter, setStateFilter] = useState("");
  const [modeFilter, setModeFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Dispute resolution
  const [resolveModal, setResolveModal] = useState<any>(null);
  const [buyerPercent, setBuyerPercent] = useState(50);
  const [resolveReason, setResolveReason] = useState("");
  const [resolving, setResolving] = useState(false);

  const fetchEscrows = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (stateFilter) params.set("state", stateFilter);
    if (modeFilter) params.set("mode", modeFilter);
    api(`/admin/escrows?${params}`)
      .then((data) => {
        setEscrows(data.escrows || data.data || []);
        setTotalPages(data.totalPages || data.pages || 1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, stateFilter, modeFilter]);

  useEffect(() => {
    fetchEscrows();
  }, [fetchEscrows]);

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setDetailLoading(true);
    api(`/admin/escrows/${id}`)
      .then(setExpandedDetail)
      .catch(() => setExpandedDetail(null))
      .finally(() => setDetailLoading(false));
  }

  async function handleResolve() {
    if (!resolveModal) return;
    setResolving(true);
    try {
      await api(`/admin/disputes/${resolveModal.id || resolveModal._id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          buyerPercent,
          sellerPercent: 100 - buyerPercent,
          reason: resolveReason,
        }),
      });
      setResolveModal(null);
      setResolveReason("");
      setBuyerPercent(50);
      fetchEscrows();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setResolving(false);
    }
  }

  const stateOptions = [
    { value: "", label: "All States" },
    { value: "CREATED", label: "Created" },
    { value: "FUNDED", label: "Funded" },
    { value: "ACTIVE", label: "Active" },
    { value: "DISPUTED", label: "Disputed" },
    { value: "COMPLETED", label: "Completed" },
    { value: "CANCELLED", label: "Cancelled" },
    { value: "REFUNDED", label: "Refunded" },
  ];

  const modeOptions = [
    { value: "", label: "All Modes" },
    { value: "LOCKED", label: "Locked (2-of-2)" },
    { value: "ARBITER", label: "Arbiter (2-of-3)" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Escrows</h2>
        <div className="flex gap-3">
          <SelectField label="" value={stateFilter} onChange={(v) => { setStateFilter(v); setPage(1); }} options={stateOptions} />
          <SelectField label="" value={modeFilter} onChange={(v) => { setModeFilter(v); setPage(1); }} options={modeOptions} />
          <Btn variant="ghost" onClick={fetchEscrows}><RefreshCw className="w-4 h-4" /></Btn>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <div className="text-red-400 text-center py-10">{error}</div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-5 py-3"></th>
                  <th className="px-5 py-3">ID</th>
                  <th className="px-5 py-3">Buyer</th>
                  <th className="px-5 py-3">Seller</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Mode</th>
                  <th className="px-5 py-3">State</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {escrows.map((esc) => {
                  const id = esc.id || esc._id || esc.escrowId;
                  const isExpanded = expandedId === id;
                  return (
                    <Fragment key={id}>
                      <tr className="hover:bg-white/[0.02] cursor-pointer" onClick={() => toggleExpand(id)}>
                        <td className="px-5 py-3 text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </td>
                        <td className="px-5 py-3 text-slate-300 font-mono text-xs">{id.toString().slice(-8)}</td>
                        <td className="px-5 py-3 text-slate-300 font-mono text-xs">{shortAddr(esc.buyer || esc.buyerAddress || "")}</td>
                        <td className="px-5 py-3 text-slate-300 font-mono text-xs">{shortAddr(esc.seller || esc.sellerAddress || "")}</td>
                        <td className="px-5 py-3 text-white">{esc.amount ?? esc.totalAmount ?? "—"}</td>
                        <td className="px-5 py-3">
                          <Badge color={esc.mode === "ARBITER" ? "purple" : "blue"}>{esc.mode || "—"}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge
                            color={
                              esc.state === "COMPLETED" ? "green" :
                              esc.state === "DISPUTED" ? "red" :
                              esc.state === "CANCELLED" || esc.state === "REFUNDED" ? "gray" :
                              "blue"
                            }
                          >
                            {esc.state || "—"}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{formatDate(esc.createdAt || esc.created_at)}</td>
                        <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                          {esc.state === "DISPUTED" && (
                            <Btn size="sm" variant="danger" onClick={() => { setResolveModal(esc); setBuyerPercent(50); setResolveReason(""); }}>
                              Resolve
                            </Btn>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="bg-white/[0.01] px-10 py-4">
                            {detailLoading ? (
                              <Spinner />
                            ) : expandedDetail ? (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-slate-500">Token:</span>
                                  <p className="text-white font-mono">{expandedDetail.tokenSymbol || expandedDetail.token || shortAddr(expandedDetail.tokenAddress || "")}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Fee:</span>
                                  <p className="text-white">{expandedDetail.fee ?? expandedDetail.feeAmount ?? "—"}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Arbiter:</span>
                                  <p className="text-white font-mono">{shortAddr(expandedDetail.arbiter || expandedDetail.arbiterAddress || "")}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Milestones:</span>
                                  <p className="text-white">{expandedDetail.milestoneCount ?? (expandedDetail.milestones?.length ?? "—")}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Description:</span>
                                  <p className="text-white">{expandedDetail.description || "—"}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Chain ID:</span>
                                  <p className="text-white">{expandedDetail.chainId || "—"}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">Updated:</span>
                                  <p className="text-white">{formatDate(expandedDetail.updatedAt || expandedDetail.updated_at)}</p>
                                </div>
                                <div>
                                  <span className="text-slate-500">On-chain ID:</span>
                                  <p className="text-white font-mono">{expandedDetail.onChainId ?? expandedDetail.contractEscrowId ?? "—"}</p>
                                </div>
                                {expandedDetail.milestones && expandedDetail.milestones.length > 0 && (
                                  <div className="col-span-full">
                                    <span className="text-slate-500">Milestones:</span>
                                    <div className="mt-2 space-y-1">
                                      {expandedDetail.milestones.map((m: any, i: number) => (
                                        <div key={i} className="flex items-center gap-3 text-white">
                                          <span className="text-slate-500">#{i + 1}</span>
                                          <span>{m.description || m.title || `Milestone ${i + 1}`}</span>
                                          <span className="text-emerald-400">{m.amount}</span>
                                          <Badge color={m.status === "RELEASED" ? "green" : m.status === "DISPUTED" ? "red" : "gray"}>
                                            {m.status || "PENDING"}
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-slate-400">No details available</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {escrows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-10 text-center text-slate-500">No escrows found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Btn>
                <Btn size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next <ChevronRight className="w-4 h-4" />
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resolve Dispute Modal */}
      <Modal open={!!resolveModal} onClose={() => setResolveModal(null)} title="Resolve Dispute">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Escrow: <span className="text-white font-mono">{resolveModal ? (resolveModal.id || resolveModal._id || "").toString().slice(-8) : ""}</span>
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider">
              Split: Buyer {buyerPercent}% / Seller {100 - buyerPercent}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={buyerPercent}
              onChange={(e) => setBuyerPercent(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-white/10"
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Buyer: {buyerPercent}%</span>
              <span>Seller: {100 - buyerPercent}%</span>
            </div>
          </div>

          <InputField label="Reason" value={resolveReason} onChange={setResolveReason} placeholder="Reason for resolution..." />

          <div className="flex justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setResolveModal(null)}>Cancel</Btn>
            <Btn onClick={handleResolve} disabled={resolving || !resolveReason}>
              {resolving ? <Spinner /> : <CheckCircle2 className="w-4 h-4" />}
              {resolving ? "Resolving..." : "Resolve Dispute"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    api(`/admin/users?${params}`)
      .then((data) => {
        setUsers(data.users || data.data || []);
        setTotalPages(data.totalPages || data.pages || 1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function toggleFreeze(user: any) {
    const id = user.id || user._id;
    const isFrozen = user.status === "frozen" || user.isFrozen;
    const newStatus = isFrozen ? "active" : "frozen";
    setActionLoading(id);
    try {
      await api(`/admin/users/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      fetchUsers();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Users</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search users..."
              className="pl-9 pr-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm w-64"
            />
          </div>
          <Btn variant="ghost" onClick={fetchUsers}><RefreshCw className="w-4 h-4" /></Btn>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <div className="text-red-400 text-center py-10">{error}</div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-5 py-3">Wallet</th>
                  <th className="px-5 py-3">Display Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Escrows</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((u) => {
                  const id = u.id || u._id;
                  const isFrozen = u.status === "frozen" || u.isFrozen;
                  return (
                    <tr key={id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-slate-300 font-mono text-xs">{shortAddr(u.walletAddress || u.address || "")}</td>
                      <td className="px-5 py-3 text-white">{u.displayName || u.name || "—"}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{u.email || "—"}</td>
                      <td className="px-5 py-3 text-white">{u.escrowCount ?? u.totalEscrows ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge color={isFrozen ? "red" : "green"}>{isFrozen ? "Frozen" : "Active"}</Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{formatDate(u.createdAt || u.created_at)}</td>
                      <td className="px-5 py-3">
                        <Btn
                          size="sm"
                          variant={isFrozen ? "outline" : "danger"}
                          disabled={actionLoading === id}
                          onClick={() => toggleFreeze(u)}
                        >
                          {actionLoading === id ? <Spinner /> : isFrozen ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                          {isFrozen ? "Unfreeze" : "Freeze"}
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Btn>
                <Btn size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next <ChevronRight className="w-4 h-4" />
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tokens Tab ──────────────────────────────────────────────────────────────

function TokensTab() {
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add token modal
  const [showAdd, setShowAdd] = useState(false);
  const [newToken, setNewToken] = useState({ address: "", symbol: "", name: "", decimals: "18", chainId: "1", logoUrl: "" });
  const [adding, setAdding] = useState(false);

  // Edit token modal
  const [editToken, setEditToken] = useState<any>(null);
  const [editForm, setEditForm] = useState({ symbol: "", name: "", decimals: "", logoUrl: "" });
  const [editing, setEditing] = useState(false);

  const fetchTokens = useCallback(() => {
    setLoading(true);
    api("/admin/tokens")
      .then((data) => setTokens(data.tokens || data.data || data || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  async function addToken() {
    setAdding(true);
    try {
      await api("/admin/tokens", {
        method: "POST",
        body: JSON.stringify({
          ...newToken,
          decimals: parseInt(newToken.decimals) || 18,
          chainId: parseInt(newToken.chainId) || 1,
        }),
      });
      setShowAdd(false);
      setNewToken({ address: "", symbol: "", name: "", decimals: "18", chainId: "1", logoUrl: "" });
      fetchTokens();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function updateTokenStatus(token: any, status: string) {
    const id = token.id || token._id;
    setActionLoading(id + status);
    try {
      await api(`/admin/tokens/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      fetchTokens();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function saveEdit() {
    if (!editToken) return;
    const id = editToken.id || editToken._id;
    setEditing(true);
    try {
      await api(`/admin/tokens/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          symbol: editForm.symbol,
          name: editForm.name,
          decimals: parseInt(editForm.decimals) || 18,
          logoUrl: editForm.logoUrl,
        }),
      });
      setEditToken(null);
      fetchTokens();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setEditing(false);
    }
  }

  async function deleteToken(token: any) {
    const id = token.id || token._id;
    if (!confirm(`Delete token ${token.symbol || id}?`)) return;
    setActionLoading(id + "del");
    try {
      await api(`/admin/tokens/${id}`, { method: "DELETE" });
      fetchTokens();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  function openEdit(token: any) {
    setEditToken(token);
    setEditForm({
      symbol: token.symbol || "",
      name: token.name || "",
      decimals: String(token.decimals ?? 18),
      logoUrl: token.logoUrl || token.logo || "",
    });
  }

  const statusColor = (s: string) => {
    if (s === "active" || s === "Active") return "green";
    if (s === "featured" || s === "Featured") return "purple";
    if (s === "blacklisted" || s === "Blacklisted") return "red";
    return "gray";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Tokens</h2>
        <div className="flex gap-3">
          <Btn onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Token</Btn>
          <Btn variant="ghost" onClick={fetchTokens}><RefreshCw className="w-4 h-4" /></Btn>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <div className="text-red-400 text-center py-10">{error}</div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-5 py-3">Symbol</th>
                  <th className="px-5 py-3">Name</th>
                  <th className="px-5 py-3">Address</th>
                  <th className="px-5 py-3">Decimals</th>
                  <th className="px-5 py-3">Chain</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tokens.map((t) => {
                  const id = t.id || t._id;
                  return (
                    <tr key={id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3 text-white font-semibold">{t.symbol || "—"}</td>
                      <td className="px-5 py-3 text-slate-300">{t.name || "—"}</td>
                      <td className="px-5 py-3 text-slate-300 font-mono text-xs">{shortAddr(t.address || t.tokenAddress || "")}</td>
                      <td className="px-5 py-3 text-slate-300">{t.decimals ?? "—"}</td>
                      <td className="px-5 py-3 text-slate-300">{t.chainId || "—"}</td>
                      <td className="px-5 py-3">
                        <Badge color={statusColor(t.status || "")}>{t.status || "—"}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <Btn size="sm" variant="ghost" onClick={() => openEdit(t)} title="Edit">
                            <Edit className="w-3.5 h-3.5" />
                          </Btn>
                          <Btn size="sm" variant="ghost" onClick={() => updateTokenStatus(t, "active")} disabled={!!actionLoading} title="Active">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          </Btn>
                          <Btn size="sm" variant="ghost" onClick={() => updateTokenStatus(t, "featured")} disabled={!!actionLoading} title="Featured">
                            <Star className="w-3.5 h-3.5 text-yellow-400" />
                          </Btn>
                          <Btn size="sm" variant="ghost" onClick={() => updateTokenStatus(t, "blacklisted")} disabled={!!actionLoading} title="Blacklist">
                            <Ban className="w-3.5 h-3.5 text-red-400" />
                          </Btn>
                          <Btn size="sm" variant="danger" onClick={() => deleteToken(t)} disabled={!!actionLoading} title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tokens.length === 0 && (
                  <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-500">No tokens found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Token Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Token">
        <div className="space-y-3">
          <InputField label="Contract Address" value={newToken.address} onChange={(v) => setNewToken({ ...newToken, address: v })} placeholder="0x..." />
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Symbol" value={newToken.symbol} onChange={(v) => setNewToken({ ...newToken, symbol: v })} placeholder="USDT" />
            <InputField label="Name" value={newToken.name} onChange={(v) => setNewToken({ ...newToken, name: v })} placeholder="Tether USD" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Decimals" value={newToken.decimals} onChange={(v) => setNewToken({ ...newToken, decimals: v })} placeholder="18" />
            <InputField label="Chain ID" value={newToken.chainId} onChange={(v) => setNewToken({ ...newToken, chainId: v })} placeholder="1" />
          </div>
          <InputField label="Logo URL" value={newToken.logoUrl} onChange={(v) => setNewToken({ ...newToken, logoUrl: v })} placeholder="https://..." />
          <div className="flex justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn onClick={addToken} disabled={adding || !newToken.address || !newToken.symbol}>
              {adding ? <Spinner /> : <Plus className="w-4 h-4" />}
              {adding ? "Adding..." : "Add Token"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* Edit Token Modal */}
      <Modal open={!!editToken} onClose={() => setEditToken(null)} title="Edit Token">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Symbol" value={editForm.symbol} onChange={(v) => setEditForm({ ...editForm, symbol: v })} />
            <InputField label="Name" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} />
          </div>
          <InputField label="Decimals" value={editForm.decimals} onChange={(v) => setEditForm({ ...editForm, decimals: v })} />
          <InputField label="Logo URL" value={editForm.logoUrl} onChange={(v) => setEditForm({ ...editForm, logoUrl: v })} />
          <div className="flex justify-end gap-3 pt-2">
            <Btn variant="ghost" onClick={() => setEditToken(null)}>Cancel</Btn>
            <Btn onClick={saveEdit} disabled={editing}>
              {editing ? <Spinner /> : <CheckCircle2 className="w-4 h-4" />}
              {editing ? "Saving..." : "Save Changes"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Config Tab ──────────────────────────────────────────────────────────────

function ConfigTab() {
  const [fee, setFee] = useState({ feeBasisPoints: "", maxFeeAbsolute: "", feeRecipient: "" });
  const [savingFee, setSavingFee] = useState(false);
  const [feeMsg, setFeeMsg] = useState("");

  const [paused, setPaused] = useState(false);
  const [pauseLoading, setPauseLoading] = useState(false);

  const [arbiters, setArbiters] = useState<any[]>([]);
  const [arbiterLoading, setArbiterLoading] = useState(true);
  const [newArbiter, setNewArbiter] = useState("");
  const [addingArbiter, setAddingArbiter] = useState(false);
  const [removingArbiter, setRemovingArbiter] = useState<string | null>(null);

  useEffect(() => {
    // Load current fee config from overview or a dedicated endpoint
    api("/admin/analytics/overview")
      .then((data) => {
        if (data.config) {
          setFee({
            feeBasisPoints: String(data.config.feeBasisPoints ?? ""),
            maxFeeAbsolute: String(data.config.maxFeeAbsolute ?? ""),
            feeRecipient: data.config.feeRecipient ?? "",
          });
          setPaused(!!data.config.paused);
        }
        if (data.arbiters) {
          setArbiters(data.arbiters);
        }
      })
      .catch(() => {})
      .finally(() => setArbiterLoading(false));
  }, []);

  async function saveFee() {
    setSavingFee(true);
    setFeeMsg("");
    try {
      await api("/admin/config", {
        method: "POST",
        body: JSON.stringify({
          feeBasisPoints: parseInt(fee.feeBasisPoints) || 0,
          maxFeeAbsolute: fee.maxFeeAbsolute,
          feeRecipient: fee.feeRecipient,
        }),
      });
      setFeeMsg("Fee configuration saved successfully.");
    } catch (e: any) {
      setFeeMsg(e.message);
    } finally {
      setSavingFee(false);
    }
  }

  async function togglePause() {
    setPauseLoading(true);
    try {
      if (paused) {
        await api("/admin/config/unpause", { method: "POST" });
        setPaused(false);
      } else {
        await api("/admin/config/pause", { method: "POST" });
        setPaused(true);
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPauseLoading(false);
    }
  }

  async function addArbiter() {
    if (!newArbiter) return;
    setAddingArbiter(true);
    try {
      await api("/admin/arbiters", {
        method: "POST",
        body: JSON.stringify({ walletAddress: newArbiter }),
      });
      setArbiters((prev) => [...prev, { walletAddress: newArbiter }]);
      setNewArbiter("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAddingArbiter(false);
    }
  }

  async function removeArbiter(addr: string) {
    if (!confirm(`Remove arbiter ${shortAddr(addr)}?`)) return;
    setRemovingArbiter(addr);
    try {
      await api(`/admin/arbiters/${addr}`, { method: "DELETE" });
      setArbiters((prev) => prev.filter((a) => (a.walletAddress || a.address || a) !== addr));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setRemovingArbiter(null);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-bold text-white">Protocol Configuration</h2>

      {/* Fee Config */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" /> Fee Configuration
        </h3>

        <InputField
          label="Fee Basis Points (100 = 1%)"
          value={fee.feeBasisPoints}
          onChange={(v) => setFee({ ...fee, feeBasisPoints: v })}
          placeholder="250"
        />
        <InputField
          label="Max Fee Absolute (token units)"
          value={fee.maxFeeAbsolute}
          onChange={(v) => setFee({ ...fee, maxFeeAbsolute: v })}
          placeholder="1000000000000000000"
        />
        <InputField
          label="Fee Recipient Address"
          value={fee.feeRecipient}
          onChange={(v) => setFee({ ...fee, feeRecipient: v })}
          placeholder="0x..."
        />

        {feeMsg && (
          <p className={`text-sm ${feeMsg.includes("success") ? "text-emerald-400" : "text-red-400"}`}>{feeMsg}</p>
        )}

        <Btn onClick={saveFee} disabled={savingFee}>
          {savingFee ? <Spinner /> : <CheckCircle2 className="w-4 h-4" />}
          {savingFee ? "Saving..." : "Save Fee Config"}
        </Btn>
      </div>

      {/* Protocol Pause */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          {paused ? <Pause className="w-4 h-4 text-red-400" /> : <Play className="w-4 h-4 text-emerald-400" />}
          Protocol Status
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white">
              Protocol is currently <Badge color={paused ? "red" : "green"}>{paused ? "PAUSED" : "ACTIVE"}</Badge>
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {paused ? "New escrows cannot be created while paused." : "The protocol is accepting new escrows."}
            </p>
          </div>
          <Btn
            variant={paused ? "primary" : "danger"}
            onClick={togglePause}
            disabled={pauseLoading}
          >
            {pauseLoading ? <Spinner /> : paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            {paused ? "Unpause" : "Pause Protocol"}
          </Btn>
        </div>
      </div>

      {/* Arbiter Management */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" /> Arbiter Management
        </h3>

        <div className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={newArbiter}
              onChange={(e) => setNewArbiter(e.target.value)}
              placeholder="0x... arbiter wallet address"
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm font-mono"
            />
          </div>
          <Btn onClick={addArbiter} disabled={addingArbiter || !newArbiter}>
            {addingArbiter ? <Spinner /> : <Plus className="w-4 h-4" />}
            Add
          </Btn>
        </div>

        {arbiterLoading ? (
          <Spinner />
        ) : arbiters.length === 0 ? (
          <p className="text-sm text-slate-500">No arbiters configured.</p>
        ) : (
          <div className="space-y-2">
            {arbiters.map((a) => {
              const addr = a.walletAddress || a.address || a;
              return (
                <div key={addr} className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-white/5 bg-white/[0.02]">
                  <span className="text-sm font-mono text-slate-300">{addr}</span>
                  <Btn
                    size="sm"
                    variant="danger"
                    onClick={() => removeArbiter(addr)}
                    disabled={removingArbiter === addr}
                  >
                    {removingArbiter === addr ? <Spinner /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Btn>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Audit Log Tab ───────────────────────────────────────────────────────────

function AuditLogTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    api(`/admin/audit-log?page=${page}&limit=25`)
      .then((data) => {
        setLogs(data.logs || data.data || []);
        setTotalPages(data.totalPages || data.pages || 1);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const actionColor = (action: string) => {
    if (!action) return "gray";
    const a = action.toLowerCase();
    if (a.includes("delete") || a.includes("remove") || a.includes("freeze") || a.includes("pause") || a.includes("blacklist")) return "red";
    if (a.includes("create") || a.includes("add") || a.includes("unfreeze") || a.includes("unpause")) return "green";
    if (a.includes("update") || a.includes("edit") || a.includes("resolve")) return "blue";
    return "gray";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Audit Log</h2>
        <Btn variant="ghost" onClick={fetchLogs}><RefreshCw className="w-4 h-4" /></Btn>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : error ? (
        <div className="text-red-400 text-center py-10">{error}</div>
      ) : (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 uppercase tracking-wider border-b border-white/5">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Admin</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">Target</th>
                  <th className="px-5 py-3">Details</th>
                  <th className="px-5 py-3">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {logs.map((log, i) => (
                  <tr key={log.id || log._id || i} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(log.timestamp || log.createdAt || log.created_at)}</td>
                    <td className="px-5 py-3 text-slate-300 text-xs">{log.adminEmail || log.admin || shortAddr(log.adminAddress || "")}</td>
                    <td className="px-5 py-3">
                      <Badge color={actionColor(log.action || "")}>{log.action || "—"}</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-300 text-xs font-mono">{log.targetType ? `${log.targetType}: ${(log.targetId || "").toString().slice(-8)}` : log.target || "—"}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs max-w-xs truncate">{typeof log.details === "object" ? JSON.stringify(log.details) : log.details || log.description || "—"}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{log.ip || log.ipAddress || "—"}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">No audit logs found</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
              <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Btn size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="w-4 h-4" /> Prev
                </Btn>
                <Btn size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next <ChevronRight className="w-4 h-4" />
                </Btn>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Approvals Tab ──────────────────────────────────────────────────────────

function ApprovalsTab() {
  const [escrows, setEscrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [vaultSummary, setVaultSummary] = useState<any>(null);
  const [approvalNotes, setApprovalNotes] = useState<Record<string, string>>({});

  const fetchPending = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api("/admin/pending-approvals");
      setEscrows(data.escrows || []);
    } catch (err: any) {
      console.error("Failed to fetch pending approvals:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVault = useCallback(async () => {
    try {
      const data = await api("/admin/vault-summary");
      setVaultSummary(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchPending();
    fetchVault();
  }, [fetchPending, fetchVault]);

  async function handleApprove(escrowId: string) {
    setActionLoading(escrowId);
    try {
      await api(`/admin/escrows/${escrowId}/approve-release`, {
        method: "POST",
        body: JSON.stringify({ notes: approvalNotes[escrowId] || "" }),
      });
      setEscrows((prev) => prev.filter((e) => e.id !== escrowId));
      fetchVault();
    } catch (err: any) {
      alert(`Approval failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRevoke(escrowId: string) {
    setActionLoading(escrowId);
    try {
      await api(`/admin/escrows/${escrowId}/revoke-approval`, {
        method: "POST",
        body: JSON.stringify({ reason: approvalNotes[escrowId] || "Revoked by admin" }),
      });
      fetchPending();
      fetchVault();
    } catch (err: any) {
      alert(`Revoke failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Vault Summary Cards */}
      {vaultSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Escrows" value={vaultSummary.totalEscrows || 0} icon={FileText} color="blue" />
          <StatCard label="Pending Approvals" value={vaultSummary.pendingApprovals || 0} icon={ShieldCheck} color="yellow" />
          <StatCard label="Vault Tokens" value={(vaultSummary.vault || []).length} icon={DollarSign} color="green" />
        </div>
      )}

      {/* Vault Balance Breakdown */}
      {vaultSummary?.vault?.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3 border-b border-white/5">
            <h3 className="text-sm font-semibold text-white">Vault Balance Summary</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-5 py-2.5 text-left text-xs text-slate-500 uppercase">Token</th>
                  <th className="px-5 py-2.5 text-right text-xs text-slate-500 uppercase">Locked</th>
                  <th className="px-5 py-2.5 text-right text-xs text-slate-500 uppercase">Released</th>
                  <th className="px-5 py-2.5 text-right text-xs text-slate-500 uppercase">Escrows</th>
                </tr>
              </thead>
              <tbody>
                {vaultSummary.vault.map((v: any) => (
                  <tr key={v.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-medium text-white">{v.symbol}</td>
                    <td className="px-5 py-3 text-right font-mono text-emerald-400">{v.totalLocked}</td>
                    <td className="px-5 py-3 text-right font-mono text-slate-400">{v.totalReleased}</td>
                    <td className="px-5 py-3 text-right text-slate-300">{v.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Approvals List */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Pending Approval Queue ({escrows.length})</h3>
          <Btn variant="ghost" size="sm" onClick={fetchPending}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Btn>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : escrows.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No pending approvals</div>
        ) : (
          <div className="divide-y divide-white/5">
            {escrows.map((esc) => (
              <div key={esc.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold text-white">{esc.title}</h4>
                      <Badge color="yellow">{esc.state}</Badge>
                      {esc.fundingMethod && <Badge color="blue">{esc.fundingMethod}</Badge>}
                    </div>
                    <p className="text-xs text-slate-500">ID: {esc.id} | On-chain: #{esc.onChainId} | Chain: {esc.chainId}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-emerald-400">{esc.totalAmount} <span className="text-xs text-slate-400">{esc.token?.symbol}</span></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500">Buyer:</span>
                    <p className="text-slate-300 font-mono">{shortAddr(esc.buyer?.walletAddress || "")}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Seller:</span>
                    <p className="text-slate-300 font-mono">{shortAddr(esc.seller?.walletAddress || "")}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Created:</span>
                    <p className="text-slate-300">{formatDate(esc.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Milestones:</span>
                    <p className="text-slate-300">{esc.milestones?.length || 0}</p>
                  </div>
                </div>

                {esc.depositWalletAddr && (
                  <div className="p-2 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <span className="text-xs text-blue-400">Deposit Wallet: </span>
                    <span className="text-xs text-slate-300 font-mono">{esc.depositWalletAddr}</span>
                    {esc.depositConfirmed ? (
                      <Badge color="green">Confirmed</Badge>
                    ) : (
                      <Badge color="yellow">Awaiting</Badge>
                    )}
                  </div>
                )}

                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 block mb-1">Admin Notes (optional)</label>
                    <input
                      type="text"
                      value={approvalNotes[esc.id] || ""}
                      onChange={(e) => setApprovalNotes((prev) => ({ ...prev, [esc.id]: e.target.value }))}
                      placeholder="Add notes for this approval..."
                      className="w-full px-3 py-2 rounded-lg bg-[#080c14] border border-white/10 text-white text-xs placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none"
                    />
                  </div>
                  <Btn
                    variant="primary"
                    size="sm"
                    disabled={actionLoading === esc.id}
                    onClick={() => handleApprove(esc.id)}
                  >
                    {actionLoading === esc.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve & Release
                      </>
                    )}
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Deposits Tab ───────────────────────────────────────────────────────────

function DepositsTab() {
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchDeposits = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api(`/admin/deposits?page=${page}&limit=20`);
      setDeposits(data.deposits || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: any) {
      console.error("Failed to fetch deposits:", err.message);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">All Deposit Transactions</h3>
          <Btn variant="ghost" size="sm" onClick={fetchDeposits}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Btn>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : deposits.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">No deposit transactions found</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase">Type</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase">Escrow</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase">From</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase">To</th>
                    <th className="px-4 py-2.5 text-right text-xs text-slate-500 uppercase">Amount</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase">Token</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs text-slate-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {deposits.map((tx) => {
                    const statusColor = tx.status === "CONFIRMED" ? "green" : tx.status === "PENDING" || tx.status === "AWAITING_DEPOSIT" ? "yellow" : "gray";
                    return (
                      <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                        <td className="px-4 py-3">
                          <Badge color={tx.type === "DEPOSIT_WALLET" ? "blue" : "green"}>{tx.type}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-white font-medium">{tx.escrow?.title || "—"}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{tx.escrowId?.slice(0, 12)}...</div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-300">{shortAddr(tx.fromAddress)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-300">{shortAddr(tx.toAddress)}</td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400">{tx.amount}</td>
                        <td className="px-4 py-3 text-xs text-slate-300">{tx.escrow?.token?.symbol || "—"}</td>
                        <td className="px-4 py-3"><Badge color={statusColor}>{tx.status}</Badge></td>
                        <td className="px-4 py-3 text-xs text-slate-400">{formatDate(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <Btn variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </Btn>
                <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
                <Btn variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Btn>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Layout ──────────────────────────────────────────────────

function Dashboard({ user, onLogout }: { user: any; onLogout: () => void }) {
  const [tab, setTab] = useState<TabId>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const renderTab = () => {
    switch (tab) {
      case "overview": return <OverviewTab />;
      case "escrows": return <EscrowsTab />;
      case "users": return <UsersTab />;
      case "tokens": return <TokensTab />;
      case "config": return <ConfigTab />;
      case "audit": return <AuditLogTab />;
      case "approvals": return <ApprovalsTab />;
      case "deposits": return <DepositsTab />;
      default: return <OverviewTab />;
    }
  };

  return (
    <div className="min-h-screen bg-[#080c14] flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-16"} flex-shrink-0 border-r border-white/5 bg-[#0a0f1a] flex flex-col transition-all duration-200`}>
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && <span className="text-sm font-bold text-white truncate">Surveydeal Admin</span>}
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-gradient-to-r from-emerald-500/10 to-blue-500/10 text-white border border-emerald-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
                title={t.label}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-emerald-400" : ""}`} />
                {sidebarOpen && <span>{t.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/5">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all"
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-[#0a0f1a]/50 backdrop-blur-sm flex-shrink-0">
          <h1 className="text-sm font-semibold text-white capitalize">
            {TABS.find((t) => t.id === tab)?.label || "Dashboard"}
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-slate-400">{user?.email || user?.name || "Admin"}</p>
              <p className="text-[10px] text-slate-600">{user?.role || "administrator"}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              {(user?.email || user?.name || "A").charAt(0).toUpperCase()}
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}

// ─── Root Page Component ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const stored = localStorage.getItem("admin_user");
    if (token && stored) {
      try {
        setUser(JSON.parse(stored));
        setAuthed(true);
      } catch {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
      }
    }
    setChecking(false);
  }, []);

  function handleLogin(token: string, user: any) {
    setUser(user);
    setAuthed(true);
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    setUser(null);
    setAuthed(false);
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}
