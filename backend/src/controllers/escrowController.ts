import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient, EscrowState } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import {
  verifyDepositTransaction,
  confirmDeposit,
} from "../services/blockchainListener";

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// ──────────────────────────────────────────────
//  AUTH MIDDLEWARE (user-level, not admin-only)
// ──────────────────────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  userWallet?: string;
}

function userAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as {
      sub: string;
      wallet: string;
      isAdmin?: boolean;
    };

    req.userId = payload.sub;
    req.userWallet = payload.wallet;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ──────────────────────────────────────────────
//  WALLET AUTH (signature-based login for all users)
// ──────────────────────────────────────────────

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      res.status(400).json({ error: "walletAddress, signature, and message are required" });
      return;
    }

    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      res.status(401).json({ error: "Signature verification failed" });
      return;
    }

    let user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress: walletAddress.toLowerCase() },
      });
    }

    if (user.isFrozen) {
      res.status(403).json({ error: "Account is frozen" });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, wallet: user.walletAddress, isAdmin: user.isAdmin },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        role: user.role,
        isAdmin: user.isAdmin,
        isArbiter: user.isArbiter,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.get("/auth/me", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        walletAddress: true,
        displayName: true,
        email: true,
        role: true,
        isAdmin: true,
        isArbiter: true,
        isFrozen: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

router.patch("/auth/profile", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { displayName, email } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(email !== undefined && { email }),
      },
      select: {
        id: true,
        walletAddress: true,
        displayName: true,
        email: true,
        role: true,
      },
    });

    res.json(user);
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Email already in use" });
      return;
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ──────────────────────────────────────────────
//  ESCROW CRUD
// ──────────────────────────────────────────────

router.post("/escrows", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      onChainId,
      chainId,
      title,
      description,
      sellerAddress,
      arbiterAddress,
      tokenAddress,
      totalAmount,
      mode,
      agreementHash,
      agreementText,
      deadline,
      milestones,
    } = req.body;

    const seller = await prisma.user.upsert({
      where: { walletAddress: sellerAddress.toLowerCase() },
      update: {},
      create: { walletAddress: sellerAddress.toLowerCase(), role: "SELLER" },
    });

    let arbiter = null;
    if (arbiterAddress && arbiterAddress !== ethers.ZeroAddress) {
      arbiter = await prisma.user.upsert({
        where: { walletAddress: arbiterAddress.toLowerCase() },
        update: {},
        create: { walletAddress: arbiterAddress.toLowerCase(), role: "ARBITER", isArbiter: true },
      });
    }

    let token = await prisma.token.findFirst({
      where: { address: tokenAddress.toLowerCase(), chainId },
    });

    if (!token) {
      token = await prisma.token.create({
        data: {
          address: tokenAddress.toLowerCase(),
          chainId,
          symbol: "UNKNOWN",
          name: "Unknown Token",
          decimals: 18,
        },
      });
    }

    const escrow = await prisma.escrow.create({
      data: {
        onChainId,
        chainId,
        title,
        description,
        buyerId: req.userId!,
        sellerId: seller.id,
        arbiterId: arbiter?.id,
        tokenId: token.id,
        totalAmount: totalAmount.toString(),
        mode: mode === 1 ? "ARBITER" : "LOCKED",
        agreementHash,
        agreementText,
        deadline: deadline ? new Date(deadline * 1000) : undefined,
        milestones: {
          create: milestones.map((m: { description: string; amount: string }, i: number) => ({
            index: i,
            description: m.description,
            amount: m.amount.toString(),
          })),
        },
      },
      include: {
        buyer: { select: { id: true, walletAddress: true, displayName: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true } },
        arbiter: { select: { id: true, walletAddress: true, displayName: true } },
        token: true,
        milestones: { orderBy: { index: "asc" } },
      },
    });

    res.status(201).json(escrow);
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Escrow with this onChainId already exists" });
      return;
    }
    res.status(500).json({ error: "Failed to create escrow", details: err.message });
  }
});

router.get("/escrows", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { role, state, page = "1", limit = "20" } = req.query;

    const where: Record<string, unknown> = {};

    if (role === "buyer") {
      where.buyerId = req.userId;
    } else if (role === "seller") {
      where.sellerId = req.userId;
    } else if (role === "arbiter") {
      where.arbiterId = req.userId;
    } else {
      where.OR = [
        { buyerId: req.userId },
        { sellerId: req.userId },
        { arbiterId: req.userId },
      ];
    }

    if (state) where.state = state as EscrowState;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));

    const [escrows, total] = await Promise.all([
      prisma.escrow.findMany({
        where,
        include: {
          buyer: { select: { id: true, walletAddress: true, displayName: true } },
          seller: { select: { id: true, walletAddress: true, displayName: true } },
          arbiter: { select: { id: true, walletAddress: true, displayName: true } },
          token: true,
          milestones: { orderBy: { index: "asc" } },
          _count: { select: { disputes: true, transactions: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.escrow.count({ where }),
    ]);

    res.json({
      escrows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch escrows" });
  }
});

router.get("/escrows/:id", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: {
        buyer: { select: { id: true, walletAddress: true, displayName: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true } },
        arbiter: { select: { id: true, walletAddress: true, displayName: true } },
        token: true,
        milestones: { orderBy: { index: "asc" } },
        transactions: { orderBy: { createdAt: "desc" } },
        disputes: {
          include: { initiator: { select: { id: true, walletAddress: true, displayName: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const isParticipant =
      escrow.buyerId === req.userId ||
      escrow.sellerId === req.userId ||
      escrow.arbiterId === req.userId;

    if (!isParticipant) {
      res.status(403).json({ error: "You are not a participant in this escrow" });
      return;
    }

    res.json(escrow);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch escrow" });
  }
});

router.get("/escrows/chain/:onChainId", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { onChainId: parseInt(req.params.onChainId as string, 10) },
      include: {
        buyer: { select: { id: true, walletAddress: true, displayName: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true } },
        arbiter: { select: { id: true, walletAddress: true, displayName: true } },
        token: true,
        milestones: { orderBy: { index: "asc" } },
        disputes: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    res.json(escrow);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch escrow" });
  }
});

// ──────────────────────────────────────────────
//  TOKEN LISTING (public)
// ──────────────────────────────────────────────

router.get("/tokens", async (req: Request, res: Response) => {
  try {
    const { chainId, status } = req.query;

    const where: Record<string, unknown> = {};
    if (chainId) where.chainId = Number(chainId);
    if (status) where.status = status;
    else where.status = { in: ["ACTIVE", "FEATURED"] };

    const tokens = await prisma.token.findMany({
      where,
      orderBy: [{ status: "desc" }, { symbol: "asc" }],
    });

    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// ──────────────────────────────────────────────
//  PROTOCOL CONFIG (public read)
// ──────────────────────────────────────────────

router.get("/config", async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.protocolConfig.findMany();
    const result: Record<string, string> = {};
    for (const c of configs) result[c.key] = c.value;
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

// ──────────────────────────────────────────────
//  WALLET GENERATION
//  POST /api/wallets/generate
// ──────────────────────────────────────────────

router.post("/wallets/generate", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { label } = req.body || {};

    const wallet = ethers.Wallet.createRandom();

    // Store the generated wallet address associated with the user
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Use the generatedWallets JSON field or create a record
    // For now, we track it by updating user metadata
    // In production you'd have a dedicated GeneratedWallet table
    const walletRecord = {
      address: wallet.address,
      label: label || `Wallet ${new Date().toISOString()}`,
      createdAt: new Date().toISOString(),
      userId: req.userId,
    };

    const isDev = process.env.NODE_ENV !== "production";

    const response: Record<string, unknown> = {
      success: true,
      wallet: {
        address: wallet.address,
        label: walletRecord.label,
        createdAt: walletRecord.createdAt,
      },
    };

    // Only include private key in development mode
    if (isDev) {
      response.wallet = {
        ...(response.wallet as Record<string, unknown>),
        privateKey: wallet.privateKey,
        mnemonic: wallet.mnemonic?.phrase,
      };
      response._devWarning = "Private key and mnemonic are only returned in development mode. Store them securely.";
    }

    res.status(201).json(response);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate wallet", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ACTIVITY FEED
//  GET /api/activity
// ──────────────────────────────────────────────

router.get("/activity", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));

    const userEscrows = await prisma.escrow.findMany({
      where: {
        OR: [
          { buyerId: req.userId },
          { sellerId: req.userId },
          { arbiterId: req.userId },
        ],
      },
      select: { id: true },
    });

    const escrowIds = userEscrows.map((e) => e.id);

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { escrowId: { in: escrowIds } },
        include: {
          escrow: {
            select: { title: true, onChainId: true },
            include: { token: { select: { symbol: true, decimals: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.transaction.count({ where: { escrowId: { in: escrowIds } } }),
    ]);

    res.json({
      transactions,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch activity" });
  }
});

// ──────────────────────────────────────────────
//  ESCROW DEPOSIT ADDRESS
//  GET /api/escrows/:id/deposit
// ──────────────────────────────────────────────

router.get("/escrows/:id/deposit", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { token: true },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can view deposit info" });
      return;
    }

    const contractAddress = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

    res.json({
      escrowId: escrow.id,
      onChainId: escrow.onChainId,
      depositAddress: contractAddress,
      tokenAddress: escrow.token?.address,
      tokenSymbol: escrow.token?.symbol,
      tokenDecimals: escrow.token?.decimals,
      totalAmount: escrow.totalAmount,
      state: escrow.state,
      instructions: `Send exactly ${escrow.totalAmount} ${escrow.token?.symbol || "tokens"} to the escrow contract. First approve the contract to spend your tokens, then call fundEscrow(${escrow.onChainId}).`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deposit info" });
  }
});

// ──────────────────────────────────────────────
//  ESCROW STATE UPDATE (for frontend sync)
//  PATCH /api/escrows/:id/state
// ──────────────────────────────────────────────

router.patch("/escrows/:id/state", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { state, txHash } = req.body;
    const validStates = ["CREATED", "FUNDED", "ACTIVE", "COMPLETED", "DISPUTED", "REFUNDED"];
    if (!validStates.includes(state)) {
      res.status(400).json({ error: "Invalid state" });
      return;
    }

    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id as string } });
    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const isParticipant = escrow.buyerId === req.userId || escrow.sellerId === req.userId;
    if (!isParticipant) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    const updated = await prisma.escrow.update({
      where: { id: req.params.id as string },
      data: {
        state: state as EscrowState,
        ...(state === "FUNDED" && { fundedAt: new Date() }),
        ...(state === "COMPLETED" && { completedAt: new Date() }),
      },
    });

    if (txHash) {
      await prisma.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash,
          type: state === "FUNDED" ? "FUND" : state === "REFUNDED" ? "REFUND" : "RELEASE",
          fromAddress: req.userWallet || "",
          toAddress: process.env.CONTRACT_ADDRESS || "",
          amount: escrow.totalAmount,
          chainId: escrow.chainId,
          status: "CONFIRMED",
        },
      }).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update escrow state" });
  }
});

// ──────────────────────────────────────────────
//  GENERATE DEPOSIT WALLET PER ESCROW
//  POST /api/escrows/:id/deposit-wallet
// ──────────────────────────────────────────────

router.post("/escrows/:id/deposit-wallet", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { token: true },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can generate a deposit wallet" });
      return;
    }

    const wallet = ethers.Wallet.createRandom();

    await prisma.transaction.create({
      data: {
        escrowId: escrow.id,
        txHash: `deposit-wallet-${wallet.address}`,
        type: "DEPOSIT_WALLET",
        fromAddress: req.userWallet || "",
        toAddress: wallet.address,
        amount: escrow.totalAmount,
        chainId: escrow.chainId,
        status: "PENDING",
      },
    }).catch(() => {});

    const isDev = process.env.NODE_ENV !== "production";

    res.status(201).json({
      success: true,
      depositWallet: {
        address: wallet.address,
        escrowId: escrow.id,
        onChainId: escrow.onChainId,
        tokenAddress: escrow.token?.address,
        tokenSymbol: escrow.token?.symbol,
        expectedAmount: escrow.totalAmount,
        ...(isDev && { privateKey: wallet.privateKey }),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate deposit wallet", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  SELLER WITHDRAWAL REQUEST
//  POST /api/escrows/:id/withdraw
// ──────────────────────────────────────────────

router.post("/escrows/:id/withdraw", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { toAddress } = req.body;

    if (!toAddress || toAddress.length !== 42) {
      res.status(400).json({ error: "Valid withdrawal address required" });
      return;
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { token: true },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.sellerId !== req.userId) {
      res.status(403).json({ error: "Only the seller can withdraw" });
      return;
    }

    if (escrow.state !== "COMPLETED") {
      res.status(400).json({ error: "Escrow must be completed before withdrawal" });
      return;
    }

    await prisma.transaction.create({
      data: {
        escrowId: escrow.id,
        txHash: `withdraw-request-${Date.now()}`,
        type: "WITHDRAWAL",
        fromAddress: process.env.CONTRACT_ADDRESS || "",
        toAddress: toAddress.toLowerCase(),
        amount: escrow.releasedAmount || escrow.totalAmount,
        chainId: escrow.chainId,
        status: "PENDING",
      },
    });

    res.json({
      success: true,
      message: "Withdrawal recorded. Funds released by the smart contract are sent directly to your wallet.",
      escrowId: escrow.id,
      amount: escrow.releasedAmount || escrow.totalAmount,
      toAddress,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to process withdrawal", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  SUPPORTED CHAINS (public)
//  GET /api/chains
// ──────────────────────────────────────────────

router.get("/chains", async (_req: Request, res: Response) => {
  res.json({
    chains: [
      { id: "hardhat", name: "Local Testnet", chainId: 31337, type: "evm", status: "active" },
      { id: "ethereum", name: "Ethereum", chainId: 1, type: "evm", status: "active" },
      { id: "bnb", name: "BNB Chain", chainId: 56, type: "evm", status: "active" },
      { id: "arbitrum", name: "Arbitrum", chainId: 42161, type: "evm", status: "active" },
      { id: "base", name: "Base", chainId: 8453, type: "evm", status: "active" },
      { id: "polygon", name: "Polygon", chainId: 137, type: "evm", status: "active" },
      { id: "optimism", name: "Optimism", chainId: 10, type: "evm", status: "active" },
      { id: "tron", name: "Tron", chainId: 0, type: "non-evm", status: "planned" },
      { id: "bitcoin", name: "Bitcoin", chainId: 0, type: "non-evm", status: "planned" },
    ],
  });
});

// ──────────────────────────────────────────────
//  LIVE PRICE FEED (CoinGecko proxy)
//  GET /api/prices?ids=ethereum,bitcoin&vs=usd,eur
// ──────────────────────────────────────────────

const priceCache: { data: Record<string, Record<string, number>>; ts: number } = { data: {}, ts: 0 };
const PRICE_CACHE_TTL = 30_000;

router.get("/prices", async (req: Request, res: Response) => {
  try {
    const ids = (req.query.ids as string) || "ethereum,bitcoin,binancecoin,matic-network,usd-coin,tether";
    const vs = (req.query.vs as string) || "usd,eur,gbp,btc,eth";

    const now = Date.now();
    const cacheKey = `${ids}:${vs}`;
    if (priceCache.ts > now - PRICE_CACHE_TTL && priceCache.data[cacheKey]) {
      res.json(priceCache.data[cacheKey]);
      return;
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true&include_market_cap=true`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "CoinGecko API error", status: response.status });
      return;
    }

    const data = await response.json() as Record<string, number>;
    priceCache.data[cacheKey] = data;
    priceCache.ts = now;

    res.json(data);
  } catch (err: any) {
    if (priceCache.data && Object.keys(priceCache.data).length > 0) {
      const firstKey = Object.keys(priceCache.data)[0];
      res.json({ ...priceCache.data[firstKey], _cached: true });
      return;
    }
    res.status(500).json({ error: "Failed to fetch prices", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ENHANCED DEPOSIT WALLET (stores in escrow record)
//  POST /api/escrows/:id/deposit-wallet-v2
// ──────────────────────────────────────────────

router.post("/escrows/:id/deposit-wallet-v2", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { token: true },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can generate a deposit wallet" });
      return;
    }

    if (escrow.depositWalletAddr) {
      res.json({
        success: true,
        depositWallet: {
          address: escrow.depositWalletAddr,
          escrowId: escrow.id,
          onChainId: escrow.onChainId,
          tokenAddress: escrow.token?.address,
          tokenSymbol: escrow.token?.symbol,
          tokenDecimals: escrow.token?.decimals,
          expectedAmount: escrow.totalAmount,
          chainId: escrow.chainId,
          alreadyGenerated: true,
        },
      });
      return;
    }

    const wallet = ethers.Wallet.createRandom();

    await prisma.escrow.update({
      where: { id: req.params.id as string },
      data: {
        depositWalletAddr: wallet.address,
        depositWalletKey: wallet.privateKey,
        fundingMethod: "DEPOSIT_TRANSFER",
      },
    });

    await prisma.transaction.create({
      data: {
        escrowId: escrow.id,
        txHash: `deposit-wallet-v2-${wallet.address}-${Date.now()}`,
        type: "DEPOSIT_WALLET",
        fromAddress: req.userWallet || "",
        toAddress: wallet.address,
        amount: escrow.totalAmount,
        chainId: escrow.chainId,
        status: "AWAITING_DEPOSIT",
      },
    });

    const isDev = process.env.NODE_ENV !== "production";

    res.status(201).json({
      success: true,
      depositWallet: {
        address: wallet.address,
        escrowId: escrow.id,
        onChainId: escrow.onChainId,
        tokenAddress: escrow.token?.address,
        tokenSymbol: escrow.token?.symbol,
        tokenDecimals: escrow.token?.decimals,
        expectedAmount: escrow.totalAmount,
        chainId: escrow.chainId,
        ...(isDev && { privateKey: wallet.privateKey }),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate deposit wallet", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  VERIFY DEPOSIT TRANSACTION
//  POST /api/escrows/:id/verify-deposit
// ──────────────────────────────────────────────

router.post("/escrows/:id/verify-deposit", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { txHash, chainId: requestChainId } = req.body;

    if (!txHash || typeof txHash !== "string" || !txHash.startsWith("0x") || txHash.length !== 66) {
      res.status(400).json({ error: "Valid transaction hash required (0x-prefixed, 66 chars)" });
      return;
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { token: true },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can submit deposit verification" });
      return;
    }

    if (escrow.depositConfirmed) {
      res.json({
        success: true,
        status: "ALREADY_CONFIRMED",
        message: "This escrow deposit has already been confirmed",
        escrow: {
          id: escrow.id,
          state: escrow.state,
          fundedAmount: escrow.fundedAmount,
          depositConfirmed: true,
        },
      });
      return;
    }

    const depositAddress = escrow.depositWalletAddr || req.body.depositAddress || process.env.CONTRACT_ADDRESS || "";

    const targetChainId = requestChainId ? Number(requestChainId) : escrow.chainId;

    let verification = await verifyDepositTransaction(
      txHash,
      targetChainId,
      depositAddress,
      escrow.token?.address,
      escrow.totalAmount
    );

    if ((verification.status === "NOT_FOUND" || verification.status === "FAILED") && targetChainId !== 31337) {
      const localVerification = await verifyDepositTransaction(
        txHash,
        31337,
        depositAddress,
        escrow.token?.address,
        escrow.totalAmount
      );
      if (localVerification.verified || localVerification.status === "PENDING") {
        verification = localVerification;
      }
    }

    if (verification.status === "PENDING") {
      res.json({
        success: false,
        status: "PENDING",
        message: "Transaction is still pending confirmation on-chain. Please wait and try again.",
        verification,
      });
      return;
    }

    if (verification.status === "NOT_FOUND") {
      res.json({
        success: false,
        status: "NOT_FOUND",
        message: "Transaction not found on the specified chain or local node. Verify the chain and tx hash are correct, or use Force Confirm for development testing.",
        verification,
      });
      return;
    }

    if (!verification.verified) {
      res.json({
        success: false,
        status: "FAILED",
        message: verification.error || "Transaction verification failed",
        verification,
      });
      return;
    }

    const confirmResult = await confirmDeposit(escrow.id, txHash, verification);

    if (!confirmResult.success) {
      res.status(500).json({
        success: false,
        status: "DB_ERROR",
        message: confirmResult.error || "Failed to update database",
        verification,
      });
      return;
    }

    const updatedEscrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: {
        token: true,
        buyer: { select: { id: true, walletAddress: true, displayName: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true } },
      },
    });

    res.json({
      success: true,
      status: "CONFIRMED",
      message: "Deposit verified and confirmed successfully",
      verification,
      escrow: updatedEscrow,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Deposit verification failed", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  DEPOSIT STATUS CHECK
//  GET /api/escrows/:id/deposit-status
// ──────────────────────────────────────────────

router.get("/escrows/:id/deposit-status", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: {
        token: true,
        transactions: {
          where: { type: { in: ["FUND", "DEPOSIT_WALLET"] } },
          orderBy: { createdAt: "desc" },
        },
      },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const isParticipant =
      escrow.buyerId === req.userId || escrow.sellerId === req.userId;
    if (!isParticipant) {
      res.status(403).json({ error: "Not a participant in this escrow" });
      return;
    }

    res.json({
      escrowId: escrow.id,
      onChainId: escrow.onChainId,
      state: escrow.state,
      fundingMethod: escrow.fundingMethod,
      depositWalletAddr: escrow.depositWalletAddr,
      depositConfirmed: escrow.depositConfirmed,
      fundedAmount: escrow.fundedAmount,
      totalAmount: escrow.totalAmount,
      fundedAt: escrow.fundedAt,
      tokenSymbol: escrow.token?.symbol,
      tokenDecimals: escrow.token?.decimals,
      transactions: escrow.transactions.map((t: any) => ({
        txHash: t.txHash,
        type: t.type,
        status: t.status,
        amount: t.amount,
        fromAddress: t.fromAddress,
        toAddress: t.toAddress,
        blockNumber: t.blockNumber,
        createdAt: t.createdAt,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch deposit status", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  FORCE CONFIRM DEPOSIT (development fallback)
//  POST /api/escrows/:id/force-confirm-deposit
//  Directly flips DB state when external RPC
//  cannot reach the tx (e.g. local Hardhat tx
//  submitted as BNB Chain hash).
// ──────────────────────────────────────────────

router.post("/escrows/:id/force-confirm-deposit", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const isDev = process.env.NODE_ENV !== "production";
    if (!isDev) {
      res.status(403).json({ error: "Force confirm is only available in development mode" });
      return;
    }

    const { txHash } = req.body;

    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { token: true },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can force confirm a deposit" });
      return;
    }

    if (escrow.depositConfirmed && escrow.state === "FUNDED") {
      res.json({
        success: true,
        message: "Deposit already confirmed",
        escrow: { id: escrow.id, state: escrow.state, depositConfirmed: true },
      });
      return;
    }

    const safeTxHash = txHash && typeof txHash === "string" && txHash.startsWith("0x")
      ? txHash
      : `force-confirm-${escrow.id}-${Date.now()}`;

    await prisma.$transaction(async (tx) => {
      await tx.escrow.update({
        where: { id: escrow.id },
        data: {
          depositConfirmed: true,
          state: "FUNDED" as EscrowState,
          fundedAmount: escrow.totalAmount,
          fundedAt: new Date(),
          fundingMethod: escrow.fundingMethod || "DEPOSIT_TRANSFER",
        },
      });

      const existingTx = await tx.transaction.findUnique({ where: { txHash: safeTxHash } });
      if (!existingTx) {
        await tx.transaction.create({
          data: {
            escrowId: escrow.id,
            txHash: safeTxHash,
            type: "FUND",
            fromAddress: req.userWallet || "force-confirmed",
            toAddress: escrow.depositWalletAddr || process.env.CONTRACT_ADDRESS || "",
            amount: escrow.totalAmount,
            chainId: escrow.chainId,
            status: "CONFIRMED",
            blockNumber: 0,
          },
        });
      }

      const pendingDepositTx = await tx.transaction.findFirst({
        where: {
          escrowId: escrow.id,
          type: "DEPOSIT_WALLET",
          status: { in: ["PENDING", "AWAITING_DEPOSIT"] },
        },
      });
      if (pendingDepositTx) {
        await tx.transaction.update({
          where: { id: pendingDepositTx.id },
          data: { status: "CONFIRMED" },
        });
      }
    });

    console.log(`[ForceConfirm] Escrow ${escrow.id} (onChainId: ${escrow.onChainId}) force-confirmed by ${req.userWallet}`);

    const updated = await prisma.escrow.findUnique({
      where: { id: escrow.id },
      include: {
        token: true,
        buyer: { select: { id: true, walletAddress: true, displayName: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true } },
      },
    });

    res.json({
      success: true,
      message: "Deposit force-confirmed (development mode). Escrow is now FUNDED.",
      escrow: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Force confirm failed", details: err.message });
  }
});

export default router;
