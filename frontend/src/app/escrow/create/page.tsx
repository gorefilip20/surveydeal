"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  useSwitchChain,
  useChainId,
} from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  parseUnits,
  keccak256,
  toBytes,
  formatUnits,
  type Address,
  zeroAddress,
  erc20Abi,
} from "viem";
import {
  Shield,
  ShoppingCart,
  Store,
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Lock,
  Users,
  Coins,
  Plus,
  Trash2,
  AlertCircle,
  Wallet,
  Globe,
  Copy,
  Zap,
  ArrowLeftRight,
  QrCode,
  Send,
  ExternalLink,
} from "lucide-react";
import PriceCalculator from "@/components/PriceCalculator";
import { CHAIN_CONFIG } from "@/wagmi.config";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT as Address;

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
    name: "calculateProtocolFee",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface Network {
  id: string;
  name: string;
  chainId: number;
  icon: string;
  available: boolean;
  type: "evm" | "non-evm";
}

interface Token {
  address: Address;
  symbol: string;
  name: string;
  decimals: number;
}

interface Milestone {
  id: string;
  description: string;
  amount: string;
}

const NETWORKS: Network[] = [
  { id: "hardhat", name: "Local Testnet", chainId: 31337, icon: "🔧", available: true, type: "evm" },
  { id: "ethereum", name: "Ethereum", chainId: 1, icon: "⟠", available: true, type: "evm" },
  { id: "bnb", name: "BNB Chain", chainId: 56, icon: "◆", available: true, type: "evm" },
  { id: "arbitrum", name: "Arbitrum", chainId: 42161, icon: "🔵", available: true, type: "evm" },
  { id: "base", name: "Base", chainId: 8453, icon: "🔷", available: true, type: "evm" },
  { id: "polygon", name: "Polygon", chainId: 137, icon: "🟣", available: true, type: "evm" },
  { id: "optimism", name: "Optimism", chainId: 10, icon: "🔴", available: true, type: "evm" },
  { id: "tron", name: "Tron", chainId: 0, icon: "◈", available: false, type: "non-evm" },
  { id: "bitcoin", name: "Bitcoin", chainId: 0, icon: "₿", available: false, type: "non-evm" },
];

const TOKENS: Record<string, Token[]> = {
  hardhat: [
    { address: "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address, symbol: "USDC", name: "USD Coin (Test)", decimals: 6 },
    { address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as Address, symbol: "USDT", name: "Tether (Test)", decimals: 6 },
    { address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as Address, symbol: "DAI", name: "Dai (Test)", decimals: 18 },
  ],
  ethereum: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address, symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" as Address, symbol: "USDT", name: "Tether USD", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Address, symbol: "DAI", name: "Dai Stablecoin", decimals: 18 },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  ],
  bnb: [
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as Address, symbol: "USDC", name: "USD Coin", decimals: 18 },
    { address: "0x55d398326f99059fF775485246999027B3197955" as Address, symbol: "USDT", name: "Tether USD", decimals: 18 },
    { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56" as Address, symbol: "BUSD", name: "Binance USD", decimals: 18 },
    { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as Address, symbol: "WBNB", name: "Wrapped BNB", decimals: 18 },
  ],
  arbitrum: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" as Address, symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address, symbol: "USDT", name: "Tether USD", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" as Address, symbol: "DAI", name: "Dai", decimals: 18 },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as Address, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  ],
  base: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address, symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006" as Address, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" as Address, symbol: "DAI", name: "Dai", decimals: 18 },
  ],
  polygon: [
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" as Address, symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" as Address, symbol: "USDT", name: "Tether USD", decimals: 6 },
    { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270" as Address, symbol: "WMATIC", name: "Wrapped MATIC", decimals: 18 },
  ],
  optimism: [
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" as Address, symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" as Address, symbol: "USDT", name: "Tether USD", decimals: 6 },
    { address: "0x4200000000000000000000000000000000000006" as Address, symbol: "WETH", name: "Wrapped Ether", decimals: 18 },
  ],
};

const STEPS = ["Role & Network", "Token & Party", "Deal Details", "Milestones & Review"];

export default function CreateEscrowPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const currentChainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [step, setStep] = useState(0);

  const [role, setRole] = useState<"buyer" | "seller" | "">("");
  const [network, setNetwork] = useState("");
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [customToken, setCustomToken] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [escrowMode, setEscrowMode] = useState<0 | 1>(0);
  const [arbiterAddress, setArbiterAddress] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [agreementText, setAgreementText] = useState("");
  const [milestones, setMilestones] = useState<Milestone[]>([
    { id: "1", description: "", amount: "" },
  ]);

  const [approvalHash, setApprovalHash] = useState<`0x${string}` | undefined>();
  const [createHash, setCreateHash] = useState<`0x${string}` | undefined>();
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [generatedWallet, setGeneratedWallet] = useState<{ address: string; privateKey?: string; mnemonic?: string } | null>(null);
  const [isGeneratingWallet, setIsGeneratingWallet] = useState(false);
  const [walletCopied, setWalletCopied] = useState("");
  const [fundingMethod, setFundingMethod] = useState<"wallet" | "deposit" | "">("");
  const [depositWallet, setDepositWallet] = useState<{ address: string; tokenSymbol?: string; expectedAmount?: string; chainId?: number } | null>(null);
  const [isGeneratingDeposit, setIsGeneratingDeposit] = useState(false);
  const [depositCopied, setDepositCopied] = useState(false);

  const { writeContract: writeApprove } = useWriteContract();
  const { writeContract: writeCreate } = useWriteContract();
  const { isLoading: isApproving, isSuccess: approvalDone } = useWaitForTransactionReceipt({ hash: approvalHash });
  const { isLoading: isConfirming, isSuccess: createDone } = useWaitForTransactionReceipt({ hash: createHash });

  const selectedNetwork = NETWORKS.find((n) => n.id === network);
  const tokenDecimals = selectedToken?.decimals || 18;
  const parsedAmount = useMemo(() => {
    try {
      return amount ? parseUnits(amount, tokenDecimals) : BigInt(0);
    } catch {
      return BigInt(0);
    }
  }, [amount, tokenDecimals]);

  const contractAddress = selectedNetwork
    ? CHAIN_CONFIG[selectedNetwork.chainId]?.contractAddress || CONTRACT
    : CONTRACT;

  const { data: protocolFee } = useReadContract({
    address: contractAddress as Address,
    abi: ESCROW_ABI,
    functionName: "calculateProtocolFee",
    args: [parsedAmount],
    query: { enabled: parsedAmount > BigInt(0) && !!contractAddress },
  });

  const milestonesTotal = useMemo(() => {
    return milestones.reduce((sum, m) => {
      try {
        return sum + parseUnits(m.amount || "0", tokenDecimals);
      } catch {
        return sum;
      }
    }, BigInt(0));
  }, [milestones, tokenDecimals]);

  const milestonesMatch = parsedAmount > BigInt(0) && milestonesTotal === parsedAmount;
  const minDeadline = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const needsChainSwitch = isConnected && selectedNetwork && currentChainId !== selectedNetwork.chainId;

  function addMilestone() {
    setMilestones((prev) => [...prev, { id: String(Date.now()), description: "", amount: "" }]);
  }

  function removeMilestone(id: string) {
    if (milestones.length <= 1) return;
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  }

  function updateMilestone(id: string, field: "description" | "amount", value: string) {
    setMilestones((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  }

  function distributeMilestonesEvenly() {
    if (!amount || milestones.length === 0) return;
    try {
      const total = parseUnits(amount, tokenDecimals);
      const perMilestone = total / BigInt(milestones.length);
      const remainder = total - perMilestone * BigInt(milestones.length);
      setMilestones((prev) =>
        prev.map((m, i) => ({
          ...m,
          amount: formatUnits(perMilestone + (i === 0 ? remainder : BigInt(0)), tokenDecimals),
        }))
      );
    } catch {}
  }

  async function handleGenerateWallet() {
    setIsGeneratingWallet(true);
    try {
      const jwt = localStorage.getItem("surveydeal_jwt");
      if (jwt) {
        const res = await fetch(`${API}/wallets/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ label: `Escrow Wallet ${Date.now()}` }),
        });
        const data = await res.json();
        if (data.wallet) {
          setGeneratedWallet(data.wallet);
          setCounterparty(data.wallet.address);
          return;
        }
      }
      const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      const w = { address: account.address, privateKey, mnemonic: undefined as string | undefined };
      setGeneratedWallet(w);
      setCounterparty(account.address);
    } catch (err) {
      console.error("Failed to generate wallet", err);
    } finally {
      setIsGeneratingWallet(false);
    }
  }

  function copyWalletText(text: string) {
    navigator.clipboard.writeText(text);
    setWalletCopied(text);
    setTimeout(() => setWalletCopied(""), 2000);
  }

  async function handleGenerateDepositWallet() {
    setIsGeneratingDeposit(true);
    try {
      const { generatePrivateKey, privateKeyToAccount } = await import("viem/accounts");
      const privateKey = generatePrivateKey();
      const account = privateKeyToAccount(privateKey);
      setDepositWallet({
        address: account.address,
        tokenSymbol: selectedToken?.symbol,
        expectedAmount: amount,
        chainId: selectedNetwork?.chainId,
      });
    } catch (err) {
      console.error("Failed to generate deposit wallet", err);
      setError("Failed to generate deposit address. Please try again.");
    } finally {
      setIsGeneratingDeposit(false);
    }
  }

  function copyDepositAddress() {
    if (!depositWallet) return;
    navigator.clipboard.writeText(depositWallet.address);
    setDepositCopied(true);
    setTimeout(() => setDepositCopied(false), 2500);
  }

  const canNext = () => {
    switch (step) {
      case 0:
        return role !== "" && network !== "";
      case 1:
        return selectedToken !== null && counterparty.length === 42 && (escrowMode === 0 || arbiterAddress.length === 42);
      case 2:
        return title.trim() !== "" && amount !== "" && parsedAmount > BigInt(0) && deadline !== "";
      case 3:
        return milestones.every((m) => m.description.trim() && m.amount) && milestonesMatch;
      default:
        return false;
    }
  };

  async function handleSwitchChain() {
    if (!selectedNetwork) return;
    try {
      switchChain({ chainId: selectedNetwork.chainId });
    } catch (err: any) {
      setError(`Failed to switch network: ${err.message}`);
    }
  }

  async function handleCreate() {
    if (!selectedToken || !address || !contractAddress) return;
    setError("");
    setIsCreating(true);

    try {
      const sellerAddr = role === "buyer" ? counterparty : address;
      const agreementHash = agreementText
        ? keccak256(toBytes(agreementText))
        : ("0x" + "0".repeat(64)) as `0x${string}`;
      const deadlineTs = BigInt(Math.floor(new Date(deadline).getTime() / 1000));
      const msDescs = milestones.map((m) => m.description);
      const msAmounts = milestones.map((m) => parseUnits(m.amount, tokenDecimals));

      writeApprove(
        {
          address: selectedToken.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [contractAddress as Address, parsedAmount],
        },
        {
          onSuccess(hash) {
            setApprovalHash(hash);
            setTimeout(() => {
              writeCreate(
                {
                  address: contractAddress as Address,
                  abi: ESCROW_ABI,
                  functionName: "createEscrow",
                  args: [
                    sellerAddr as Address,
                    selectedToken.address,
                    parsedAmount,
                    escrowMode,
                    escrowMode === 1 ? (arbiterAddress as Address) : zeroAddress,
                    agreementHash,
                    deadlineTs,
                    msDescs,
                    msAmounts,
                  ],
                },
                {
                  onSuccess(hash) {
                    setCreateHash(hash);
                    syncToBackend(hash);
                  },
                  onError(err) {
                    setError(err.message.split("\n")[0]);
                    setIsCreating(false);
                  },
                }
              );
            }, 3000);
          },
          onError(err) {
            setError(err.message.split("\n")[0]);
            setIsCreating(false);
          },
        }
      );
    } catch (err: any) {
      setError(err.message || "Transaction failed");
      setIsCreating(false);
    }
  }

  async function syncToBackend(txHash: string) {
    try {
      const jwt = localStorage.getItem("surveydeal_jwt");
      if (!jwt) return;
      await fetch(`${API}/escrows`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          onChainId: 0,
          chainId: selectedNetwork?.chainId || 31337,
          title,
          description,
          sellerAddress: role === "buyer" ? counterparty : address,
          arbiterAddress: escrowMode === 1 ? arbiterAddress : zeroAddress,
          tokenAddress: selectedToken?.address,
          totalAmount: parsedAmount.toString(),
          mode: escrowMode,
          agreementHash: agreementText ? keccak256(toBytes(agreementText)) : null,
          agreementText,
          deadline: Math.floor(new Date(deadline).getTime() / 1000),
          milestones: milestones.map((m) => ({ description: m.description, amount: parseUnits(m.amount, tokenDecimals).toString() })),
        }),
      });
    } catch {}
  }

  if (createDone) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Escrow Created!</h1>
          <p className="text-slate-400 mb-8">Your escrow has been deployed on {selectedNetwork?.name || "chain"}. You can now fund it.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push("/dashboard")} className="px-6 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors">
              Go to Dashboard
            </button>
            <button onClick={() => { window.location.reload(); }} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 transition-opacity">
              Create Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-[#080c14]/80 border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-white">Survey<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">deal</span></span>
          </a>
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-sm text-slate-400 hover:text-white transition-colors">Dashboard</a>
            <ConnectButton />
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Create New Escrow</h1>
        <p className="text-slate-400 mb-8">Set up a secure milestone-based escrow in 4 steps.</p>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${i < step ? "bg-emerald-500 text-white" : i === step ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white" : "bg-white/5 text-slate-500"}`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`ml-2 text-xs hidden sm:block ${i <= step ? "text-slate-200" : "text-slate-600"}`}>{label}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${i < step ? "bg-emerald-500" : "bg-white/10"}`} />}
            </div>
          ))}
        </div>

        {/* Step 0: Role & Network */}
        {step === 0 && (
          <div className="space-y-8 animate-in fade-in">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">What&apos;s your role?</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: "buyer", label: "I'm a Buyer", desc: "I want to pay for goods/services", icon: ShoppingCart },
                  { value: "seller", label: "I'm a Seller", desc: "I want to receive payment", icon: Store },
                ].map(({ value, label, desc, icon: Icon }) => (
                  <button key={value} onClick={() => setRole(value as "buyer" | "seller")} className={`p-6 rounded-xl border text-left transition-all ${role === value ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                    <Icon className={`w-8 h-8 mb-3 ${role === value ? "text-emerald-400" : "text-slate-500"}`} />
                    <h3 className="font-semibold text-white">{label}</h3>
                    <p className="text-sm text-slate-400 mt-1">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Select Network</h2>
              <div className="mb-3">
                <span className="text-xs text-slate-500 uppercase tracking-wider">EVM Chains</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {NETWORKS.filter((n) => n.type === "evm").map((net) => (
                  <button key={net.id} onClick={() => { setNetwork(net.id); setSelectedToken(null); }} className={`p-4 rounded-xl border text-left transition-all relative ${network === net.id ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{net.icon}</span>
                      <div>
                        <h3 className="font-medium text-white text-sm">{net.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          <span className="text-xs text-emerald-400">Live</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {NETWORKS.some((n) => n.type === "non-evm") && (
                <>
                  <div className="mt-6 mb-3">
                    <span className="text-xs text-slate-500 uppercase tracking-wider">Non-EVM Chains (Requires Separate Wallet)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {NETWORKS.filter((n) => n.type === "non-evm").map((net) => (
                      <div key={net.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.01] opacity-50">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{net.icon}</span>
                          <div>
                            <h3 className="font-medium text-white text-sm">{net.name}</h3>
                            <span className="text-xs text-slate-500">Coming Q3 2026</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Token & Counterparty */}
        {step === 1 && (
          <div className="space-y-8 animate-in fade-in">
            {/* Chain switch notice */}
            {needsChainSwitch && (
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-400 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  Switch your wallet to {selectedNetwork?.name}
                </div>
                <button onClick={handleSwitchChain} className="px-4 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 text-sm hover:bg-amber-500/30 transition-colors flex items-center gap-1">
                  <ArrowLeftRight className="w-3 h-3" /> Switch
                </button>
              </div>
            )}

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Select Token</h2>
              <div className="grid grid-cols-2 gap-3">
                {(TOKENS[network] || []).map((token) => (
                  <button key={token.address} onClick={() => setSelectedToken(token)} className={`p-4 rounded-xl border text-left transition-all ${selectedToken?.address === token.address ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Coins className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-white">{token.symbol}</h3>
                        <p className="text-xs text-slate-500">{token.name}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-sm text-slate-400 mb-1 block">Or paste custom token address (any ERC-20)</label>
                <input value={customToken} onChange={(e) => { setCustomToken(e.target.value); if (e.target.value.length === 42) setSelectedToken({ address: e.target.value as Address, symbol: "CUSTOM", name: "Custom Token", decimals: 18 }); }} placeholder="0x..." className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none" />
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">{role === "buyer" ? "Seller" : "Buyer"} Wallet Address</h2>
              <input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} placeholder="0x..." className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none" />
              {counterparty && counterparty.length !== 42 && <p className="text-red-400 text-xs mt-1">Invalid address (must be 42 characters)</p>}

              <div className="mt-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/5" />
                <span className="text-xs text-slate-500">or</span>
                <div className="h-px flex-1 bg-white/5" />
              </div>

              <button onClick={handleGenerateWallet} disabled={isGeneratingWallet} className="mt-3 w-full px-4 py-3 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {isGeneratingWallet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                Generate New Wallet for {role === "buyer" ? "Seller" : "Buyer"}
              </button>

              {generatedWallet && (
                <div className="mt-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Generated Wallet</span>
                    <button onClick={() => copyWalletText(generatedWallet.address)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                      {walletCopied === generatedWallet.address ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      Copy
                    </button>
                  </div>
                  <code className="text-xs text-emerald-300 font-mono break-all block">{generatedWallet.address}</code>
                  {generatedWallet.privateKey && (
                    <details className="mt-1">
                      <summary className="text-xs text-amber-400 cursor-pointer flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> Show Private Key (save this securely!)
                      </summary>
                      <div className="mt-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-amber-400 font-medium">Private Key</span>
                          <button onClick={() => copyWalletText(generatedWallet.privateKey!)} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                            {walletCopied === generatedWallet.privateKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                        <code className="text-xs text-amber-300 font-mono break-all block">{generatedWallet.privateKey}</code>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Escrow Mode</h2>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => setEscrowMode(0)} className={`p-5 rounded-xl border text-left transition-all ${escrowMode === 0 ? "border-emerald-500/50 bg-emerald-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                  <Lock className={`w-6 h-6 mb-2 ${escrowMode === 0 ? "text-emerald-400" : "text-slate-500"}`} />
                  <h3 className="font-medium text-white text-sm">Locked (2-of-2)</h3>
                  <p className="text-xs text-slate-400 mt-1">Both parties must agree</p>
                </button>
                <button onClick={() => setEscrowMode(1)} className={`p-5 rounded-xl border text-left transition-all ${escrowMode === 1 ? "border-blue-500/50 bg-blue-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                  <Users className={`w-6 h-6 mb-2 ${escrowMode === 1 ? "text-blue-400" : "text-slate-500"}`} />
                  <h3 className="font-medium text-white text-sm">Arbiter (2-of-3)</h3>
                  <p className="text-xs text-slate-400 mt-1">Neutral third party for disputes</p>
                </button>
              </div>
              {escrowMode === 1 && (
                <div className="mt-4">
                  <label className="text-sm text-slate-400 mb-1 block">Arbiter Wallet Address</label>
                  <input value={arbiterAddress} onChange={(e) => setArbiterAddress(e.target.value)} placeholder="0x..." className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Deal Details */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Escrow Title</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Website Design Project" className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Describe the deal..." className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Total Amount ({selectedToken?.symbol || "TOKEN"})</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" min="0" step="any" className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none" />
              {protocolFee !== undefined && parsedAmount > BigInt(0) && (
                <p className="text-xs text-slate-500 mt-1.5">
                  Protocol fee: {formatUnits(protocolFee, tokenDecimals)} {selectedToken?.symbol} (1%)
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Deadline</label>
              <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} min={minDeadline} className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white focus:border-emerald-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">Agreement Terms (optional)</label>
              <textarea value={agreementText} onChange={(e) => setAgreementText(e.target.value)} rows={4} placeholder="Describe the terms of agreement..." className="w-full px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none resize-none" />
              {agreementText && (
                <p className="text-xs text-slate-500 mt-1 font-mono">Hash: {keccak256(toBytes(agreementText)).slice(0, 18)}...</p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Milestones & Review */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Milestones</h2>
                <div className="flex gap-2">
                  <button onClick={distributeMilestonesEvenly} className="px-3 py-1.5 rounded-lg text-xs border border-white/10 text-slate-400 hover:bg-white/5 transition-colors">
                    Split Evenly
                  </button>
                  <button onClick={addMilestone} className="px-3 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {milestones.map((m, i) => (
                  <div key={m.id} className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">M{i + 1}</span>
                      {milestones.length > 1 && (
                        <button onClick={() => removeMilestone(m.id)} className="ml-auto text-slate-500 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <input value={m.description} onChange={(e) => updateMilestone(m.id, "description", e.target.value)} placeholder="Milestone description" className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 text-sm focus:border-emerald-500/50 focus:outline-none" />
                      </div>
                      <div>
                        <input type="number" value={m.amount} onChange={(e) => updateMilestone(m.id, "amount", e.target.value)} placeholder="Amount" min="0" step="any" className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white placeholder-slate-600 text-sm focus:border-emerald-500/50 focus:outline-none" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`mt-3 p-3 rounded-lg border text-sm ${milestonesMatch ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-amber-500/20 bg-amber-500/5 text-amber-400"}`}>
                Milestones total: {amount ? formatUnits(milestonesTotal, tokenDecimals) : "0"} / {amount || "0"} {selectedToken?.symbol}
                {milestonesMatch && <Check className="w-4 h-4 inline ml-2" />}
              </div>
            </div>

            {/* Review Summary */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Review</h2>
              <div className="p-5 rounded-xl border border-white/5 bg-white/[0.02] space-y-3 text-sm">
                <Row label="Role" value={role === "buyer" ? "Buyer" : "Seller"} />
                <Row label="Network" value={selectedNetwork?.name || ""} />
                <Row label="Token" value={`${selectedToken?.symbol} (${selectedToken?.name})`} />
                <Row label={role === "buyer" ? "Seller" : "Buyer"} value={`${counterparty.slice(0, 6)}...${counterparty.slice(-4)}`} />
                <Row label="Mode" value={escrowMode === 0 ? "Locked (2-of-2)" : "Arbiter (2-of-3)"} />
                <Row label="Title" value={title} />
                <Row label="Amount" value={`${amount} ${selectedToken?.symbol}`} />
                {protocolFee !== undefined && <Row label="Protocol Fee" value={`${formatUnits(protocolFee, tokenDecimals)} ${selectedToken?.symbol}`} />}
                <Row label="Deadline" value={deadline} />
                <Row label="Milestones" value={`${milestones.length} milestone(s)`} />
              </div>
            </div>

            {/* Live Price Calculator */}
            <PriceCalculator tokenSymbol={selectedToken?.symbol || "USDC"} amount={amount} protocolFeePct={1} />

            {error && (
              <div className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Two-Layer Funding Choice */}
            <div>
              <h2 className="text-lg font-semibold text-white mb-3">Choose Funding Method</h2>
              <p className="text-xs text-slate-500 mb-4">Select how you want to fund this escrow.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Layer A: Wallet Direct */}
                <button
                  onClick={() => { setFundingMethod("wallet"); setDepositWallet(null); }}
                  className={`p-4 rounded-xl border text-left transition-all ${fundingMethod === "wallet" ? "border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${fundingMethod === "wallet" ? "bg-emerald-500/20" : "bg-white/5"}`}>
                      <Wallet className={`w-4 h-4 ${fundingMethod === "wallet" ? "text-emerald-400" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${fundingMethod === "wallet" ? "text-emerald-400" : "text-white"}`}>Connect Wallet</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Layer A</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sign and execute the escrow smart contract directly from your connected wallet (MetaMask, Phantom, etc).
                  </p>
                </button>

                {/* Layer B: Direct Transfer */}
                <button
                  onClick={() => setFundingMethod("deposit")}
                  className={`p-4 rounded-xl border text-left transition-all ${fundingMethod === "deposit" ? "border-blue-500/40 bg-blue-500/5 ring-1 ring-blue-500/20" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${fundingMethod === "deposit" ? "bg-blue-500/20" : "bg-white/5"}`}>
                      <Send className={`w-4 h-4 ${fundingMethod === "deposit" ? "text-blue-400" : "text-slate-400"}`} />
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${fundingMethod === "deposit" ? "text-blue-400" : "text-white"}`}>Direct Transfer</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Layer B</div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    No wallet connection needed. Send funds from any exchange or external wallet to a unique deposit address.
                  </p>
                </button>
              </div>
            </div>

            {/* Layer A: Connected Wallet Execution */}
            {fundingMethod === "wallet" && (
              <div className="space-y-3 animate-in fade-in">
                {!isConnected ? (
                  <div className="w-full p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 text-amber-400 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      Connect your wallet to create this escrow on-chain
                    </div>
                    <ConnectButton />
                  </div>
                ) : needsChainSwitch ? (
                  <button onClick={handleSwitchChain} className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
                    <ArrowLeftRight className="w-5 h-5" />
                    Switch to {selectedNetwork?.name}
                  </button>
                ) : (
                  <button onClick={handleCreate} disabled={isCreating || isApproving || isConfirming} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
                    {isCreating || isApproving || isConfirming ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {isApproving ? "Approving Token..." : isConfirming ? "Creating Escrow..." : "Processing..."}
                      </>
                    ) : (
                      <>
                        <Shield className="w-5 h-5" />
                        Create Escrow On-Chain
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Layer B: Direct Transfer / Deposit Address */}
            {fundingMethod === "deposit" && (
              <div className="space-y-4 animate-in fade-in">
                {!depositWallet ? (
                  <div className="p-5 rounded-xl border border-blue-500/20 bg-blue-500/5 text-center space-y-4">
                    <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
                      <QrCode className="w-7 h-7 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white mb-1">Generate Deposit Address</h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        A unique wallet address will be created for this escrow. Send your {selectedToken?.symbol} tokens to this address from any wallet or exchange.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateDepositWallet}
                      disabled={isGeneratingDeposit}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-2"
                    >
                      {isGeneratingDeposit ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          Generate Deposit Address
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 overflow-hidden">
                    <div className="p-4 border-b border-blue-500/10">
                      <div className="flex items-center gap-2 mb-1">
                        <Check className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-sm font-semibold text-white">Deposit Address Generated</h3>
                      </div>
                      <p className="text-xs text-slate-400">Send your tokens to the address below.</p>
                    </div>

                    <div className="p-4 space-y-4">
                      {/* QR Code Placeholder Area */}
                      <div className="flex justify-center">
                        <div className="w-40 h-40 rounded-xl bg-white p-3 flex items-center justify-center">
                          <div className="w-full h-full bg-[#080c14] rounded-lg flex flex-col items-center justify-center gap-2">
                            <QrCode className="w-10 h-10 text-blue-400" />
                            <span className="text-[8px] text-slate-400 text-center px-2">Scan to get address</span>
                          </div>
                        </div>
                      </div>

                      {/* Deposit Address */}
                      <div>
                        <label className="text-xs text-slate-500 uppercase tracking-wider block mb-1.5">Deposit Address</label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 px-3 py-2.5 rounded-lg bg-[#080c14] border border-white/10 font-mono text-xs text-blue-300 break-all select-all">
                            {depositWallet.address}
                          </div>
                          <button
                            onClick={copyDepositAddress}
                            className={`shrink-0 px-3 py-2.5 rounded-lg border transition-all ${depositCopied ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
                          >
                            {depositCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Transfer Instructions */}
                      <div className="p-3 rounded-lg bg-[#080c14] border border-white/5 space-y-2">
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          Transfer Instructions
                        </div>
                        <div className="space-y-1.5 text-xs text-slate-400">
                          <div className="flex justify-between">
                            <span>Network:</span>
                            <span className="text-white font-medium">{selectedNetwork?.name}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Token:</span>
                            <span className="text-white font-medium">{selectedToken?.symbol} ({selectedToken?.name})</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Exact Amount:</span>
                            <span className="text-emerald-400 font-bold">{amount} {selectedToken?.symbol}</span>
                          </div>
                          {protocolFee !== undefined && (
                            <div className="flex justify-between">
                              <span>Protocol Fee (1%):</span>
                              <span className="text-slate-300">{formatUnits(protocolFee, tokenDecimals)} {selectedToken?.symbol}</span>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 mt-2 border-t border-white/5">
                          <div className="flex items-start gap-1.5">
                            <AlertCircle className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-red-400/80 leading-relaxed">
                              Only send <strong>{selectedToken?.symbol}</strong> on the <strong>{selectedNetwork?.name}</strong> network. Sending any other token or using the wrong network will result in permanent loss of funds.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-center">
                        <p className="text-xs text-emerald-400">
                          Once your deposit is confirmed on-chain, the escrow will be activated and the admin will review for release approval.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-10 pt-6 border-t border-white/5">
          <button onClick={() => step > 0 ? setStep(step - 1) : router.push("/")} className="px-5 py-2.5 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Home" : "Back"}
          </button>
          {step < 3 && (
            <button onClick={() => setStep(step + 1)} disabled={!canNext()} className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-30 flex items-center gap-2">
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
