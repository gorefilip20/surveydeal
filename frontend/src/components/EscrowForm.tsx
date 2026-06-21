"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  useAccount,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
  useBalance,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  parseUnits,
  keccak256,
  toBytes,
  formatUnits,
  type Address,
  zeroAddress,
} from "viem";
import { erc20Abi } from "viem";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Gavel,
  Loader2,
  PackageCheck,
  Plus,
  RotateCcw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// ──────────────────────────────────────────────────────────
//  CONTRACT CONFIG
// ──────────────────────────────────────────────────────────

const ESCROW_CONTRACT_ADDRESS = process.env
  .NEXT_PUBLIC_ESCROW_CONTRACT as Address;

const ESCROW_ABI = [
  {
    name: "createEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_seller", type: "address" },
      { name: "_token", type: "address" },
      { name: "_totalAmount", type: "uint256" },
      { name: "_mode", type: "uint8" },
      { name: "_arbiter", type: "address" },
      { name: "_agreementHash", type: "bytes32" },
      { name: "_deadline", type: "uint256" },
      { name: "_milestoneDescriptions", type: "string[]" },
      { name: "_milestoneAmounts", type: "uint256[]" },
    ],
    outputs: [{ name: "escrowId", type: "uint256" }],
  },
  {
    name: "fundEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "activateEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "deliverMilestone",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "approveMilestone",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "releaseMilestone",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "initiateDispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "resolveDisputeByConsensus",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
      { name: "buyerBasisPoints", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "resolveDisputeByArbiter",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
      { name: "buyerBasisPoints", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "releaseFunds",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "sellerInitiatedRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getEscrow",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "arbiter", type: "address" },
          { name: "token", type: "address" },
          { name: "totalAmount", type: "uint256" },
          { name: "fundedAmount", type: "uint256" },
          { name: "releasedAmount", type: "uint256" },
          { name: "protocolFeeCollected", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "mode", type: "uint8" },
          { name: "agreementHash", type: "bytes32" },
          { name: "createdAt", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "milestoneCount", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getMilestones",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "description", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "released", type: "bool" },
          { name: "disputed", type: "bool" },
          { name: "buyerApproved", type: "bool" },
          { name: "sellerDelivered", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "calculateProtocolFee",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ──────────────────────────────────────────────────────────
//  TYPE DEFINITIONS
// ──────────────────────────────────────────────────────────

interface TokenInfo {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  status: "ACTIVE" | "FEATURED";
  isReflective: boolean;
  hasTax: boolean;
}

interface MilestoneInput {
  id: string;
  description: string;
  amount: string;
}

interface EscrowData {
  id: bigint;
  buyer: Address;
  seller: Address;
  arbiter: Address;
  token: Address;
  totalAmount: bigint;
  fundedAmount: bigint;
  releasedAmount: bigint;
  protocolFeeCollected: bigint;
  state: number;
  mode: number;
  agreementHash: `0x${string}`;
  createdAt: bigint;
  fundedAt: bigint;
  deadline: bigint;
  milestoneCount: bigint;
}

interface MilestoneData {
  description: string;
  amount: bigint;
  released: boolean;
  disputed: boolean;
  buyerApproved: boolean;
  sellerDelivered: boolean;
}

// ──────────────────────────────────────────────────────────
//  CONSTANTS
// ──────────────────────────────────────────────────────────

const STATE_MAP: Record<
  number,
  { label: string; color: string; icon: React.ReactNode }
> = {
  0: {
    label: "Created",
    color: "bg-slate-500",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  1: {
    label: "Funded",
    color: "bg-blue-500",
    icon: <Wallet className="h-3.5 w-3.5" />,
  },
  2: {
    label: "Active",
    color: "bg-green-500",
    icon: <ArrowRightLeft className="h-3.5 w-3.5" />,
  },
  3: {
    label: "Completed",
    color: "bg-emerald-600",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  4: {
    label: "Disputed",
    color: "bg-red-500",
    icon: <ShieldAlert className="h-3.5 w-3.5" />,
  },
  5: {
    label: "Refunded",
    color: "bg-amber-500",
    icon: <RotateCcw className="h-3.5 w-3.5" />,
  },
};

const LISTED_TOKENS: TokenInfo[] = [
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    logoUrl: "/tokens/usdt.png",
    status: "FEATURED",
    isReflective: false,
    hasTax: false,
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    logoUrl: "/tokens/usdc.png",
    status: "FEATURED",
    isReflective: false,
    hasTax: false,
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    name: "Dai Stablecoin",
    decimals: 18,
    logoUrl: "/tokens/dai.png",
    status: "ACTIVE",
    isReflective: false,
    hasTax: false,
  },
  {
    address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    symbol: "SHIB",
    name: "Shiba Inu",
    decimals: 18,
    logoUrl: "/tokens/shib.png",
    status: "FEATURED",
    isReflective: false,
    hasTax: false,
  },
  {
    address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    symbol: "PEPE",
    name: "Pepe",
    decimals: 18,
    logoUrl: "/tokens/pepe.png",
    status: "FEATURED",
    isReflective: false,
    hasTax: false,
  },
  {
    address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
    symbol: "HEX",
    name: "HEX",
    decimals: 8,
    logoUrl: "/tokens/hex.png",
    status: "ACTIVE",
    isReflective: false,
    hasTax: false,
  },
  {
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    symbol: "UNI",
    name: "Uniswap",
    decimals: 18,
    logoUrl: "/tokens/uni.png",
    status: "FEATURED",
    isReflective: false,
    hasTax: false,
  },
  {
    address: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b" as Address,
    symbol: "SAFEMOON",
    name: "SafeMoon V2",
    decimals: 9,
    logoUrl: "/tokens/safemoon.png",
    status: "ACTIVE",
    isReflective: true,
    hasTax: true,
  },
  {
    address: "0xaB1a4d4f1D0e5E3b8c9F2A7b6C5d4E3F2a1B0c9d" as Address,
    symbol: "REFI",
    name: "ReflectFinance",
    decimals: 9,
    logoUrl: "/tokens/refi.png",
    status: "ACTIVE",
    isReflective: true,
    hasTax: true,
  },
];

function generateMilestoneId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ──────────────────────────────────────────────────────────
//  HELPER COMPONENTS
// ──────────────────────────────────────────────────────────

function TokenBadges({ token }: { token: TokenInfo }) {
  return (
    <div className="flex items-center gap-1">
      {token.status === "FEATURED" && (
        <Badge className="bg-amber-600/20 text-amber-400 text-[10px] leading-none px-1.5 py-0.5 font-medium">
          FEATURED
        </Badge>
      )}
      {token.hasTax && (
        <Badge className="bg-orange-600/20 text-orange-400 text-[10px] leading-none px-1.5 py-0.5 font-medium">
          TAX-TOKEN
        </Badge>
      )}
      {token.isReflective && (
        <Badge className="bg-purple-600/20 text-purple-400 text-[10px] leading-none px-1.5 py-0.5 font-medium">
          REFLECT
        </Badge>
      )}
    </div>
  );
}

function MilestoneProgressBar({
  milestones,
}: {
  milestones: MilestoneData[];
}) {
  const total = milestones.length;
  const released = milestones.filter((m) => m.released).length;
  const disputed = milestones.filter((m) => m.disputed && !m.released).length;
  const delivered = milestones.filter(
    (m) => m.sellerDelivered && !m.released && !m.disputed
  ).length;
  const pending = total - released - disputed - delivered;
  const pct = total > 0 ? (released / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Progress: {released}/{total} milestones released
        </span>
        <span>{pct.toFixed(0)}%</span>
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
        {released > 0 && (
          <div
            className="bg-emerald-500 transition-all duration-500"
            style={{ width: `${(released / total) * 100}%` }}
          />
        )}
        {delivered > 0 && (
          <div
            className="bg-blue-500 transition-all duration-500"
            style={{ width: `${(delivered / total) * 100}%` }}
          />
        )}
        {disputed > 0 && (
          <div
            className="bg-red-500 transition-all duration-500"
            style={{ width: `${(disputed / total) * 100}%` }}
          />
        )}
        {pending > 0 && (
          <div
            className="bg-slate-700 transition-all duration-500"
            style={{ width: `${(pending / total) * 100}%` }}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Released ({released})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
          Delivered ({delivered})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          Disputed ({disputed})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-700" />
          Pending ({pending})
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-800/30 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-white truncate">{value}</p>
      {sub && <p className="text-[11px] text-slate-500 truncate">{sub}</p>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
//  MAIN COMPONENT
// ──────────────────────────────────────────────────────────

export default function EscrowForm() {
  const { address, isConnected, chain } = useAccount();

  // ── Create-tab state ──
  const [activeTab, setActiveTab] = useState<"create" | "manage">("create");
  const [role, setRole] = useState<"buyer" | "seller">("buyer");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [counterpartyAddress, setCounterpartyAddress] = useState("");
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [escrowMode, setEscrowMode] = useState<"locked" | "arbiter">("locked");
  const [arbiterAddress, setArbiterAddress] = useState("");
  const [agreementText, setAgreementText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { id: generateMilestoneId(), description: "", amount: "" },
  ]);

  // ── Manage-tab state ──
  const [manageEscrowId, setManageEscrowId] = useState("");

  // ── Arbiter dialog state ──
  const [arbiterDialogOpen, setArbiterDialogOpen] = useState(false);
  const [arbiterMilestoneIdx, setArbiterMilestoneIdx] = useState<number>(0);
  const [arbiterBuyerPct, setArbiterBuyerPct] = useState<number>(50);

  // ── Feedback ──
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ── Contract writes ──
  const {
    writeContract,
    data: txHash,
    isPending: isWritePending,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isTxConfirming, isSuccess: isTxConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  // Clear success message after confirmation
  useEffect(() => {
    if (isTxConfirmed) {
      setSuccess("Transaction confirmed on-chain");
      const timer = setTimeout(() => setSuccess(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [isTxConfirmed]);

  // ── Escrow ID parsing ──
  const escrowIdBigInt = useMemo(() => {
    try {
      return manageEscrowId.trim() !== ""
        ? BigInt(manageEscrowId.trim())
        : undefined;
    } catch {
      return undefined;
    }
  }, [manageEscrowId]);

  // ── On-chain reads ──
  const { data: escrowData, refetch: refetchEscrow } = useReadContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "getEscrow",
    args: escrowIdBigInt !== undefined ? [escrowIdBigInt] : undefined,
    query: { enabled: escrowIdBigInt !== undefined },
  }) as { data: EscrowData | undefined; refetch: () => void };

  const { data: milestonesData, refetch: refetchMilestones } = useReadContract({
    address: ESCROW_CONTRACT_ADDRESS,
    abi: ESCROW_ABI,
    functionName: "getMilestones",
    args: escrowIdBigInt !== undefined ? [escrowIdBigInt] : undefined,
    query: { enabled: escrowIdBigInt !== undefined },
  }) as { data: MilestoneData[] | undefined; refetch: () => void };

  const { data: tokenAllowance } = useReadContract({
    address: selectedToken?.address,
    abi: erc20Abi,
    functionName: "allowance",
    args:
      address && ESCROW_CONTRACT_ADDRESS
        ? [address, ESCROW_CONTRACT_ADDRESS]
        : undefined,
    query: { enabled: !!address && !!selectedToken },
  });

  const { data: tokenBalanceData } = useReadContract({
    address: selectedToken?.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!selectedToken },
  });

  // Refetch on-chain data after a tx confirms
  useEffect(() => {
    if (isTxConfirmed && escrowIdBigInt !== undefined) {
      refetchEscrow();
      refetchMilestones();
    }
  }, [isTxConfirmed, escrowIdBigInt, refetchEscrow, refetchMilestones]);

  // ── Derived values ──
  const totalAmount = useMemo(() => {
    return milestones.reduce((sum, m) => {
      const val = parseFloat(m.amount);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [milestones]);

  const agreementHash = useMemo(() => {
    if (!agreementText.trim())
      return ("0x" + "0".repeat(64)) as `0x${string}`;
    return keccak256(toBytes(agreementText));
  }, [agreementText]);

  const userRole = useMemo<
    "buyer" | "seller" | "arbiter" | null
  >(() => {
    if (!escrowData || !address) return null;
    const addr = address.toLowerCase();
    if (escrowData.buyer.toLowerCase() === addr) return "buyer";
    if (escrowData.seller.toLowerCase() === addr) return "seller";
    if (
      escrowData.arbiter !== zeroAddress &&
      escrowData.arbiter.toLowerCase() === addr
    )
      return "arbiter";
    return null;
  }, [escrowData, address]);

  const isLoading = isWritePending || isTxConfirming;

  const needsApproval = useMemo(() => {
    if (!selectedToken || tokenAllowance === undefined || totalAmount <= 0)
      return false;
    const required = parseUnits(String(totalAmount), selectedToken.decimals);
    return (tokenAllowance as bigint) < required;
  }, [selectedToken, tokenAllowance, totalAmount]);

  const tokenBalance = useMemo(() => {
    if (!selectedToken || tokenBalanceData === undefined) return null;
    return formatUnits(tokenBalanceData as bigint, selectedToken.decimals);
  }, [selectedToken, tokenBalanceData]);

  const escrowTokenInfo = useMemo(() => {
    if (!escrowData) return null;
    return LISTED_TOKENS.find(
      (t) => t.address.toLowerCase() === escrowData.token.toLowerCase()
    );
  }, [escrowData]);

  // ── Milestone builder ──
  const addMilestone = useCallback(() => {
    setMilestones((prev) => [
      ...prev,
      { id: generateMilestoneId(), description: "", amount: "" },
    ]);
  }, []);

  const removeMilestone = useCallback((id: string) => {
    setMilestones((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((m) => m.id !== id);
    });
  }, []);

  const updateMilestone = useCallback(
    (id: string, field: "description" | "amount", value: string) => {
      setMilestones((prev) =>
        prev.map((m) => (m.id === id ? { ...m, [field]: value } : m))
      );
    },
    []
  );

  // ── Contract action handlers ──

  const handleApproveToken = useCallback(() => {
    if (!selectedToken) return;
    setError("");
    const amount = parseUnits(String(totalAmount), selectedToken.decimals);
    writeContract({
      address: selectedToken.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [ESCROW_CONTRACT_ADDRESS, amount],
    });
  }, [selectedToken, totalAmount, writeContract]);

  const handleCreateEscrow = useCallback(() => {
    setError("");
    setSuccess("");

    if (!selectedToken) {
      setError("Please select a payment token.");
      return;
    }
    if (!counterpartyAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Enter a valid counterparty wallet address (0x...).");
      return;
    }
    if (counterpartyAddress.toLowerCase() === address?.toLowerCase()) {
      setError("You cannot create an escrow with yourself.");
      return;
    }
    if (
      milestones.some(
        (m) =>
          !m.description.trim() || !m.amount || parseFloat(m.amount) <= 0
      )
    ) {
      setError(
        "Every milestone needs a description and a positive amount."
      );
      return;
    }
    if (
      escrowMode === "arbiter" &&
      !arbiterAddress.match(/^0x[a-fA-F0-9]{40}$/)
    ) {
      setError("Arbiter mode requires a valid arbiter wallet address.");
      return;
    }

    const totalParsed = parseUnits(
      String(totalAmount),
      selectedToken.decimals
    );
    const descs = milestones.map((m) => m.description);
    const amts = milestones.map((m) =>
      parseUnits(m.amount, selectedToken.decimals)
    );
    const deadlineTs = deadline
      ? BigInt(Math.floor(new Date(deadline).getTime() / 1000))
      : BigInt(0);
    const sellerAddr =
      role === "buyer"
        ? (counterpartyAddress as Address)
        : (address as Address);
    const arbiter =
      escrowMode === "arbiter"
        ? (arbiterAddress as Address)
        : zeroAddress;

    writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "createEscrow",
      args: [
        sellerAddr,
        selectedToken.address,
        totalParsed,
        escrowMode === "locked" ? 0 : 1,
        arbiter,
        agreementHash,
        deadlineTs,
        descs,
        amts,
      ],
    });

    setSuccess("Escrow creation submitted. Waiting for confirmation...");
  }, [
    selectedToken,
    counterpartyAddress,
    address,
    milestones,
    escrowMode,
    arbiterAddress,
    totalAmount,
    deadline,
    role,
    agreementHash,
    writeContract,
  ]);

  const handleFundEscrow = useCallback(() => {
    if (escrowIdBigInt === undefined) return;
    setError("");
    writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "fundEscrow",
      args: [escrowIdBigInt],
    });
  }, [escrowIdBigInt, writeContract]);

  const handleActivateEscrow = useCallback(() => {
    if (escrowIdBigInt === undefined) return;
    setError("");
    writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "activateEscrow",
      args: [escrowIdBigInt],
    });
  }, [escrowIdBigInt, writeContract]);

  const handleDeliverMilestone = useCallback(
    (idx: number) => {
      if (escrowIdBigInt === undefined) return;
      setError("");
      writeContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "deliverMilestone",
        args: [escrowIdBigInt, BigInt(idx)],
      });
    },
    [escrowIdBigInt, writeContract]
  );

  const handleApproveMilestone = useCallback(
    (idx: number) => {
      if (escrowIdBigInt === undefined) return;
      setError("");
      writeContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "approveMilestone",
        args: [escrowIdBigInt, BigInt(idx)],
      });
    },
    [escrowIdBigInt, writeContract]
  );

  const handleReleaseMilestone = useCallback(
    (idx: number) => {
      if (escrowIdBigInt === undefined) return;
      setError("");
      writeContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "releaseMilestone",
        args: [escrowIdBigInt, BigInt(idx)],
      });
    },
    [escrowIdBigInt, writeContract]
  );

  const handleDisputeMilestone = useCallback(
    (idx: number) => {
      if (escrowIdBigInt === undefined) return;
      setError("");
      writeContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "initiateDispute",
        args: [escrowIdBigInt, BigInt(idx)],
      });
    },
    [escrowIdBigInt, writeContract]
  );

  const openArbiterDialog = useCallback((milestoneIdx: number) => {
    setArbiterMilestoneIdx(milestoneIdx);
    setArbiterBuyerPct(50);
    setArbiterDialogOpen(true);
  }, []);

  const handleArbitrate = useCallback(() => {
    if (escrowIdBigInt === undefined) return;
    setError("");
    const buyerBasisPoints = BigInt(Math.round(arbiterBuyerPct * 100));
    const fnName =
      userRole === "arbiter"
        ? "resolveDisputeByArbiter"
        : "resolveDisputeByConsensus";

    writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: fnName,
      args: [escrowIdBigInt, BigInt(arbiterMilestoneIdx), buyerBasisPoints],
    });
    setArbiterDialogOpen(false);
  }, [
    escrowIdBigInt,
    arbiterBuyerPct,
    arbiterMilestoneIdx,
    userRole,
    writeContract,
  ]);

  const handleReleaseAll = useCallback(() => {
    if (escrowIdBigInt === undefined) return;
    setError("");
    writeContract({
      address: ESCROW_CONTRACT_ADDRESS,
      abi: ESCROW_ABI,
      functionName: "releaseFunds",
      args: [escrowIdBigInt],
    });
  }, [escrowIdBigInt, writeContract]);

  const handleRefund = useCallback(() => {
    if (escrowIdBigInt === undefined) return;
    setError("");
    if (userRole === "seller") {
      writeContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "sellerInitiatedRefund",
        args: [escrowIdBigInt],
      });
    } else {
      writeContract({
        address: ESCROW_CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: "claimRefund",
        args: [escrowIdBigInt],
      });
    }
  }, [escrowIdBigInt, userRole, writeContract]);

  // Short address display
  const shortAddr = (a: string) =>
    `${a.slice(0, 6)}...${a.slice(-4)}`;

  // ──────────────────────────────────────────────────────────
  //  RENDER
  // ──────────────────────────────────────────────────────────

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-200">
        {/* ──── HEADER ──── */}
        <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/80 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Shield className="h-7 w-7 text-emerald-400" />
              <span className="text-xl font-bold tracking-tight text-white">
                Surveydeal
              </span>
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-400 text-[10px]"
              >
                Protocol v1
              </Badge>
              {chain && (
                <Badge
                  variant="outline"
                  className="border-slate-600 text-slate-400 text-[10px] hidden sm:inline-flex"
                >
                  {chain.name}
                </Badge>
              )}
            </div>
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="avatar"
            />
          </div>
        </header>

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          {/* ── Wallet gate ── */}
          {!isConnected ? (
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="flex flex-col items-center gap-6 py-20">
                <div className="rounded-2xl bg-slate-800/60 p-6">
                  <Wallet className="h-14 w-14 text-slate-500" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-white">
                    Connect Your Wallet
                  </h2>
                  <p className="mt-2 max-w-sm text-slate-400">
                    Connect via MetaMask, Coinbase Wallet, WalletConnect, or any
                    EVM-compatible wallet to get started.
                  </p>
                </div>
                <ConnectButton />
              </CardContent>
            </Card>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                setActiveTab(v as "create" | "manage");
                setError("");
                setSuccess("");
                resetWrite();
              }}
            >
              <TabsList className="mb-6 grid w-full grid-cols-2 bg-slate-800/50">
                <TabsTrigger
                  value="create"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  Create Escrow
                </TabsTrigger>
                <TabsTrigger
                  value="manage"
                  className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
                >
                  Manage Escrow
                </TabsTrigger>
              </TabsList>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                   CREATE TAB
                 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <TabsContent value="create">
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-white">
                      New Escrow Agreement
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      Set up a secure milestone-based escrow with any ERC-20
                      token, including memecoins.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* ── Role toggle ── */}
                    <div>
                      <Label className="mb-2 block text-slate-400 text-xs uppercase tracking-wider">
                        Your Role
                      </Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={role === "buyer" ? "default" : "outline"}
                          onClick={() => setRole("buyer")}
                          className={
                            role === "buyer"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "border-slate-700 text-slate-300 hover:bg-slate-800"
                          }
                        >
                          <Wallet className="mr-2 h-4 w-4" />I am the Buyer
                        </Button>
                        <Button
                          type="button"
                          variant={role === "seller" ? "default" : "outline"}
                          onClick={() => setRole("seller")}
                          className={
                            role === "seller"
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "border-slate-700 text-slate-300 hover:bg-slate-800"
                          }
                        >
                          <PackageCheck className="mr-2 h-4 w-4" />I am the
                          Seller
                        </Button>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        {role === "buyer"
                          ? "You will fund the escrow and release payments on milestone completion."
                          : "You will receive funds as milestones are approved and released."}
                      </p>
                    </div>

                    {/* ── Title + Counterparty ── */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-slate-300">Title</Label>
                        <Input
                          placeholder="Website Development Project"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-slate-300">
                          {role === "buyer" ? "Seller" : "Buyer"} Wallet
                        </Label>
                        <Input
                          placeholder="0x..."
                          value={counterpartyAddress}
                          onChange={(e) =>
                            setCounterpartyAddress(e.target.value)
                          }
                          className="border-slate-700 bg-slate-800 font-mono text-sm text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Description</Label>
                      <Textarea
                        placeholder="Describe the deliverables, scope, and expectations..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={3}
                        className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                      />
                    </div>

                    {/* ── Token selector ── */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">Payment Token</Label>
                      <Select
                        onValueChange={(addr) => {
                          const t = LISTED_TOKENS.find(
                            (t) => t.address === addr
                          );
                          setSelectedToken(t ?? null);
                        }}
                      >
                        <SelectTrigger className="border-slate-700 bg-slate-800 text-white h-11">
                          <SelectValue placeholder="Select a token" />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-900 max-h-72">
                          {LISTED_TOKENS.map((token) => (
                            <SelectItem
                              key={token.address}
                              value={token.address}
                              className="text-white focus:bg-slate-800 focus:text-white"
                            >
                              <div className="flex items-center gap-2">
                                {token.logoUrl && (
                                  <img
                                    src={token.logoUrl}
                                    alt={token.symbol}
                                    className="h-5 w-5 rounded-full"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = "none";
                                    }}
                                  />
                                )}
                                <span className="font-semibold">
                                  {token.symbol}
                                </span>
                                <span className="text-xs text-slate-400">
                                  {token.name}
                                </span>
                                <TokenBadges token={token} />
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Token balance + warnings */}
                      {selectedToken && (
                        <div className="flex items-center justify-between rounded-md bg-slate-800/40 px-3 py-2 text-xs">
                          <span className="text-slate-400">
                            Your balance:{" "}
                            <span className="font-mono text-white">
                              {tokenBalance !== null
                                ? parseFloat(tokenBalance).toLocaleString(
                                    undefined,
                                    { maximumFractionDigits: 6 }
                                  )
                                : "Loading..."}
                            </span>{" "}
                            {selectedToken.symbol}
                          </span>
                          <TokenBadges token={selectedToken} />
                        </div>
                      )}

                      {selectedToken?.hasTax && (
                        <Alert className="border-orange-600/30 bg-orange-950/20">
                          <AlertCircle className="h-4 w-4 text-orange-400" />
                          <AlertDescription className="text-orange-300 text-sm">
                            <strong>{selectedToken.symbol}</strong> charges a
                            transfer tax. The contract uses balance-diff
                            accounting (balanceBefore vs balanceAfter) to
                            calculate the actual received amount and
                            proportionally adjusts milestones.
                          </AlertDescription>
                        </Alert>
                      )}

                      {selectedToken?.isReflective && !selectedToken?.hasTax && (
                        <Alert className="border-purple-600/30 bg-purple-950/20">
                          <AlertCircle className="h-4 w-4 text-purple-400" />
                          <AlertDescription className="text-purple-300 text-sm">
                            <strong>{selectedToken.symbol}</strong> is a
                            reflection token. Balances may accrue over time while
                            held in the contract.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

                    {/* ── Escrow mode cards ── */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">Escrow Mode</Label>
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* Locked card */}
                        <button
                          type="button"
                          onClick={() => {
                            setEscrowMode("locked");
                            setArbiterAddress("");
                          }}
                          className={`group rounded-xl border-2 p-5 text-left transition-all ${
                            escrowMode === "locked"
                              ? "border-emerald-500 bg-emerald-950/30 shadow-lg shadow-emerald-900/20"
                              : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                escrowMode === "locked"
                                  ? "bg-emerald-600/20"
                                  : "bg-slate-700/50"
                              }`}
                            >
                              <Shield
                                className={`h-5 w-5 ${
                                  escrowMode === "locked"
                                    ? "text-emerald-400"
                                    : "text-slate-400"
                                }`}
                              />
                            </div>
                            <div>
                              <span className="font-semibold text-white">
                                Locked Mode
                              </span>
                              <Badge
                                variant="outline"
                                className="ml-2 border-emerald-600/40 text-emerald-400 text-[10px]"
                              >
                                2-of-2
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                            Pure game theory. Both Buyer and Seller must
                            cooperate to release or refund funds. No third party
                            can intervene. Ideal for high-trust counterparties.
                          </p>
                        </button>

                        {/* Arbiter card */}
                        <button
                          type="button"
                          onClick={() => setEscrowMode("arbiter")}
                          className={`group rounded-xl border-2 p-5 text-left transition-all ${
                            escrowMode === "arbiter"
                              ? "border-blue-500 bg-blue-950/30 shadow-lg shadow-blue-900/20"
                              : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                                escrowMode === "arbiter"
                                  ? "bg-blue-600/20"
                                  : "bg-slate-700/50"
                              }`}
                            >
                              <Gavel
                                className={`h-5 w-5 ${
                                  escrowMode === "arbiter"
                                    ? "text-blue-400"
                                    : "text-slate-400"
                                }`}
                              />
                            </div>
                            <div>
                              <span className="font-semibold text-white">
                                Arbiter Mode
                              </span>
                              <Badge
                                variant="outline"
                                className="ml-2 border-blue-600/40 text-blue-400 text-[10px]"
                              >
                                2-of-3
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                            A trusted arbiter acts as tiebreaker. If Buyer and
                            Seller disagree, the arbiter can split disputed funds
                            at any ratio. Recommended for first-time trades.
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* ── Arbiter address (conditional) ── */}
                    {escrowMode === "arbiter" && (
                      <div className="space-y-2 rounded-lg border border-blue-800/30 bg-blue-950/10 p-4">
                        <Label className="text-blue-300">
                          Arbiter Wallet Address
                        </Label>
                        <Input
                          placeholder="0x... (must hold ARBITER_ROLE on-chain)"
                          value={arbiterAddress}
                          onChange={(e) => setArbiterAddress(e.target.value)}
                          className="border-blue-800/40 bg-slate-800 font-mono text-sm text-white placeholder:text-slate-500"
                        />
                        <p className="text-[11px] text-blue-400/70">
                          The arbiter must be registered on the Surveydeal
                          contract with ARBITER_ROLE before the escrow can be
                          created.
                        </p>
                      </div>
                    )}

                    {/* ── Agreement terms ── */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">
                        Agreement Terms{" "}
                        <span className="text-slate-500 font-normal">
                          (keccak256 hashed on-chain)
                        </span>
                      </Label>
                      <Textarea
                        placeholder="Paste or type the full agreement text here. A cryptographic hash is stored immutably on-chain as proof of the original terms."
                        value={agreementText}
                        onChange={(e) => setAgreementText(e.target.value)}
                        rows={4}
                        className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                      />
                      {agreementText.trim() && (
                        <div className="rounded-md bg-slate-800/50 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
                            On-chain hash
                          </p>
                          <p className="font-mono text-xs text-emerald-400/80 break-all">
                            {agreementHash}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* ── Deadline ── */}
                    <div className="space-y-2">
                      <Label className="text-slate-300">
                        Deadline{" "}
                        <span className="text-slate-500 font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        type="datetime-local"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="border-slate-700 bg-slate-800 text-white max-w-xs"
                      />
                      <p className="text-[11px] text-slate-500">
                        After the deadline, the buyer can claim a refund on
                        unreleased milestones.
                      </p>
                    </div>

                    <Separator className="bg-slate-800" />

                    {/* ── Milestone builder ── */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label className="text-lg text-white">
                            Milestones
                          </Label>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Break the project into payment stages. Each milestone
                            can be independently delivered, approved, released, or
                            disputed.
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addMilestone}
                          className="border-slate-700 text-slate-300 hover:bg-slate-800"
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add
                        </Button>
                      </div>

                      {milestones.map((ms, index) => (
                        <div
                          key={ms.id}
                          className="group flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/20 p-4 transition-colors hover:border-slate-700"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/20 text-sm font-bold text-emerald-400 tabular-nums">
                            {index + 1}
                          </div>
                          <div className="flex-1 space-y-3">
                            <Input
                              placeholder={`Milestone ${index + 1} description`}
                              value={ms.description}
                              onChange={(e) =>
                                updateMilestone(
                                  ms.id,
                                  "description",
                                  e.target.value
                                )
                              }
                              className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-500"
                            />
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                placeholder="Amount"
                                value={ms.amount}
                                onChange={(e) =>
                                  updateMilestone(
                                    ms.id,
                                    "amount",
                                    e.target.value
                                  )
                                }
                                className="border-slate-700 bg-slate-900 text-white placeholder:text-slate-500 max-w-[200px]"
                                min="0"
                                step="any"
                              />
                              <span className="text-sm font-medium text-slate-400">
                                {selectedToken?.symbol ?? "TOKEN"}
                              </span>
                              {ms.amount &&
                                parseFloat(ms.amount) > 0 &&
                                totalAmount > 0 && (
                                  <span className="text-xs text-slate-500">
                                    (
                                    {(
                                      (parseFloat(ms.amount) / totalAmount) *
                                      100
                                    ).toFixed(1)}
                                    %)
                                  </span>
                                )}
                            </div>
                          </div>
                          {milestones.length > 1 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeMilestone(ms.id)}
                                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-950/30 hover:text-red-300 transition-opacity"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Remove milestone</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      ))}

                      {/* Total bar */}
                      <div className="flex items-center justify-between rounded-xl bg-slate-800/60 border border-slate-700/50 p-4">
                        <span className="text-lg font-semibold text-white">
                          Total
                        </span>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-emerald-400 tabular-nums">
                            {totalAmount.toLocaleString(undefined, {
                              maximumFractionDigits: 8,
                            })}
                          </span>
                          <span className="ml-2 text-sm text-slate-400">
                            {selectedToken?.symbol ?? ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* ── Feedback alerts ── */}
                    {error && (
                      <Alert className="border-red-600/30 bg-red-950/20">
                        <XCircle className="h-4 w-4 text-red-400" />
                        <AlertDescription className="text-red-300">
                          {error}
                        </AlertDescription>
                      </Alert>
                    )}
                    {success && (
                      <Alert className="border-emerald-600/30 bg-emerald-950/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <AlertDescription className="text-emerald-300">
                          {success}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* ── Action buttons ── */}
                    <div className="flex gap-3">
                      {needsApproval && (
                        <Button
                          onClick={handleApproveToken}
                          disabled={isLoading}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-base"
                        >
                          {isLoading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Approve {selectedToken?.symbol}
                        </Button>
                      )}
                      <Button
                        onClick={handleCreateEscrow}
                        disabled={isLoading || needsApproval}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-12 text-base"
                      >
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="mr-2 h-5 w-5" />
                        )}
                        Create Escrow
                      </Button>
                    </div>

                    {txHash && (
                      <div className="text-center space-y-1">
                        <p className="font-mono text-xs text-slate-500 break-all">
                          TX: {txHash}
                        </p>
                        {isTxConfirming && (
                          <p className="text-xs text-blue-400 flex items-center justify-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Confirming...
                          </p>
                        )}
                        {isTxConfirmed && (
                          <p className="text-xs text-emerald-400">
                            Confirmed on-chain
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                   MANAGE TAB
                 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <TabsContent value="manage">
                <Card className="border-slate-800 bg-slate-900/50">
                  <CardHeader>
                    <CardTitle className="text-white">Manage Escrow</CardTitle>
                    <CardDescription className="text-slate-400">
                      Load an escrow by its on-chain ID to view status and take
                      actions.
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    {/* ── Escrow ID input ── */}
                    <div className="flex gap-3">
                      <Input
                        placeholder="Enter Escrow ID (e.g. 0, 1, 2...)"
                        value={manageEscrowId}
                        onChange={(e) => setManageEscrowId(e.target.value)}
                        className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 font-mono"
                      />
                      <Button
                        variant="outline"
                        onClick={() => {
                          refetchEscrow();
                          refetchMilestones();
                        }}
                        disabled={escrowIdBigInt === undefined}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800 shrink-0"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </div>

                    {escrowIdBigInt !== undefined && !escrowData && (
                      <div className="text-center py-8 text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                        Loading escrow data...
                      </div>
                    )}

                    {escrowData && (
                      <>
                        {/* ── Status header ── */}
                        <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-slate-800/40 to-slate-800/20 p-6">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">
                              Escrow #{escrowData.id.toString()}
                            </h3>
                            <div className="flex items-center gap-2">
                              <Badge
                                className={`${
                                  STATE_MAP[escrowData.state]?.color ??
                                  "bg-slate-600"
                                } text-white flex items-center gap-1 px-2.5 py-1`}
                              >
                                {STATE_MAP[escrowData.state]?.icon}
                                {STATE_MAP[escrowData.state]?.label ??
                                  "Unknown"}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  escrowData.mode === 0
                                    ? "border-emerald-600/40 text-emerald-400"
                                    : "border-blue-600/40 text-blue-400"
                                }`}
                              >
                                {escrowData.mode === 0
                                  ? "Locked 2-of-2"
                                  : "Arbiter 2-of-3"}
                              </Badge>
                            </div>
                          </div>

                          {/* Stats grid */}
                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                              label="Total"
                              value={
                                escrowTokenInfo
                                  ? formatUnits(
                                      escrowData.totalAmount,
                                      escrowTokenInfo.decimals
                                    )
                                  : escrowData.totalAmount.toString()
                              }
                              sub={escrowTokenInfo?.symbol}
                            />
                            <StatCard
                              label="Funded"
                              value={
                                escrowTokenInfo
                                  ? formatUnits(
                                      escrowData.fundedAmount,
                                      escrowTokenInfo.decimals
                                    )
                                  : escrowData.fundedAmount.toString()
                              }
                              sub={escrowTokenInfo?.symbol}
                            />
                            <StatCard
                              label="Released"
                              value={
                                escrowTokenInfo
                                  ? formatUnits(
                                      escrowData.releasedAmount,
                                      escrowTokenInfo.decimals
                                    )
                                  : escrowData.releasedAmount.toString()
                              }
                              sub={escrowTokenInfo?.symbol}
                            />
                            <StatCard
                              label="Fees"
                              value={
                                escrowTokenInfo
                                  ? formatUnits(
                                      escrowData.protocolFeeCollected,
                                      escrowTokenInfo.decimals
                                    )
                                  : escrowData.protocolFeeCollected.toString()
                              }
                              sub="Protocol fee"
                            />
                          </div>

                          {/* Participants */}
                          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 text-xs w-12">
                                Buyer
                              </span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <code className="text-xs text-white bg-slate-800 px-2 py-0.5 rounded">
                                    {shortAddr(escrowData.buyer)}
                                  </code>
                                </TooltipTrigger>
                                <TooltipContent className="font-mono text-xs">
                                  {escrowData.buyer}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 text-xs w-12">
                                Seller
                              </span>
                              <Tooltip>
                                <TooltipTrigger>
                                  <code className="text-xs text-white bg-slate-800 px-2 py-0.5 rounded">
                                    {shortAddr(escrowData.seller)}
                                  </code>
                                </TooltipTrigger>
                                <TooltipContent className="font-mono text-xs">
                                  {escrowData.seller}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            {escrowData.arbiter !== zeroAddress && (
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500 text-xs w-12">
                                  Arbiter
                                </span>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <code className="text-xs text-white bg-slate-800 px-2 py-0.5 rounded">
                                      {shortAddr(escrowData.arbiter)}
                                    </code>
                                  </TooltipTrigger>
                                  <TooltipContent className="font-mono text-xs">
                                    {escrowData.arbiter}
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </div>

                          {/* Deadline + role badge */}
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            {escrowData.deadline > BigInt(0) && (
                              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                <Clock className="h-3.5 w-3.5" />
                                Deadline:{" "}
                                {new Date(
                                  Number(escrowData.deadline) * 1000
                                ).toLocaleString()}
                              </div>
                            )}
                            {userRole && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  userRole === "buyer"
                                    ? "border-emerald-500/40 text-emerald-400"
                                    : userRole === "seller"
                                      ? "border-blue-500/40 text-blue-400"
                                      : "border-purple-500/40 text-purple-400"
                                }`}
                              >
                                You are the{" "}
                                {userRole.charAt(0).toUpperCase() +
                                  userRole.slice(1)}
                              </Badge>
                            )}
                            {!userRole && address && (
                              <Badge
                                variant="outline"
                                className="border-slate-600 text-slate-400 text-xs"
                              >
                                You are not a participant
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* ── Progress bar ── */}
                        {milestonesData && milestonesData.length > 0 && (
                          <MilestoneProgressBar milestones={milestonesData} />
                        )}

                        {/* ── Milestone list + per-milestone actions ── */}
                        {milestonesData && milestonesData.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-white">
                              Milestones
                            </h3>

                            {milestonesData.map((m, i) => {
                              const isActive = escrowData.state === 2;
                              const isDisputed = escrowData.state === 4;

                              return (
                                <div
                                  key={i}
                                  className={`rounded-xl border p-4 transition-all ${
                                    m.released
                                      ? "border-emerald-800/30 bg-emerald-950/10"
                                      : m.disputed
                                        ? "border-red-800/30 bg-red-950/10"
                                        : "border-slate-800 bg-slate-800/20"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-4">
                                    {/* Left: index + info */}
                                    <div className="flex items-start gap-3 min-w-0 flex-1">
                                      <div
                                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                          m.released
                                            ? "bg-emerald-600/20 text-emerald-400"
                                            : m.disputed
                                              ? "bg-red-600/20 text-red-400"
                                              : m.sellerDelivered
                                                ? "bg-blue-600/20 text-blue-400"
                                                : "bg-slate-700/50 text-slate-300"
                                        }`}
                                      >
                                        {m.released ? (
                                          <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                          i + 1
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-white font-medium truncate">
                                          {m.description}
                                        </p>
                                        <p className="text-sm text-slate-400 mt-0.5">
                                          {escrowTokenInfo
                                            ? `${formatUnits(m.amount, escrowTokenInfo.decimals)} ${escrowTokenInfo.symbol}`
                                            : m.amount.toString()}
                                        </p>
                                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                                          {m.sellerDelivered && (
                                            <Badge className="bg-blue-600/20 text-blue-400 text-[10px] px-1.5">
                                              Delivered
                                            </Badge>
                                          )}
                                          {m.buyerApproved && (
                                            <Badge className="bg-emerald-600/20 text-emerald-400 text-[10px] px-1.5">
                                              Approved
                                            </Badge>
                                          )}
                                          {m.disputed && !m.released && (
                                            <Badge className="bg-red-600/20 text-red-400 text-[10px] px-1.5">
                                              Disputed
                                            </Badge>
                                          )}
                                          {m.released && (
                                            <Badge className="bg-emerald-600/20 text-emerald-400 text-[10px] px-1.5">
                                              Released
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Right: DYNAMIC ACTION HUB per milestone */}
                                    {!m.released && (
                                      <div className="flex flex-col gap-1.5 shrink-0">
                                        {/* ── SELLER actions ── */}
                                        {userRole === "seller" &&
                                          isActive &&
                                          !m.sellerDelivered &&
                                          !m.disputed && (
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                handleDeliverMilestone(i)
                                              }
                                              disabled={isLoading}
                                              className="bg-blue-600 hover:bg-blue-700 text-xs h-8"
                                            >
                                              {isLoading ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <PackageCheck className="mr-1 h-3 w-3" />
                                              )}
                                              Deliver
                                            </Button>
                                          )}

                                        {/* ── BUYER actions ── */}
                                        {userRole === "buyer" &&
                                          isActive &&
                                          m.sellerDelivered &&
                                          !m.buyerApproved &&
                                          !m.disputed && (
                                            <>
                                              <Button
                                                size="sm"
                                                onClick={() =>
                                                  handleApproveMilestone(i)
                                                }
                                                disabled={isLoading}
                                                className="bg-sky-600 hover:bg-sky-700 text-xs h-8"
                                              >
                                                {isLoading ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                                )}
                                                Approve
                                              </Button>
                                              <Button
                                                size="sm"
                                                onClick={() =>
                                                  handleReleaseMilestone(i)
                                                }
                                                disabled={isLoading}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
                                              >
                                                {isLoading ? (
                                                  <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                  <ChevronRight className="mr-1 h-3 w-3" />
                                                )}
                                                Release
                                              </Button>
                                            </>
                                          )}

                                        {userRole === "buyer" &&
                                          isActive &&
                                          m.buyerApproved &&
                                          m.sellerDelivered &&
                                          !m.disputed && (
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                handleReleaseMilestone(i)
                                              }
                                              disabled={isLoading}
                                              className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8"
                                            >
                                              {isLoading ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                              ) : (
                                                <ChevronRight className="mr-1 h-3 w-3" />
                                              )}
                                              Release
                                            </Button>
                                          )}

                                        {/* ── DISPUTE initiation (buyer or seller) ── */}
                                        {(userRole === "buyer" ||
                                          userRole === "seller") &&
                                          isActive &&
                                          !m.disputed && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                handleDisputeMilestone(i)
                                              }
                                              disabled={isLoading}
                                              className="border-red-600/40 text-red-400 hover:bg-red-950/30 text-xs h-8"
                                            >
                                              <ShieldAlert className="mr-1 h-3 w-3" />
                                              Dispute
                                            </Button>
                                          )}

                                        {/* ── ARBITRATE button (arbiter on disputed milestone) ── */}
                                        {userRole === "arbiter" &&
                                          isDisputed &&
                                          m.disputed && (
                                            <Button
                                              size="sm"
                                              onClick={() =>
                                                openArbiterDialog(i)
                                              }
                                              disabled={isLoading}
                                              className="bg-purple-600 hover:bg-purple-700 text-xs h-8"
                                            >
                                              <Gavel className="mr-1 h-3 w-3" />
                                              Arbitrate
                                            </Button>
                                          )}

                                        {/* ── CONSENSUS resolve (buyer/seller on disputed milestone in arbiter mode) ── */}
                                        {(userRole === "buyer" ||
                                          userRole === "seller") &&
                                          (isDisputed || (isActive && m.disputed)) &&
                                          m.disputed && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() =>
                                                openArbiterDialog(i)
                                              }
                                              disabled={isLoading}
                                              className="border-amber-600/40 text-amber-400 hover:bg-amber-950/30 text-xs h-8"
                                            >
                                              <Scale className="mr-1 h-3 w-3" />
                                              Propose Split
                                            </Button>
                                          )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* ── Global action hub ── */}
                        <Separator className="bg-slate-800" />
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500 mb-3">
                            Escrow Actions
                          </p>
                          <div className="flex flex-wrap gap-2.5">
                            {/* Buyer: fund a Created escrow */}
                            {userRole === "buyer" &&
                              escrowData.state === 0 && (
                                <Button
                                  onClick={handleFundEscrow}
                                  disabled={isLoading}
                                  className="bg-blue-600 hover:bg-blue-700"
                                >
                                  {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  <Wallet className="mr-2 h-4 w-4" />
                                  Fund Escrow
                                </Button>
                              )}

                            {/* Seller: activate a Funded escrow */}
                            {userRole === "seller" &&
                              escrowData.state === 1 && (
                                <Button
                                  onClick={handleActivateEscrow}
                                  disabled={isLoading}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  <ShieldCheck className="mr-2 h-4 w-4" />
                                  Activate Escrow
                                </Button>
                              )}

                            {/* Buyer: release all remaining active milestones */}
                            {userRole === "buyer" &&
                              escrowData.state === 2 && (
                                <Button
                                  onClick={handleReleaseAll}
                                  disabled={isLoading}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  {isLoading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  )}
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Release All Funds
                                </Button>
                              )}

                            {/* Seller: voluntary refund */}
                            {userRole === "seller" &&
                              escrowData.state === 2 && (
                                <Button
                                  onClick={handleRefund}
                                  disabled={isLoading}
                                  variant="outline"
                                  className="border-amber-600/40 text-amber-400 hover:bg-amber-950/30"
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Refund Buyer
                                </Button>
                              )}

                            {/* Buyer: claim refund (Funded = anytime, Active = after deadline) */}
                            {userRole === "buyer" &&
                              (escrowData.state === 1 ||
                                escrowData.state === 2) && (
                                <Button
                                  onClick={handleRefund}
                                  disabled={isLoading}
                                  variant="outline"
                                  className="border-amber-600/40 text-amber-400 hover:bg-amber-950/30"
                                >
                                  <RotateCcw className="mr-2 h-4 w-4" />
                                  Claim Refund
                                </Button>
                              )}

                            {/* Terminal states */}
                            {(escrowData.state === 3 ||
                              escrowData.state === 5) && (
                              <p className="text-sm text-slate-500 italic py-2">
                                This escrow is{" "}
                                {escrowData.state === 3
                                  ? "completed"
                                  : "refunded"}
                                . No further actions available.
                              </p>
                            )}

                            {/* Not a participant */}
                            {!userRole && address && (
                              <p className="text-sm text-slate-500 italic py-2">
                                Your wallet is not a participant in this escrow.
                                Connect as the buyer, seller, or arbiter to take
                                actions.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* ── Feedback ── */}
                        {error && (
                          <Alert className="border-red-600/30 bg-red-950/20">
                            <XCircle className="h-4 w-4 text-red-400" />
                            <AlertDescription className="text-red-300">
                              {error}
                            </AlertDescription>
                          </Alert>
                        )}
                        {success && (
                          <Alert className="border-emerald-600/30 bg-emerald-950/20">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <AlertDescription className="text-emerald-300">
                              {success}
                            </AlertDescription>
                          </Alert>
                        )}

                        {txHash && (
                          <div className="text-center space-y-1">
                            <p className="font-mono text-xs text-slate-500 break-all">
                              TX: {txHash}
                            </p>
                            {isTxConfirming && (
                              <p className="text-xs text-blue-400 flex items-center justify-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Confirming...
                              </p>
                            )}
                            {isTxConfirmed && (
                              <p className="text-xs text-emerald-400">
                                Confirmed on-chain
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </main>

        {/* ──── FOOTER ──── */}
        <footer className="border-t border-slate-800/60 py-8 text-center">
          <p className="text-sm text-slate-500">
            Surveydeal Protocol &middot; Decentralized Milestone Escrow &middot;
            Secured by Smart Contracts
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Supports all ERC-20 tokens including deflationary and reflection
            memecoins
          </p>
        </footer>

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
             ARBITER SPLIT DIALOG
           ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <Dialog open={arbiterDialogOpen} onOpenChange={setArbiterDialogOpen}>
          <DialogContent className="border-slate-700 bg-slate-900 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <Gavel className="h-5 w-5 text-purple-400" />
                {userRole === "arbiter"
                  ? "Arbitrate Dispute"
                  : "Propose Consensus Split"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {userRole === "arbiter"
                  ? "As the arbiter, set the percentage split between buyer and seller for milestone #" +
                    (arbiterMilestoneIdx + 1) +
                    ". This is final and executes on-chain."
                  : "Propose a split ratio. Both parties must agree in Locked mode, or the arbiter can override in Arbiter mode."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Split visualization */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-emerald-500" />
                    <span className="text-slate-300">Buyer receives</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-400 tabular-nums">
                    {arbiterBuyerPct}%
                  </span>
                </div>

                <Slider
                  value={[arbiterBuyerPct]}
                  onValueChange={([val]) => setArbiterBuyerPct(val)}
                  min={0}
                  max={100}
                  step={1}
                  className="py-2"
                />

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-blue-500" />
                    <span className="text-slate-300">Seller receives</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-400 tabular-nums">
                    {100 - arbiterBuyerPct}%
                  </span>
                </div>
              </div>

              {/* Split bar preview */}
              <div className="h-4 w-full overflow-hidden rounded-full flex">
                <div
                  className="bg-emerald-500 transition-all duration-200"
                  style={{ width: `${arbiterBuyerPct}%` }}
                />
                <div
                  className="bg-blue-500 transition-all duration-200"
                  style={{ width: `${100 - arbiterBuyerPct}%` }}
                />
              </div>

              {/* Amount preview */}
              {milestonesData &&
                milestonesData[arbiterMilestoneIdx] &&
                escrowTokenInfo && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-lg bg-emerald-950/20 border border-emerald-800/30 p-3 text-center">
                      <p className="text-[11px] text-emerald-400/70 uppercase tracking-wider">
                        Buyer gets
                      </p>
                      <p className="text-lg font-bold text-emerald-400 tabular-nums">
                        {(
                          (Number(
                            formatUnits(
                              milestonesData[arbiterMilestoneIdx].amount,
                              escrowTokenInfo.decimals
                            )
                          ) *
                            arbiterBuyerPct) /
                          100
                        ).toFixed(4)}
                      </p>
                      <p className="text-[11px] text-emerald-400/50">
                        {escrowTokenInfo.symbol}
                      </p>
                    </div>
                    <div className="rounded-lg bg-blue-950/20 border border-blue-800/30 p-3 text-center">
                      <p className="text-[11px] text-blue-400/70 uppercase tracking-wider">
                        Seller gets
                      </p>
                      <p className="text-lg font-bold text-blue-400 tabular-nums">
                        {(
                          (Number(
                            formatUnits(
                              milestonesData[arbiterMilestoneIdx].amount,
                              escrowTokenInfo.decimals
                            )
                          ) *
                            (100 - arbiterBuyerPct)) /
                          100
                        ).toFixed(4)}
                      </p>
                      <p className="text-[11px] text-blue-400/50">
                        {escrowTokenInfo.symbol}
                      </p>
                    </div>
                  </div>
                )}

              <p className="text-[11px] text-slate-500 text-center">
                Protocol fee is deducted from the milestone total before
                splitting. The amounts shown are approximate pre-fee values.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => setArbiterDialogOpen(false)}
                className="border-slate-700 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                onClick={handleArbitrate}
                disabled={isLoading}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Gavel className="mr-2 h-4 w-4" />
                )}
                {userRole === "arbiter"
                  ? "Execute Arbitration"
                  : "Submit Split Proposal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
