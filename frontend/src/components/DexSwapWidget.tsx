"use client";

import { useState, useMemo } from "react";
import { useAccount, useChainId } from "wagmi";
import {
  ArrowDownUp,
  ExternalLink,
  AlertCircle,
  Globe,
  Zap,
} from "lucide-react";

interface DexConfig {
  name: string;
  chainIds: number[];
  getSwapUrl: (params: { chainId: number; inputToken?: string; outputToken?: string }) => string;
  description: string;
}

const DEX_AGGREGATORS: DexConfig[] = [
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
    description: "Top BNB Chain DEX — also on Ethereum, Arbitrum, Base",
  },
  {
    name: "1inch",
    chainIds: [1, 56, 42161, 137, 10, 8453, 43114],
    getSwapUrl: ({ chainId, inputToken, outputToken }) => {
      const chainName = get1inchChainName(chainId);
      const base = `https://app.1inch.io/#/${chainName}/simple/swap`;
      if (inputToken && outputToken) return `${base}/${inputToken}/${outputToken}`;
      return base;
    },
    description: "Multi-chain aggregator — finds best rates across 400+ liquidity sources",
  },
  {
    name: "ParaSwap",
    chainIds: [1, 56, 42161, 137, 10, 8453, 43114],
    getSwapUrl: ({ chainId, inputToken, outputToken }) => {
      const base = "https://app.paraswap.io";
      const params = new URLSearchParams();
      if (chainId) params.set("network", chainId.toString());
      if (inputToken) params.set("from", inputToken);
      if (outputToken) params.set("to", outputToken);
      return params.toString() ? `${base}?${params}` : `${base}?network=${chainId || 1}`;
    },
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
  const map: Record<number, string> = { 1: "1", 56: "56", 42161: "42161", 137: "137", 10: "10", 8453: "8453", 43114: "43114" };
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
  43114: "Avalanche",
  250: "Fantom",
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
    window.open(
      dex.getSwapUrl({ chainId: selectedChainId, inputToken, outputToken }),
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-accent flex items-center justify-center">
          <ArrowDownUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-base font-heading font-extrabold text-text">DEX Swap</h3>
          <p className="text-xs opacity-60">Swap tokens via live DEX aggregators</p>
        </div>
      </div>

      {/* Chain Selector */}
      <div>
        <label className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-2 block">Network</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(CHAIN_NAMES).map(([id, name]) => (
            <button
              key={id}
              onClick={() => { setSelectedChainId(Number(id)); setSelectedDex(null); }}
              className={`px-3 py-1.5 text-xs font-semibold transition-colors border-2 ${
                selectedChainId === Number(id)
                  ? "bg-accent text-white border-accent"
                  : "bg-transparent border-divider text-text hover:border-accent"
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
            <label className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-1.5 block">From Token</label>
            <div className="flex flex-wrap gap-1.5">
              {tokens.map((t) => (
                <button
                  key={`from-${t.address}`}
                  onClick={() => setInputToken(t.address)}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors border-2 ${
                    inputToken === t.address
                      ? "bg-accent text-white border-accent"
                      : "bg-transparent border-divider text-text hover:border-accent"
                  }`}
                >
                  {t.symbol}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-1.5 block">To Token</label>
            <div className="flex flex-wrap gap-1.5">
              {tokens.map((t) => (
                <button
                  key={`to-${t.address}`}
                  onClick={() => setOutputToken(t.address)}
                  className={`px-2.5 py-1 text-xs font-semibold transition-colors border-2 ${
                    outputToken === t.address
                      ? "bg-accent text-white border-accent"
                      : "bg-transparent border-divider text-text hover:border-accent"
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
          <label className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-1 block">Custom From Address</label>
          <input
            value={inputToken.startsWith("0xEeee") ? "" : inputToken}
            onChange={(e) => setInputToken(e.target.value)}
            placeholder="0x... (any token)"
            className="sd-input w-full font-mono text-xs"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-1 block">Custom To Address</label>
          <input
            value={outputToken.startsWith("0xEeee") ? "" : outputToken}
            onChange={(e) => setOutputToken(e.target.value)}
            placeholder="0x... (memecoin, any ERC-20)"
            className="sd-input w-full font-mono text-xs"
          />
        </div>
      </div>

      {/* Available DEX Aggregators */}
      <div>
        <label className="text-xs uppercase tracking-wider font-semibold opacity-50 mb-3 block flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-accent" />
          Available on {CHAIN_NAMES[selectedChainId]}
        </label>

        {availableDexes.length === 0 ? (
          <div className="p-6 border-2 border-divider text-center">
            <AlertCircle className="w-8 h-8 opacity-30 mx-auto mb-2" />
            <p className="text-sm opacity-60">No DEX aggregators available for this network.</p>
            <p className="text-xs opacity-40 mt-1">Try Ethereum, BNB Chain, or Arbitrum.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {availableDexes.map((dex) => (
              <button
                key={dex.name}
                onClick={() => handleOpenDex(dex)}
                className="w-full flex items-center justify-between p-4 border-2 border-divider -mt-[2px] first:mt-0 bg-bg hover:border-accent transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-accent flex items-center justify-center text-white flex-shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-heading font-extrabold text-sm text-text">{dex.name}</p>
                    <p className="text-xs opacity-50">{dex.description}</p>
                  </div>
                </div>
                <ExternalLink className="w-4 h-4 opacity-30 group-hover:text-accent group-hover:opacity-100 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-2 border-divider bg-surface">
        <p className="text-xs opacity-50 leading-relaxed">
          Swaps open in the DEX aggregator&apos;s official interface. You trade directly with the DEX using your connected wallet — SurveyDeal never touches your swap funds. Supports all tokens including memecoins and tax tokens.
        </p>
      </div>
    </div>
  );
}
