"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  formatUnits,
  type Address,
  zeroAddress,
  erc20Abi,
  parseUnits,
} from "viem";
import {
  Shield,
  ArrowLeft,
  Check,
  Loader2,
  Copy,
  AlertCircle,
  Clock,
  PackageCheck,
  Wallet,
  Gavel,
  ShieldCheck,
  RotateCcw,
  ChevronRight,
  ExternalLink,
  Send,
  XCircle,
  CheckCircle2,
  Lock,
  Users,
  Ban,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT as Address;

const ESCROW_ABI = [
  { name: "getEscrow", type: "function", stateMutability: "view", inputs: [{ name: "escrowId", type: "uint256" }], outputs: [{ name: "", type: "tuple", components: [{ name: "id", type: "uint256" }, { name: "buyer", type: "address" }, { name: "seller", type: "address" }, { name: "arbiter", type: "address" }, { name: "token", type: "address" }, { name: "totalAmount", type: "uint256" }, { name: "fundedAmount", type: "uint256" }, { name: "releasedAmount", type: "uint256" }, { name: "protocolFeeCollected", type: "uint256" }, { name: "state", type: "uint8" }, { name: "mode", type: "uint8" }, { name: "agreementHash", type: "bytes32" }, { name: "createdAt", type: "uint256" }, { name: "fundedAt", type: "uint256" }, { name: "deadline", type: "uint256" }, { name: "milestoneCount", type: "uint256" }] }] },
  { name: "getMilestones", type: "function", stateMutability: "view", inputs: [{ name: "escrowId", type: "uint256" }], outputs: [{ name: "", type: "tuple[]", components: [{ name: "description", type: "string" }, { name: "amount", type: "uint256" }, { name: "released", type: "bool" }, { name: "disputed", type: "bool" }, { name: "buyerApproved", type: "bool" }, { name: "sellerDelivered", type: "bool" }] }] },
  { name: "fundEscrow", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }], outputs: [] },
  { name: "activateEscrow", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }], outputs: [] },
  { name: "deliverMilestone", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "milestoneIndex", type: "uint256" }], outputs: [] },
  { name: "approveMilestone", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "milestoneIndex", type: "uint256" }], outputs: [] },
  { name: "releaseMilestone", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "milestoneIndex", type: "uint256" }], outputs: [] },
  { name: "releaseFunds", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }], outputs: [] },
  { name: "initiateDispute", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "milestoneIndex", type: "uint256" }], outputs: [] },
  { name: "resolveDisputeByConsensus", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }, { name: "milestoneIndex", type: "uint256" }, { name: "buyerBasisPoints", type: "uint256" }], outputs: [] },
  { name: "claimRefund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }], outputs: [] },
  { name: "sellerInitiatedRefund", type: "function", stateMutability: "nonpayable", inputs: [{ name: "escrowId", type: "uint256" }], outputs: [] },
  { name: "calculateProtocolFee", type: "function", stateMutability: "view", inputs: [{ name: "amount", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const STATE_LABELS = ["Created", "Funded", "Active", "Completed", "Disputed", "Refunded"];
const STATE_COLORS: Record<number, string> = {
  0: "bg-slate-500/20 text-slate-300",
  1: "bg-blue-500/20 text-blue-300",
  2: "bg-emerald-500/20 text-emerald-300",
  3: "bg-green-500/20 text-green-300",
  4: "bg-red-500/20 text-red-300",
  5: "bg-amber-500/20 text-amber-300",
};

const LIFECYCLE_STEPS = [
  { state: 0, label: "Created", icon: Clock },
  { state: 1, label: "Funded", icon: Wallet },
  { state: 2, label: "Active", icon: PackageCheck },
  { state: 3, label: "Completed", icon: ShieldCheck },
];

type EscrowData = {
  id: bigint; buyer: Address; seller: Address; arbiter: Address; token: Address;
  totalAmount: bigint; fundedAmount: bigint; releasedAmount: bigint; protocolFeeCollected: bigint;
  state: number; mode: number; agreementHash: `0x${string}`;
  createdAt: bigint; fundedAt: bigint; deadline: bigint; milestoneCount: bigint;
};

type MilestoneData = {
  description: string; amount: bigint; released: boolean;
  disputed: boolean; buyerApproved: boolean; sellerDelivered: boolean;
};

export default function EscrowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const escrowId = BigInt(params.id as string);
  const { address, isConnected } = useAccount();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [actionMsg, setActionMsg] = useState("");
  const [error, setError] = useState("");
  const [disputeIdx, setDisputeIdx] = useState<number | null>(null);
  const [splitBps, setSplitBps] = useState(5000);
  const [copied, setCopied] = useState(false);

  const [depositTxInput, setDepositTxInput] = useState("");
  const [depositChainId, setDepositChainId] = useState(31337);
  const [depositVerifying, setDepositVerifying] = useState(false);
  const [depositResult, setDepositResult] = useState<{ success: boolean; status: string; message: string } | null>(null);
  const [dbEscrow, setDbEscrow] = useState<{ id: string; state: string; depositConfirmed: boolean; fundedAmount: string | null; fundingMethod: string | null; depositWalletAddr: string | null } | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [forceConfirming, setForceConfirming] = useState(false);
  const [loadTimeout, setLoadTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoadTimeout(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const { data: escrow, refetch: refetchEscrow } = useReadContract({
    address: CONTRACT, abi: ESCROW_ABI, functionName: "getEscrow", args: [escrowId],
  });

  const { data: milestones, refetch: refetchMilestones } = useReadContract({
    address: CONTRACT, abi: ESCROW_ABI, functionName: "getMilestones", args: [escrowId],
  });

  const { writeContract } = useWriteContract();
  const { isLoading: isTxPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  useEffect(() => {
    if (txSuccess) {
      refetchEscrow();
      refetchMilestones();
      setTxHash(undefined);
      setActionMsg("");
    }
  }, [txSuccess, refetchEscrow, refetchMilestones]);

  const e = escrow as EscrowData | undefined;
  const ms = (milestones || []) as MilestoneData[];
  const decimals = 18;

  const isBuyer = address && e && address.toLowerCase() === e.buyer.toLowerCase();
  const isSeller = address && e && address.toLowerCase() === e.seller.toLowerCase();
  const isArbiter = address && e && e.arbiter !== zeroAddress && address.toLowerCase() === e.arbiter.toLowerCase();

  const releasedCount = ms.filter((m) => m.released).length;
  const deadlineDate = e ? new Date(Number(e.deadline) * 1000) : null;
  const isDeadlineExpired = deadlineDate ? deadlineDate < new Date() : false;

  function doAction(fn: string, args: readonly unknown[], msg: string) {
    setError("");
    setActionMsg(msg);
    writeContract(
      { address: CONTRACT, abi: ESCROW_ABI, functionName: fn as any, args: args as any },
      {
        onSuccess(hash) { setTxHash(hash); },
        onError(err) { setError(err.message.split("\n")[0]); setActionMsg(""); },
      }
    );
  }

  function handleFund() {
    if (!e) return;
    setError("");
    setActionMsg("Approving token...");
    writeContract(
      { address: e.token, abi: erc20Abi, functionName: "approve", args: [CONTRACT, e.totalAmount] },
      {
        onSuccess() {
          setTimeout(() => {
            setActionMsg("Funding escrow...");
            doAction("fundEscrow", [escrowId], "Funding escrow...");
          }, 2000);
        },
        onError(err) { setError(err.message.split("\n")[0]); setActionMsg(""); },
      }
    );
  }

  function copyAddress(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fetchDbEscrow = useCallback(async () => {
    const jwt = localStorage.getItem("surveydeal_jwt");
    if (!jwt) return;
    setDbLoading(true);
    try {
      const allRes = await fetch(`${API}/escrows?page=1&limit=50`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (!allRes.ok) return;
      const allData = await allRes.json();
      const match = (allData.escrows || []).find(
        (esc: { onChainId: number }) => esc.onChainId === Number(params.id)
      );
      if (match) {
        setDbEscrow({
          id: match.id,
          state: match.state,
          depositConfirmed: match.depositConfirmed || false,
          fundedAmount: match.fundedAmount,
          fundingMethod: match.fundingMethod,
          depositWalletAddr: match.depositWalletAddr,
        });
      }
    } catch {} finally {
      setDbLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchDbEscrow();
    const interval = setInterval(fetchDbEscrow, 10000);
    return () => clearInterval(interval);
  }, [fetchDbEscrow]);

  async function verifyDeposit() {
    const jwt = localStorage.getItem("surveydeal_jwt");
    if (!jwt || !depositTxInput) return;

    const allRes = await fetch(`${API}/escrows?page=1&limit=50`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!allRes.ok) return;
    const allData = await allRes.json();
    const match = (allData.escrows || []).find(
      (esc: { onChainId: number }) => esc.onChainId === Number(params.id)
    );
    if (!match) {
      setDepositResult({ success: false, status: "NOT_FOUND", message: "Escrow not found in database" });
      return;
    }

    setDepositVerifying(true);
    setDepositResult(null);
    setError("");

    try {
      const res = await fetch(`${API}/escrows/${match.id}/verify-deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          txHash: depositTxInput.trim(),
          chainId: depositChainId,
        }),
      });

      const data = await res.json();

      setDepositResult({
        success: data.success || false,
        status: data.status || "FAILED",
        message: data.message || data.error || "Unknown error",
      });

      if (data.success) {
        fetchDbEscrow();
        refetchEscrow();
      }
    } catch (err: any) {
      setDepositResult({
        success: false,
        status: "ERROR",
        message: err.message || "Network error",
      });
    } finally {
      setDepositVerifying(false);
    }
  }

  const dbStateNum = dbEscrow ? ({ CREATED: 0, FUNDED: 1, ACTIVE: 2, COMPLETED: 3, DISPUTED: 4, REFUNDED: 5 }[dbEscrow.state] ?? -1) : -1;
  const displayState = e ? e.state : dbStateNum;
  const hasData = !!e || !!dbEscrow;

  if (!hasData) {
    if (!loadTimeout) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Escrow #{params.id as string}</h2>
          <p className="text-slate-400 text-sm mb-6">
            Sign in from the Dashboard to view escrow details and verify deposits.
          </p>
          <a href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity">
            <Wallet className="w-5 h-5" /> Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#080c14]/80 border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Survey<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">deal</span></span>
          </a>
          <ConnectButton />
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back + Header */}
        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors text-sm mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        {!isConnected && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-amber-400" />
              <div>
                <p className="text-sm font-medium text-white">Connect Your Wallet</p>
                <p className="text-xs text-slate-400">Connect to interact with this escrow (fund, approve, dispute).</p>
              </div>
            </div>
            <ConnectButton />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <h1 className="text-2xl font-bold text-white">Escrow #{params.id as string}</h1>
          {displayState >= 0 && (
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${STATE_COLORS[displayState] || "bg-slate-500/20 text-slate-300"}`}>
              {STATE_LABELS[displayState] || dbEscrow?.state || "Unknown"}
            </span>
          )}
          {e && (
            <span className={`px-2.5 py-0.5 rounded text-xs ${e.mode === 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
              {e.mode === 0 ? "Locked" : "Arbiter"}
            </span>
          )}
          {isBuyer && <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-400">Buyer</span>}
          {isSeller && <span className="px-2 py-0.5 rounded text-xs bg-orange-500/10 text-orange-400">Seller</span>}
          {isArbiter && <span className="px-2 py-0.5 rounded text-xs bg-pink-500/10 text-pink-400">Arbiter</span>}
        </div>

        {/* Lifecycle Progress */}
        <div className="flex items-center gap-1 mb-8 p-4 rounded-xl border border-white/5 bg-white/[0.02]">
          {LIFECYCLE_STEPS.map((ls, i) => {
            const Icon = ls.icon;
            const st = displayState >= 0 ? displayState : 0;
            const active = st >= ls.state && st < 5;
            const current = st === ls.state;
            return (
              <div key={i} className="flex items-center flex-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${active ? current ? "bg-gradient-to-br from-emerald-500 to-teal-500" : "bg-emerald-500/20" : "bg-white/5"}`}>
                  {active && !current ? <Check className="w-4 h-4 text-emerald-400" /> : <Icon className={`w-4 h-4 ${active ? "text-white" : "text-slate-600"}`} />}
                </div>
                <span className={`ml-2 text-xs hidden sm:block ${active ? "text-slate-200" : "text-slate-600"}`}>{ls.label}</span>
                {i < LIFECYCLE_STEPS.length - 1 && <div className={`flex-1 h-px mx-2 ${st > ls.state ? "bg-emerald-500" : "bg-white/10"}`} />}
              </div>
            );
          })}
        </div>

        {/* Status Messages */}
        {(isTxPending || actionMsg) && (
          <div className="mb-6 p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 text-blue-300 text-sm flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {actionMsg || "Transaction pending..."}
          </div>
        )}
        {error && (
          <div className="mb-6 p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {txSuccess && (
          <div className="mb-6 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" /> Transaction confirmed!
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">

            {/* Deposit Section (Created state, buyer only) */}
            {e && e.state === 0 && isBuyer && (
              <div className="p-6 rounded-xl border border-blue-500/20 bg-blue-500/5">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-blue-400" /> Deposit Funds
                </h2>
                <p className="text-sm text-slate-400 mb-4">
                  Send <span className="text-white font-medium">{formatUnits(e.totalAmount, decimals)}</span> tokens to fund this escrow.
                </p>
                <div className="p-4 rounded-lg bg-white/[0.03] border border-white/10 mb-4">
                  <label className="text-xs text-slate-500 mb-1 block">Escrow Contract Address</label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-emerald-400 font-mono flex-1 break-all">{CONTRACT}</code>
                    <button onClick={() => copyAddress(CONTRACT)} className="p-1.5 rounded hover:bg-white/5 transition-colors">
                      {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-500" />}
                    </button>
                  </div>
                </div>
                <button onClick={handleFund} disabled={isTxPending} className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                  {isTxPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <><Send className="w-5 h-5" /> Approve & Fund Escrow</>}
                </button>
              </div>
            )}

            {/* Activate Section (Funded state, seller only) */}
            {e && e.state === 1 && isSeller && (
              <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> Activate Escrow
                </h2>
                <p className="text-sm text-slate-400 mb-4">The buyer has funded this escrow. Confirm to activate and start the deal.</p>
                <button onClick={() => doAction("activateEscrow", [escrowId], "Activating...")} disabled={isTxPending} className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                  Activate Escrow
                </button>
              </div>
            )}

            {/* Seller: Escrow Funded Notification */}
            {isSeller && ((e && e.state === 1) || (dbEscrow && dbEscrow.state === "FUNDED")) && (
              <div className="p-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Escrow Funded
                </h2>
                <p className="text-sm text-slate-400 mb-2">
                  The buyer has deposited funds into this escrow.
                  {dbEscrow?.fundingMethod === "DEPOSIT_TRANSFER" && " Funds were received via direct transfer to a deposit wallet."}
                </p>
                {dbEscrow?.fundedAmount && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 mb-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Funded Amount</span>
                      <span className="text-emerald-400 font-mono font-medium">
                        {dbEscrow.fundedAmount}
                      </span>
                    </div>
                    {dbEscrow.depositConfirmed && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-slate-500">Deposit Status</span>
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmed On-Chain
                        </span>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  You can now activate the escrow to begin work. Click &quot;Activate Escrow&quot; above to proceed.
                </p>
              </div>
            )}

            {/* Deposit Verification — visible when escrow is not yet confirmed */}
            {(isBuyer || (!e && dbEscrow)) && ((e && e.state === 0) || (dbEscrow && dbEscrow.state === "CREATED")) && !dbEscrow?.depositConfirmed && (
              <div className="p-6 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" /> Verify Your Deposit
                </h2>
                <p className="text-sm text-slate-400 mb-4">
                  Already sent funds? Submit your transaction hash below to verify the transfer on-chain and confirm the deposit.
                </p>

                {dbEscrow?.depositWalletAddr && (
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/10 mb-4">
                    <label className="text-xs text-slate-500 block mb-1">Deposit Wallet Address</label>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-emerald-400 font-mono flex-1 break-all">{dbEscrow.depositWalletAddr}</code>
                      <button onClick={() => copyAddress(dbEscrow.depositWalletAddr!)} className="p-1 rounded hover:bg-white/5">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Transaction Hash</label>
                    <input
                      type="text"
                      value={depositTxInput}
                      onChange={(ev) => setDepositTxInput(ev.target.value)}
                      placeholder="0x..."
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Network / Chain</label>
                    <select
                      value={depositChainId}
                      onChange={(ev) => setDepositChainId(Number(ev.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-sm text-slate-300 focus:border-emerald-500/50 focus:outline-none"
                    >
                      <option value={31337}>Local Hardhat (31337)</option>
                      <option value={56}>BNB Chain (56)</option>
                      <option value={1}>Ethereum (1)</option>
                      <option value={42161}>Arbitrum (42161)</option>
                      <option value={8453}>Base (8453)</option>
                      <option value={137}>Polygon (137)</option>
                      <option value={10}>Optimism (10)</option>
                    </select>
                  </div>

                  <button
                    onClick={verifyDeposit}
                    disabled={depositVerifying || !depositTxInput.trim()}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {depositVerifying ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Verifying on-chain...</>
                    ) : (
                      <><Send className="w-4 h-4" /> Verify Deposit</>
                    )}
                  </button>

                  {dbEscrow?.id && (
                    <button
                      onClick={async () => {
                        const jwt = localStorage.getItem("surveydeal_jwt");
                        if (!jwt || !dbEscrow?.id) return;
                        setForceConfirming(true);
                        setDepositResult(null);
                        try {
                          const res = await fetch(`${API}/escrows/${dbEscrow.id}/force-confirm-deposit`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
                            body: JSON.stringify({ txHash: depositTxInput.trim() || `manual-confirm-${Date.now()}` }),
                          });
                          const data = await res.json();
                          setDepositResult({
                            success: data.success || false,
                            status: data.success ? "CONFIRMED" : "FAILED",
                            message: data.message || data.error || "Unknown result",
                          });
                          if (data.success) { fetchDbEscrow(); refetchEscrow(); }
                        } catch (err: any) {
                          setDepositResult({ success: false, status: "ERROR", message: err.message });
                        } finally {
                          setForceConfirming(false);
                        }
                      }}
                      disabled={forceConfirming}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {forceConfirming ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Confirming...</>
                      ) : (
                        <><ShieldCheck className="w-4 h-4" /> Force Confirm Deposit (Dev)</>
                      )}
                    </button>
                  )}
                </div>

                {depositResult && (
                  <div className={`mt-4 p-3 rounded-lg border text-sm flex items-start gap-2 ${
                    depositResult.success
                      ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                      : depositResult.status === "PENDING"
                        ? "border-blue-500/20 bg-blue-500/5 text-blue-300"
                        : "border-red-500/20 bg-red-500/5 text-red-400"
                  }`}>
                    {depositResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : depositResult.status === "PENDING" ? (
                      <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{depositResult.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* Buyer: Deposit Confirmed Banner */}
            {(isBuyer || (!e && dbEscrow)) && dbEscrow?.depositConfirmed && (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">Deposit Confirmed</p>
                  <p className="text-xs text-slate-400">Your deposit has been verified and the escrow is now funded. Waiting for the seller to activate.</p>
                </div>
              </div>
            )}

            {/* Milestones */}
            {ms.length > 0 && (<div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Milestones</h2>
                <span className="text-xs text-slate-500">{releasedCount}/{ms.length} released</span>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 mb-4 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${ms.length > 0 ? (releasedCount / ms.length) * 100 : 0}%` }} />
              </div>

              <div className="space-y-3">
                {ms.map((m, i) => {
                  const status = m.released ? "Released" : m.disputed ? "Disputed" : m.buyerApproved ? "Approved" : m.sellerDelivered ? "Delivered" : "Pending";
                  const statusColor = m.released ? "text-green-400 bg-green-500/10" : m.disputed ? "text-red-400 bg-red-500/10" : m.buyerApproved ? "text-blue-400 bg-blue-500/10" : m.sellerDelivered ? "text-amber-400 bg-amber-500/10" : "text-slate-400 bg-white/5";

                  return (
                    <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">M{i + 1}</span>
                          <span className="text-sm text-white">{m.description}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{status}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">{formatUnits(m.amount, decimals)} tokens</span>
                        <div className="flex gap-2">
                          {/* Seller: Mark Delivered */}
                          {isSeller && e && e.state === 2 && !m.sellerDelivered && !m.released && !m.disputed && (
                            <button onClick={() => doAction("deliverMilestone", [escrowId, BigInt(i)], `Delivering M${i + 1}...`)} disabled={isTxPending} className="px-3 py-1.5 rounded-lg text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                              Mark Delivered
                            </button>
                          )}
                          {/* Buyer: Approve */}
                          {isBuyer && e && e.state === 2 && m.sellerDelivered && !m.buyerApproved && !m.released && !m.disputed && (
                            <button onClick={() => doAction("approveMilestone", [escrowId, BigInt(i)], `Approving M${i + 1}...`)} disabled={isTxPending} className="px-3 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                              Approve
                            </button>
                          )}
                          {/* Buyer: Release */}
                          {isBuyer && e && e.state === 2 && m.buyerApproved && !m.released && !m.disputed && (
                            <button onClick={() => doAction("releaseMilestone", [escrowId, BigInt(i)], `Releasing M${i + 1}...`)} disabled={isTxPending} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                              Release Funds
                            </button>
                          )}
                          {/* Dispute */}
                          {(isBuyer || isSeller) && e && (e.state === 2 || e.state === 4) && !m.released && !m.disputed && (
                            <button onClick={() => setDisputeIdx(i)} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                              Dispute
                            </button>
                          )}
                          {/* Resolve Dispute */}
                          {m.disputed && !m.released && (isBuyer || isSeller || isArbiter) && (
                            <button onClick={() => setDisputeIdx(i)} className="px-3 py-1.5 rounded-lg text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors">
                              Resolve
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>)}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Escrow Details Card */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white mb-4">Escrow Details</h3>
              <div className="space-y-3 text-sm">
                {e ? (
                  <>
                    <Detail label="Total Amount" value={formatUnits(e.totalAmount, decimals)} />
                    <Detail label="Funded" value={formatUnits(e.fundedAmount, decimals)} />
                    <Detail label="Released" value={formatUnits(e.releasedAmount, decimals)} />
                    <Detail label="Fees Collected" value={formatUnits(e.protocolFeeCollected, decimals)} />
                    <div className="border-t border-white/5 pt-3">
                      <Detail label="Buyer" value={`${e.buyer.slice(0, 6)}...${e.buyer.slice(-4)}`} />
                      <Detail label="Seller" value={`${e.seller.slice(0, 6)}...${e.seller.slice(-4)}`} />
                      {e.arbiter !== zeroAddress && <Detail label="Arbiter" value={`${e.arbiter.slice(0, 6)}...${e.arbiter.slice(-4)}`} />}
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <Detail label="Created" value={new Date(Number(e.createdAt) * 1000).toLocaleDateString()} />
                      {e.fundedAt > BigInt(0) && <Detail label="Funded" value={new Date(Number(e.fundedAt) * 1000).toLocaleDateString()} />}
                      <Detail label="Deadline" value={deadlineDate?.toLocaleDateString() || "N/A"} />
                      {isDeadlineExpired && <span className="text-xs text-red-400">⚠ Deadline expired</span>}
                    </div>
                    <Detail label="Token" value={`${e.token.slice(0, 6)}...${e.token.slice(-4)}`} />
                  </>
                ) : (
                  <Detail label="Status" value={dbEscrow?.state || "Loading..."} />
                )}
                {dbEscrow && (
                  <div className="border-t border-white/5 pt-3 space-y-1">
                    <Detail label="Funding" value={dbEscrow.fundingMethod === "DEPOSIT_TRANSFER" ? "Deposit Transfer" : dbEscrow.fundingMethod === "WALLET_DIRECT" ? "Wallet Direct" : "Pending"} />
                    <Detail label="Deposit" value={dbEscrow.depositConfirmed ? "Confirmed" : "Awaiting"} />
                    {dbEscrow.depositWalletAddr && (
                      <Detail label="Deposit Addr" value={`${dbEscrow.depositWalletAddr.slice(0, 6)}...${dbEscrow.depositWalletAddr.slice(-4)}`} />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
              <div className="space-y-2">
                {/* Release All (buyer, active) */}
                {isBuyer && e && e.state === 2 && (
                  <button onClick={() => doAction("releaseFunds", [escrowId], "Releasing all...")} disabled={isTxPending} className="w-full py-2 px-3 rounded-lg text-sm bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 text-left flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Release All Remaining
                  </button>
                )}
                {/* Claim Refund (buyer, deadline expired) */}
                {isBuyer && e && (e.state === 1 || (e.state === 2 && isDeadlineExpired)) && (
                  <button onClick={() => doAction("claimRefund", [escrowId], "Claiming refund...")} disabled={isTxPending} className="w-full py-2 px-3 rounded-lg text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50 text-left flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Claim Refund
                  </button>
                )}
                {/* Seller Refund (seller, active) */}
                {isSeller && e && e.state === 2 && (
                  <button onClick={() => doAction("sellerInitiatedRefund", [escrowId], "Initiating refund...")} disabled={isTxPending} className="w-full py-2 px-3 rounded-lg text-sm bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors disabled:opacity-50 text-left flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" /> Initiate Refund
                  </button>
                )}
              </div>
            </div>

            {/* Withdrawal Info (for seller when funds released) */}
            {isSeller && e && e.releasedAmount > BigInt(0) && (
              <div className="p-5 rounded-xl border border-green-500/20 bg-green-500/5">
                <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" /> Funds Released to You
                </h3>
                <p className="text-2xl font-bold text-green-400 mb-1">
                  {formatUnits(e.releasedAmount, decimals)}
                </p>
                <p className="text-xs text-slate-500">
                  Released funds are sent directly to your wallet ({e.seller.slice(0, 6)}...{e.seller.slice(-4)}) by the smart contract.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Dispute Dialog */}
      {disputeIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-[#0d1117] border border-white/10">
            {ms[disputeIdx]?.disputed ? (
              <>
                <h3 className="text-lg font-bold text-white mb-4">Resolve Dispute — M{disputeIdx + 1}</h3>
                <p className="text-sm text-slate-400 mb-4">Set the buyer/seller split for this milestone.</p>
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-slate-400 mb-2">
                    <span>Buyer: {splitBps / 100}%</span>
                    <span>Seller: {(10000 - splitBps) / 100}%</span>
                  </div>
                  <input type="range" min={0} max={10000} step={100} value={splitBps} onChange={(e) => setSplitBps(Number(e.target.value))} className="w-full accent-emerald-500" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setDisputeIdx(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors text-sm">Cancel</button>
                  <button onClick={() => { doAction("resolveDisputeByConsensus", [escrowId, BigInt(disputeIdx), BigInt(splitBps)], "Resolving..."); setDisputeIdx(null); }} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm hover:opacity-90 transition-opacity">
                    Resolve
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white mb-3">Initiate Dispute — M{disputeIdx + 1}</h3>
                <p className="text-sm text-slate-400 mb-6">Are you sure you want to dispute milestone {disputeIdx + 1}? This will pause fund release for this milestone until resolved.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDisputeIdx(null)} className="flex-1 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors text-sm">Cancel</button>
                  <button onClick={() => { doAction("initiateDispute", [escrowId, BigInt(disputeIdx)], "Disputing..."); setDisputeIdx(null); }} className="flex-1 py-2 rounded-lg bg-red-500 text-white font-medium text-sm hover:opacity-90 transition-opacity">
                    Confirm Dispute
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-300 font-mono text-xs">{value}</span>
    </div>
  );
}
