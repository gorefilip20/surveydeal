"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, TrendingUp, TrendingDown, DollarSign, AlertCircle } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface PriceData {
  [coin: string]: {
    usd?: number;
    usd_24h_change?: number;
    eur?: number;
    gbp?: number;
    btc?: number;
    eth?: number;
    usd_market_cap?: number;
  };
}

const COIN_IDS: Record<string, { id: string; symbol: string; name: string }> = {
  ethereum: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  bitcoin: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  binancecoin: { id: "binancecoin", symbol: "BNB", name: "BNB" },
  "matic-network": { id: "matic-network", symbol: "MATIC", name: "Polygon" },
  solana: { id: "solana", symbol: "SOL", name: "Solana" },
  "usd-coin": { id: "usd-coin", symbol: "USDC", name: "USD Coin" },
  tether: { id: "tether", symbol: "USDT", name: "Tether" },
  dai: { id: "dai", symbol: "DAI", name: "Dai" },
};

const PROTOCOL_FEE_BPS = 100;

interface PriceCalculatorProps {
  tokenSymbol?: string;
  amount?: string;
  protocolFeePct?: number;
  compact?: boolean;
}

export default function PriceCalculator({
  tokenSymbol = "USDC",
  amount = "",
  protocolFeePct,
  compact = false,
}: PriceCalculatorProps) {
  const [prices, setPrices] = useState<PriceData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const ids = Object.keys(COIN_IDS).join(",");
      const res = await fetch(`${API}/prices?ids=${ids}&vs=usd,eur,gbp,btc,eth`);
      if (!res.ok) throw new Error(`Price API error: ${res.status}`);
      const data: PriceData = await res.json();
      setPrices(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || "Failed to fetch prices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  const feePct = protocolFeePct ?? PROTOCOL_FEE_BPS / 100;
  const numericAmount = parseFloat(amount) || 0;
  const feeAmount = numericAmount * (feePct / 100);
  const totalWithFee = numericAmount + feeAmount;

  const isStable = ["USDC", "USDT", "DAI", "BUSD"].includes(tokenSymbol.toUpperCase());
  const stableUsdValue = isStable ? 1 : 0;

  function getTokenUsdPrice(): number {
    if (isStable) return 1;
    const symToCoingecko: Record<string, string> = {
      ETH: "ethereum",
      WETH: "ethereum",
      BTC: "bitcoin",
      WBTC: "bitcoin",
      BNB: "binancecoin",
      WBNB: "binancecoin",
      MATIC: "matic-network",
      WMATIC: "matic-network",
      SOL: "solana",
    };
    const cgId = symToCoingecko[tokenSymbol.toUpperCase()];
    if (cgId && prices[cgId]?.usd) return prices[cgId].usd!;
    return 0;
  }

  const tokenUsd = getTokenUsdPrice();
  const totalUsd = numericAmount * (tokenUsd || stableUsdValue);
  const totalUsdWithFee = totalWithFee * (tokenUsd || stableUsdValue);

  function convertTo(targetCoin: string): string {
    if (!totalUsdWithFee || totalUsdWithFee === 0) return "0.00";
    const targetPrice = prices[targetCoin]?.usd;
    if (!targetPrice || targetPrice === 0) return "N/A";
    return (totalUsdWithFee / targetPrice).toFixed(6);
  }

  if (compact) {
    return (
      <div className="p-3 rounded-lg border border-white/5 bg-white/[0.02]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-500 uppercase tracking-wider">Live Value</span>
          <button onClick={fetchPrices} disabled={loading} className="text-slate-500 hover:text-emerald-400 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {numericAmount > 0 && (tokenUsd > 0 || isStable) ? (
          <div className="space-y-1">
            <div className="text-lg font-bold text-white">${totalUsdWithFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-xs text-slate-500">
              {numericAmount} {tokenSymbol} + {feePct}% fee
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500">Enter amount to see value</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden">
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Live Price Calculator</h3>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-600">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button onClick={fetchPrices} disabled={loading} className="text-slate-500 hover:text-emerald-400 transition-colors p-1 rounded">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-500/5 border-b border-red-500/10 flex items-center gap-2">
          <AlertCircle className="w-3 h-3 text-red-400" />
          <span className="text-xs text-red-400">{error}</span>
        </div>
      )}

      <div className="p-4 space-y-4">
        {numericAmount > 0 && (tokenUsd > 0 || isStable) ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="text-xs text-slate-500 mb-1">Deal Amount</div>
                <div className="text-base font-bold text-white">{numericAmount.toLocaleString()} {tokenSymbol}</div>
                <div className="text-xs text-slate-400">${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
              <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                <div className="text-xs text-emerald-400/70 mb-1">Total with Fee ({feePct}%)</div>
                <div className="text-base font-bold text-emerald-400">{totalWithFee.toLocaleString()} {tokenSymbol}</div>
                <div className="text-xs text-emerald-400/60">${totalUsdWithFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Cross-Currency Equivalents</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { coin: "ethereum", sym: "ETH" },
                  { coin: "bitcoin", sym: "BTC" },
                  { coin: "binancecoin", sym: "BNB" },
                  { coin: "matic-network", sym: "MATIC" },
                  { coin: "solana", sym: "SOL" },
                ].map(({ coin, sym }) => (
                  <div key={coin} className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                    <div className="text-xs text-slate-500 mb-0.5">{sym}</div>
                    <div className="text-sm font-mono text-slate-200">{convertTo(coin)}</div>
                  </div>
                ))}
                <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 text-center">
                  <div className="text-xs text-slate-500 mb-0.5">EUR</div>
                  <div className="text-sm font-mono text-slate-200">
                    {prices.tether?.eur ? (totalUsdWithFee * (prices.tether.eur || 0.92)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-6 text-slate-500 text-sm">
            Enter an amount to calculate cross-currency values
          </div>
        )}

        <div>
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Market Prices</div>
          <div className="space-y-1.5">
            {Object.entries(COIN_IDS).filter(([id]) => !!prices[id]).map(([id, info]) => {
              const p = prices[id];
              if (!p?.usd) return null;
              const change = p.usd_24h_change || 0;
              const isUp = change >= 0;
              return (
                <div key={id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300 w-12">{info.symbol}</span>
                    <span className="text-xs text-slate-500">{info.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-slate-200">
                      ${p.usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: p.usd < 1 ? 4 : 2 })}
                    </span>
                    <span className={`text-[10px] flex items-center gap-0.5 ${isUp ? "text-emerald-400" : "text-red-400"}`}>
                      {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(change).toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
