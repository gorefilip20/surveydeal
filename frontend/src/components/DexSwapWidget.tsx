"use client";

import { useState, useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  ArrowDownUp,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Globe,
  Zap,
} from "lucide-react";

interface DexConfig {
  name: string;
  chainIds: number[];
  getSwapUrl: (params: { chainId: number; inputToken?: string; outputToken?: string }) => string;
  color: string;
  description: string;
}

const DEX_AGGREGATORS: DexConfig[] = [
  {
    name: "Jupiter",
    chainIds: [0],
    getSwapUrl: ({ inputToken, outputToken }) => {
      const base = "https://jup.ag/swap";
      const params = new URLSearchParams();
      if (inputToken) params.set("inputMint", inputToken);
      if (outputToken) params.set("outputMint", outputToken);
      return params.toString() ? `${base}?${params}` : base;
    },
    color: "from-green-400 to-emerald-500",
    description: "Solana DEX aggregator — best rates across all Solana DEXs",
  },
  {
    name: "Uniswap",
    chainIds: [1, 42161, 8453, 137, 10],
    getSwapUrl: ({ chainId, inputToken, outputToken }) => {
      const base = "https://app.uniswap.org/swap";
      const params = new URLSearchParams();
      if (chainId) params.set("chain", getUniswapChainName(chainId));
      if (inputToken) params.set("inputCurrency", inputToken);
      if (outputToken) params.set("outputCurrency", outputToken);
      return params.toString() ? `${base}?${params}` : base;
    },
    color: "from-pink-400 to-purple-500",
    description: "Leading EVM DEX — Ethereum, Arbitrum, Base, Polygon, Optimism",
  },
  {
    name: "PancakeSwap",
    chainIds: [56, 1, 42161, 8453],
    getSwapUrl: ({ chainId, inputToken, outputToken }) => {
      const base = "https://pancakeswap.finance/swap";
      const params = new URLSearchParams();
      if (inputToken) params.set("inputCurrency", inputToken);
      if (outputToken) params.set("outputCurrency", outputToken);
      if (chainId) params.set("chain", getPancakeChainName(chainId));
      return params.toString() ? `${base}?${params}` : base;
    },
    color: "from-amber-400 to-yellow-500",
    description: "Top BNB Chain DEX — also on Ethereum, Arbitrum, Base",
  },
  {
    name: "1inch",
    chainIds: [1, 56, 42161, 137, 10, 8453],
    getSwapUrl: ({ chainId, inputToken, outputToken }) => {
      const chainName = get1inchChainName(chainId);
      const base = `https://app.1inch.io/#/${chainName}/simple/swap`;
      if (inputToken && outputToken) return `${base}/${inputToken}/${outputToken}`;
      return base;
    },
    color: "from-blue-400 to-indigo-500",
    description: "Multi-chain aggregator — finds best rates across 400+ liquidity sources",
  },
  {
    name: "ParaSwap",
    chainIds: [1, 56, 42161, 137, 10, 8453],
    getSwapUrl: ({ chainId, inputToken, outputToken }) => {
      const base = "https://app.paraswap.io";
      const params = new URLSearchParams();
      if (chainId) params.set("network", chainId.toString());
      if (inputToken) params.set("from", inputToken);
      if (outputToken) params.set("to", outputToken);
      return params.toString() ? `${base}?${params}` : `${base}?network=${chainId || 1}`;
    },
    color: "from-cyan-400 to-blue-500",
    description: "Advanced multi-chain aggregator with MEV protection",
  },
];

function getUniswapChainName(chainId: number): string {
  const map: Record<number, string> = { 1: "ethereum", 42161: "arbitrum", 8453: "base", 137: "polygon", 10: "optimism" };
  return map[chainId] || "ethereum";
}

function getPancakeChainName(chainId: number): string {
  const map: Record<number, string> = { 56: "bsc", 1: "eth", 42161: "arb", 8453: "base" };
  return map[chainId] || "bsc";
}

function get1inchChainName(chainId: number): string {
  const map: Record<number, string> = { 1: "1", 56: "56", 42161: "42161", 137: "137", 10: "10", 8453: "8453" };
  return map[chainId] || "1";
}

const POPULAR_TOKENS: Record<number, { address: string; symbol: string }[]> = {
  1: [
    { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH" },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC" },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT" },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI" },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH" },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC" },
    { address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", symbol: "SHIB" },
    { address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933", symbol: "PEPE" },
  ],
  56: [
    { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "BNB" },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC" },
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT" },
    { address: "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol: "BUSD" },
    { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB" },
    { address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol: "ETH" },
  ],
  42161: [
    { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH" },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC" },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT" },
    { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH" },
    { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB" },
  ],
  8453: [
    { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH" },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC" },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH" },
  ],
  137: [
    { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "MATIC" },
    { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC" },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT" },
    { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WMATIC" },
  ],
  10: [
    { address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH" },
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC" },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT" },
    { address: "0x4200000000000000000000000000000000000006", symbol: "WETH" },
    { address: "0x4200000000000000000000000000000000000042", symbol: "OP" },
  ],
};

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum",
  56: "BNB Chain",
  42161: "Arbitrum",
  8453: "Base",
  137: "Polygon",
  10: "Optimism",
  31337: "Local Testnet",
};

interface DexSwapWidgetProps {
  defaultChainId?: number;
  defaultOutputToken?: string;
}

export default function DexSwapWidget({ defaultChainId, defaultOutputToken }: DexSwapWidgetProps) {
  const { isConnected } = useAccount();
  const walletChainId = useChainId();
  const activeChainId = defaultChainId || walletChainId || 1;

  const [selectedChainId, setSelectedChainId] = useState(activeChainId);
  const [inputToken, setInputToken] = useState("");
  const [outputToken, setOutputToken] = useState(defaultOutputToken || "");
  const [selectedDex, setSelectedDex] = useState<string | null>(null);

  const availableDexes = useMemo(
    () => DEX_AGGREGATORS.filter((d) => d.chainIds.includes(selectedChainId)),
    [selectedChainId]
  );

  const tokens = POPULAR_TOKENS[selectedChainId] || [];

  const handleOpenDex = (dex: DexConfig) => {
    const url = dex.getSwapUrl({ chainId: selectedChainId, inputToken, outputToken });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <ArrowDownUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">DEX Swap</h2>
            <p className="text-xs text-slate-400">Swap tokens via live DEX aggregators</p>
          </div>
        </div>
      </div>

      {/* Chain Selector */}
      <div>
        <label className="text-sm font-medium text-slate-300 mb-2 block">Network</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CHAIN_NAMES)
            .filter(([id]) => Number(id) !== 31337)
            .map(([id, name]) => (
              <button
                key={id}
                onClick={() => { setSelectedChainId(Number(id)); setSelectedDex(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedChainId === Number(id)
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/[0.03] text-slate-400 border border-white/5 hover:bg-white/[0.06]"
                }`}
              >
                {name}
              </button>
            ))}
        </div>
      </div>

      {/* Quick Token Selection */}
      {tokens.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">From Token</label>
            <div className="flex flex-wrap gap-1.5">
              {tokens.map((t) => (
                <button
                  key={`from-${t.address}`}
                  onClick={() => setInputToken(t.address)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                    inputToken === t.address
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-white/[0.03] text-slate-400 border border-white/5 hover:bg-white/[0.06]"
                  }`}
                >
                  {t.symbol}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">To Token</label>
            <div className="flex flex-wrap gap-1.5">
              {tokens.map((t) => (
                <button
                  key={`to-${t.address}`}
                  onClick={() => setOutputToken(t.address)}
                  className={`px-2.5 py-1 rounded-md text-xs transition-all ${
                    outputToken === t.address
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                      : "bg-white/[0.03] text-slate-400 border border-white/5 hover:bg-white/[0.06]"
                  }`}
                >
                  {t.symbol}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Custom Token Input */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Custom From Address</label>
          <input
            value={inputToken.startsWith("0xEeee") ? "" : inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="0x... (any token)"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs placeholder-slate-600 focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Custom To Address</label>
          <input
            value={outputToken.startsWith("0xEeee") ? "" : outputToken}
            onChange={(e) => setOutputToken(e.target.value)}
            placeholder="0x... (memecoin, any ERC-20)"
            className="w-full px-3 py-2 rounded-lg bg-white/[0.03] border border-white/10 text-white text-xs placeholder-slate-600 focus:border-purple-500/50 focus:outline-none"
          />
        </div>
      </div>

      {/* Available DEX Aggregators */}
      <div>
        <label className="text-sm font-medium text-slate-300 mb-3 block flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Available DEX Aggregators on {CHAIN_NAMES[selectedChainId]}
        </label>

        {availableDexes.length === 0 ? (
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center">
            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No DEX aggregators available for this network.</p>
            <p className="text-xs text-slate-500 mt-1">Try Ethereum, BNB Chain, or Arbitrum.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {availableDexes.map((dex) => (
              <button
                key={dex.name}
                onClick={() => handleOpenDex(dex)}
                className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${dex.color} flex items-center justify-center`}>
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-sm">{dex.name}</h3>
                      <p className="text-xs text-slate-400">{dex.description}</p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 transition-colors" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/30">
        <p className="text-xs text-slate-500 leading-relaxed">
          Swaps open in the DEX aggregator&apos;s official interface. You trade directly with the DEX using your connected wallet — Surveydeal never touches your swap funds. Supports all tokens including memecoins and tax tokens.
        </p>
      </div>
    </div>
  );
}
