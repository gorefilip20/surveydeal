import { Router, Request, Response } from "express";
import { apiLimiter } from "../middleware/rateLimiter";

const router = Router();

router.use(apiLimiter);

// ── Cache ────────────────────────────────────────────
interface CacheEntry {
  data: any;
  ts: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 30_000; // 30 seconds
const PRICE_CACHE_TTL = 15_000; // 15 seconds for prices

function getCache(key: string, ttl = CACHE_TTL): any | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data;
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, ts: Date.now() });
}

// ── DexScreener Base URL ─────────────────────────────
const DEXSCREENER_BASE = "https://api.dexscreener.com";

// ══════════════════════════════════════════════════════
//  TOKEN SEARCH
//  GET /api/dexscreener/search?q=PEPE&chain=bsc
// ══════════════════════════════════════════════════════

router.get("/search", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || "";
    const chain = req.query.chain as string | undefined;

    if (!query || query.length < 2) {
      res.json({ pairs: [], tokens: [] });
      return;
    }

    const cacheKey = `search:${query}:${chain || "all"}`;
    const cached = getCache(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    // Use DexScreener search endpoint
    const url = `${DEXSCREENER_BASE}/dex/search/v1/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "DexScreener API error" });
      return;
    }

    const data: any = await response.json();
    let pairs = data.pairs || [];

    // Filter by chain if specified
    if (chain) {
      const chainMap: Record<string, string> = {
        ethereum: "ethereum",
        bsc: "bsc",
        polygon: "polygon",
        arbitrum: "arbitrum",
        base: "base",
        avalanche: "avalanche",
        optimism: "optimism",
        fantom: "fantom",
        solana: "solana",
        tron: "tron",
      };
      const dexChain = chainMap[chain.toLowerCase()] || chain.toLowerCase();
      pairs = pairs.filter((p: any) => p.chainId === dexChain);
    }

    // Deduplicate by base token address
    const seen = new Set<string>();
    const uniquePairs: any[] = [];
    for (const pair of pairs) {
      const key = pair.baseToken?.address;
      if (key && !seen.has(key)) {
        seen.add(key);
        uniquePairs.push(pair);
      }
    }

    // Format response
    const result = {
      pairs: uniquePairs.slice(0, 20).map((p: any) => ({
        chainId: p.chainId,
        dexId: p.dexId,
        pairAddress: p.pairAddress,
        baseToken: {
          address: p.baseToken?.address,
          name: p.baseToken?.name,
          symbol: p.baseToken?.symbol,
        },
        quoteToken: {
          address: p.quoteToken?.address,
          name: p.quoteToken?.name,
          symbol: p.quoteToken?.symbol,
        },
        price: p.priceUsd ? parseFloat(p.priceUsd) : null,
        priceNative: p.priceNative ? parseFloat(p.priceNative) : null,
        volume24h: p.volume?.h24 || 0,
        volume6h: p.volume?.h6 || 0,
        volume1h: p.volume?.h1 || 0,
        priceChange24h: p.priceChange?.h24 || 0,
        priceChange6h: p.priceChange?.h6 || 0,
        priceChange1h: p.priceChange?.h1 || 0,
        liquidity: p.liquidity?.usd || 0,
        fdv: p.fdv || 0,
        marketCap: p.marketCap || 0,
        pairCreatedAt: p.pairCreatedAt,
        url: p.url,
        info: {
          imageUrl: p.info?.imageUrl,
          websites: p.info?.websites || [],
          socials: p.info?.socials || [],
        },
      })),
      total: uniquePairs.length,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    console.error("[DEXSCREENER SEARCH]", err.message);
    res.status(500).json({ error: "Failed to search tokens" });
  }
});

// ══════════════════════════════════════════════════════
//  TOKEN PAIR DATA
//  GET /api/dexscreener/pair/:chainId/:pairAddress
// ══════════════════════════════════════════════════════

router.get("/pair/:chainId/:pairAddress", async (req: Request, res: Response) => {
  try {
    const { chainId, pairAddress } = req.params;
    const cacheKey = `pair:${chainId}:${pairAddress}`;
    const cached = getCache(cacheKey, PRICE_CACHE_TTL);
    if (cached) {
      res.json(cached);
      return;
    }

    const url = `${DEXSCREENER_BASE}/token-pairs/v1/${chainId}/${pairAddress}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Pair not found" });
      return;
    }

    const data = await response.json();
    const pair = Array.isArray(data) ? data[0] : data;

    if (!pair) {
      res.status(404).json({ error: "Pair not found" });
      return;
    }

    const result = {
      chainId: pair.chainId,
      dexId: pair.dexId,
      pairAddress: pair.pairAddress,
      baseToken: pair.baseToken,
      quoteToken: pair.quoteToken,
      price: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
      priceNative: pair.priceNative ? parseFloat(pair.priceNative) : null,
      volume: pair.volume,
      priceChange: pair.priceChange,
      liquidity: pair.liquidity,
      fdv: pair.fdv,
      marketCap: pair.marketCap,
      pairCreatedAt: pair.pairCreatedAt,
      url: pair.url,
      info: pair.info,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    console.error("[DEXSCREENER PAIR]", err.message);
    res.status(500).json({ error: "Failed to fetch pair data" });
  }
});

// ══════════════════════════════════════════════════════
//  TOKEN DATA BY ADDRESS
//  GET /api/dexscreener/token/:chainId/:tokenAddress
// ══════════════════════════════════════════════════════

router.get("/token/:chainId/:tokenAddress", async (req: Request, res: Response) => {
  try {
    const { chainId, tokenAddress } = req.params;
    const cacheKey = `token:${chainId}:${tokenAddress}`;
    const cached = getCache(cacheKey, PRICE_CACHE_TTL);
    if (cached) {
      res.json(cached);
      return;
    }

    const url = `${DEXSCREENER_BASE}/tokens/v1/${chainId}/${tokenAddress}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Token not found" });
      return;
    }

    const data = await response.json();
    const pairs = Array.isArray(data) ? data : [data];

    // Find the most liquid pair
    const bestPair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];

    if (!bestPair) {
      res.status(404).json({ error: "No pairs found for this token" });
      return;
    }

    const result = {
      token: bestPair.baseToken,
      chainId: bestPair.chainId,
      price: bestPair.priceUsd ? parseFloat(bestPair.priceUsd) : null,
      volume24h: bestPair.volume?.h24 || 0,
      priceChange24h: bestPair.priceChange?.h24 || 0,
      liquidity: bestPair.liquidity?.usd || 0,
      fdv: bestPair.fdv || 0,
      marketCap: bestPair.marketCap || 0,
      pairs: pairs.length,
      bestPair: {
        dexId: bestPair.dexId,
        pairAddress: bestPair.pairAddress,
        quoteToken: bestPair.quoteToken?.symbol,
      },
      url: bestPair.url,
      info: bestPair.info,
    };

    setCache(cacheKey, result);
    res.json(result);
  } catch (err: any) {
    console.error("[DEXSCREENER TOKEN]", err.message);
    res.status(500).json({ error: "Failed to fetch token data" });
  }
});

// ══════════════════════════════════════════════════════
//  TRENDING TOKENS
//  GET /api/dexscreener/trending?chain=bsc
// ══════════════════════════════════════════════════════

router.get("/trending", async (req: Request, res: Response) => {
  try {
    const cacheKey = "trending";
    const cached = getCache(cacheKey, 60_000); // 1 min cache for trending
    if (cached) {
      res.json(cached);
      return;
    }

    const url = `${DEXSCREENER_BASE}/token-boosts/latest/v1`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "Failed to fetch trending" });
      return;
    }

    const data: any = await response.json();
    const tokens = (data.data || []).slice(0, 20).map((t: any) => ({
      chainId: t.chainId,
      tokenAddress: t.tokenAddress,
      url: t.url,
      icon: t.icon,
      description: t.description,
    }));

    setCache(cacheKey, tokens);
    res.json({ tokens, total: tokens.length });
  } catch (err: any) {
    console.error("[DEXSCREENER TRENDING]", err.message);
    res.status(500).json({ error: "Failed to fetch trending tokens" });
  }
});

// ══════════════════════════════════════════════════════
//  BATCH PRICE
//  POST /api/dexscreener/prices  { tokens: [{ chainId, address }] }
// ══════════════════════════════════════════════════════

router.post("/prices", async (req: Request, res: Response) => {
  try {
    const { tokens } = req.body;
    if (!Array.isArray(tokens) || tokens.length === 0) {
      res.status(400).json({ error: "tokens array required" });
      return;
    }

    // DexScreener allows up to 30 addresses per request
    const results: Record<string, any> = {};

    for (let i = 0; i < tokens.length; i += 30) {
      const batch = tokens.slice(i, i + 30);
      const addresses = batch.map((t: any) => t.address).join(",");

      const url = `${DEXSCREENER_BASE}/tokens/v1/ethereum/${addresses}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        const pairs = Array.isArray(data) ? data : [data];

        for (const pair of pairs) {
          const addr = pair.baseToken?.address?.toLowerCase();
          if (addr && !results[addr]) {
            results[addr] = {
              address: addr,
              symbol: pair.baseToken?.symbol,
              name: pair.baseToken?.name,
              price: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
              volume24h: pair.volume?.h24 || 0,
              priceChange24h: pair.priceChange?.h24 || 0,
              liquidity: pair.liquidity?.usd || 0,
            };
          }
        }
      }
    }

    res.json({ prices: results });
  } catch (err: any) {
    console.error("[DEXSCREENER PRICES]", err.message);
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

export default router;
