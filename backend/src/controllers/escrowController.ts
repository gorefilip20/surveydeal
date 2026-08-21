import { Router, Request, Response } from "express";
import { PrismaClient, EscrowState, ChainNetwork } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import {
  verifyDepositTransaction,
  confirmDeposit,
} from "../services/blockchainListener";
import {
  generateDepositWallet,
  getNetworkType,
} from "../services/walletGenerator";

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:5000";

// ── Auth Middleware (user-level) ────────────────────────────

interface AuthRequest extends Request {
  userId?: string;
  userWallet?: string;
}

async function userAuth(req: AuthRequest, res: Response, next: Function) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as {
      sub: string;
      wallet: string;
    };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { walletAddress: true, isFrozen: true },
    });
    if (!user || user.walletAddress !== payload.wallet?.toLowerCase()) {
      res.status(401).json({ error: "Invalid authentication subject" });
      return;
    }
    if (user.isFrozen) {
      res.status(403).json({ error: "Account is frozen" });
      return;
    }
    req.userId = payload.sub;
    req.userWallet = user.walletAddress;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTH ENDPOINTS
// ══════════════════════════════════════════════════════════════

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = req.body;
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
      },
    });
  } catch {
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
        wallets: true,
        createdAt: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch {
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
      select: { id: true, walletAddress: true, displayName: true, email: true, role: true },
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

// ══════════════════════════════════════════════════════════════
//  MULTI-CHAIN WALLET MANAGEMENT
// ══════════════════════════════════════════════════════════════

router.get("/wallets", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallets = await prisma.userWallet.findMany({
      where: { userId: req.userId },
      orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
    });
    res.json(wallets);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

router.post("/wallets", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { address, network, label, isPreferred } = req.body;

    if (!address || !network) {
      res.status(400).json({ error: "address and network are required" });
      return;
    }

    // Validate address format per network
    const validNetworks = Object.values(ChainNetwork);
    if (!validNetworks.includes(network)) {
      res.status(400).json({ error: `Invalid network. Supported: ${validNetworks.join(", ")}` });
      return;
    }

    const wallet = await prisma.userWallet.create({
      data: {
        userId: req.userId!,
        address: address.toLowerCase(),
        network: network as ChainNetwork,
        label,
        isPreferred: isPreferred || false,
      },
    });

    res.status(201).json(wallet);
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Wallet already exists for this network" });
      return;
    }
    res.status(500).json({ error: "Failed to add wallet" });
  }
});

router.patch("/wallets/:walletId", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { isPreferred, label } = req.body;
    const wallet = await prisma.userWallet.findUnique({
      where: { id: req.params.walletId },
    });

    if (!wallet || wallet.userId !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    // If setting as preferred, unset others on same network
    if (isPreferred) {
      await prisma.userWallet.updateMany({
        where: { userId: req.userId, network: wallet.network, id: { not: wallet.id } },
        data: { isPreferred: false },
      });
    }

    const updated = await prisma.userWallet.update({
      where: { id: req.params.walletId },
      data: {
        ...(isPreferred !== undefined && { isPreferred }),
        ...(label !== undefined && { label }),
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update wallet" });
  }
});

router.delete("/wallets/:walletId", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await prisma.userWallet.findUnique({
      where: { id: req.params.walletId },
    });
    if (!wallet || wallet.userId !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    await prisma.userWallet.delete({ where: { id: req.params.walletId } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete wallet" });
  }
});

// ══════════════════════════════════════════════════════════════
//  ESCROW CRUD
// ══════════════════════════════════════════════════════════════

router.post("/escrows", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      onChainId,
      chainId,
      title,
      description,
      sellerWallet,
      arbiterWallet,
      tokenAddress,
      totalAmount,
      mode,
      agreementHash,
      agreementText,
      deadline,
      milestones,
      network,
    } = req.body;

    if (!sellerWallet || !tokenAddress || !totalAmount || !milestones?.length || !title) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Find or create seller
    const seller = await prisma.user.upsert({
      where: { walletAddress: sellerWallet.toLowerCase() },
      update: {},
      create: { walletAddress: sellerWallet.toLowerCase(), role: "SELLER" },
    });

    // Find or create token
    let token = await prisma.token.findFirst({
      where: { address: tokenAddress.toLowerCase(), chainId: chainId || 1 },
    });
    if (!token) {
      token = await prisma.token.create({
        data: {
          address: tokenAddress.toLowerCase(),
          chainId: chainId || 1,
          network: (network as ChainNetwork) || "ETHEREUM",
          symbol: "UNKNOWN",
          name: "Unknown Token",
        },
      });
    }

    // Find arbiter if provided
    let arbiterId: string | undefined;
    if (arbiterWallet) {
      const arbiter = await prisma.user.findUnique({
        where: { walletAddress: arbiterWallet.toLowerCase() },
      });
      if (arbiter) arbiterId = arbiter.id;
    }

    const escrow = await prisma.escrow.create({
      data: {
        onChainId: onChainId || 0,
        chainId: chainId || 1,
        network: (network as ChainNetwork) || "ETHEREUM",
        title,
        description,
        buyerId: req.userId!,
        sellerId: seller.id,
        arbiterId,
        tokenId: token.id,
        totalAmount: totalAmount.toString(),
        fundedAmount: "0",
        mode: mode === 1 ? "ARBITER" : "LOCKED",
        agreementHash,
        agreementText,
        deadline: deadline ? new Date(deadline) : undefined,
        milestones: {
          create: milestones.map((m: any, i: number) => ({
            index: i,
            description: m.description,
            amount: m.amount.toString(),
          })),
        },
      },
      include: {
        buyer: { select: { id: true, walletAddress: true, displayName: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true } },
        token: true,
        milestones: true,
      },
    });

    res.status(201).json(escrow);
  } catch (err: any) {
    console.error("[CREATE ESCROW]", err);
    res.status(500).json({ error: "Failed to create escrow", details: err.message });
  }
});

router.get("/escrows", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { role, state, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (role === "buyer") where.buyerId = req.userId;
    else if (role === "seller") where.sellerId = req.userId;
    else {
      where.OR = [{ buyerId: req.userId }, { sellerId: req.userId }, { arbiterId: req.userId }];
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
          token: { select: { symbol: true, decimals: true, network: true, logoUrl: true } },
          milestones: { orderBy: { index: "asc" } },
          _count: { select: { transactions: true } },
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
  } catch (err: any) {
    console.error("[LIST ESCROWS]", err);
    res.status(500).json({ error: "Failed to fetch escrows" });
  }
});

router.get("/escrows/:id", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id },
      include: {
        buyer: { select: { id: true, walletAddress: true, displayName: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true } },
        arbiter: { select: { id: true, walletAddress: true, displayName: true } },
        token: true,
        milestones: { orderBy: { index: "asc" } },
        transactions: { orderBy: { createdAt: "desc" } },
        dispuInits: true,
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
      res.status(403).json({ error: "Not a participant in this escrow" });
      return;
    }

    res.json(escrow);
  } catch (err: any) {
    console.error("[GET ESCROW]", err);
    res.status(500).json({ error: "Failed to fetch escrow" });
  }
});

router.patch("/escrows/:id/state", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { state, txHash } = req.body;
    const validStates = ["CREATED", "FUNDED", "ACTIVE", "COMPLETED", "DISPUTED", "REFUNDED"];
    if (!validStates.includes(state)) {
      res.status(400).json({ error: "Invalid state" });
      return;
    }

    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const isParticipant =
      escrow.buyerId === req.userId || escrow.sellerId === req.userId;
    if (!isParticipant) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    const updateData: any = { state };
    if (state === "FUNDED") updateData.fundedAt = new Date();
    if (state === "COMPLETED") updateData.completedAt = new Date();

    const updated = await prisma.escrow.update({
      where: { id: req.params.id },
      data: updateData,
    });

    if (txHash) {
      await prisma.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash,
          type: state === "FUNDED" ? "FUND" : state === "REFUNDED" ? "REFUND" : "RELEASE",
          fromAddress: req.userWallet || "",
          toAddress: "",
          amount: escrow.totalAmount,
          chainId: escrow.chainId,
        },
      });
    }

    res.json(updated);
  } catch (err: any) {
    console.error("[UPDATE ESCROW STATE]", err);
    res.status(500).json({ error: "Failed to update state" });
  }
});

// ══════════════════════════════════════════════════════════════
//  TOKEN LISTING
// ══════════════════════════════════════════════════════════════

router.get("/tokens", async (req: Request, res: Response) => {
  try {
    const { chainId, status } = req.query;
    const where: any = {};
    if (chainId) where.chainId = Number(chainId);
    if (status) where.status = status;
    else where.status = { in: ["ACTIVE", "FEATURED"] };

    const tokens = await prisma.token.findMany({
      where,
      orderBy: [{ status: "desc" }, { symbol: "asc" }],
    });
    res.json(tokens);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// ══════════════════════════════════════════════════════════════
//  SUPPORTED CHAINS (public)
// ══════════════════════════════════════════════════════════════

router.get("/chains", async (_req: Request, res: Response) => {
  res.json({
    chains: [
      { id: "ETHEREUM", name: "Ethereum", chainId: 1, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://etherscan.io" },
      { id: "BNB_CHAIN", name: "BNB Chain", chainId: 56, type: "evm", nativeCurrency: "BNB", blockExplorer: "https://bscscan.com" },
      { id: "POLYGON", name: "Polygon", chainId: 137, type: "evm", nativeCurrency: "MATIC", blockExplorer: "https://polygonscan.com" },
      { id: "ARBITRUM", name: "Arbitrum One", chainId: 42161, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://arbiscan.io" },
      { id: "BASE", name: "Base", chainId: 8453, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://basescan.org" },
      { id: "AVALANCHE", name: "Avalanche", chainId: 43114, type: "evm", nativeCurrency: "AVAX", blockExplorer: "https://snowtrace.io" },
      { id: "OPTIMISM", name: "Optimism", chainId: 10, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://optimistic.etherscan.io" },
      { id: "FANTOM", name: "Fantom", chainId: 250, type: "evm", nativeCurrency: "FTM", blockExplorer: "https://ftmscan.com" },
      { id: "SOLANA", name: "Solana", chainId: 0, type: "svm", nativeCurrency: "SOL", blockExplorer: "https://solscan.io" },
      { id: "TRON", name: "TRON", chainId: 0, type: "tvm", nativeCurrency: "TRX", blockExplorer: "https://tronscan.org" },
    ],
  });
});

// ══════════════════════════════════════════════════════════════
//  DEPOSIT WALLET
// ══════════════════════════════════════════════════════════════

router.get("/escrows/:id/deposit", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id },
      include: { token: true },
    });
    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }
    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can view deposit info" });
      return;
    }

    const network = escrow.depositNetwork || getNetworkType(escrow.chainId);

    res.json({
      escrowId: escrow.id,
      depositAddress: escrow.depositWalletAddr,
      onChainId: escrow.onChainId,
      tokenAddress: escrow.token.address,
      tokenSymbol: escrow.token.symbol,
      expectedAmount: escrow.totalAmount,
      state: escrow.state,
      network,
      chainId: escrow.chainId,
      instructions: `Send exactly ${escrow.totalAmount} ${escrow.token.symbol} to the deposit address: ${escrow.depositWalletAddr}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch deposit info" });
  }
});

router.post("/escrows/:id/deposit-wallet", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }
    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can generate deposit wallet" });
      return;
    }
    if (escrow.depositWalletAddr) {
      res.json({
        success: true,
        depositWallet: {
          address: escrow.depositWalletAddr,
          network: escrow.depositNetwork,
          escrowId: escrow.id,
          alreadyGenerated: true,
        },
      });
      return;
    }

    const wallet = await generateDepositWallet(escrow.chainId);

    await prisma.escrow.update({
      where: { id: escrow.id },
      data: {
        depositWalletAddr: wallet.address,
        depositNetwork: getNetworkType(escrow.chainId),
        fundingMethod: "DEPOSIT_TRANSFER",
      },
    });

    await prisma.transaction.create({
      data: {
        escrowId: escrow.id,
        txHash: `deposit-wallet-${wallet.address}`,
        type: "DEPOSIT_WALLET",
        fromAddress: "SYSTEM",
        toAddress: wallet.address,
        amount: "0",
        chainId: escrow.chainId,
      },
    });

    res.status(201).json({
      success: true,
      depositWallet: {
        address: wallet.address,
        network: getNetworkType(escrow.chainId),
        chainId: escrow.chainId,
        derivationIndex: wallet.derivationIndex,
      },
    });
  } catch (err: any) {
    console.error("[DEPOSIT WALLET]", err);
    res.status(500).json({ error: "Failed to generate deposit wallet" });
  }
});

router.post("/escrows/:id/verify-deposit", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { txHash } = req.body;
    if (!txHash) {
      res.status(400).json({ error: "txHash is required" });
      return;
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id },
      include: { token: true },
    });
    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }
    if (escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can verify deposit" });
      return;
    }

    const verification = await verifyDepositTransaction(
      txHash,
      escrow.chainId,
      escrow.depositWalletAddr || "",
      escrow.totalAmount,
      escrow.token.address
    );

    if (!verification.verified) {
      res.json({
        success: false,
        status: "NOT_FOUND",
        message: verification.error || "Transaction not found or not confirmed yet",
      });
      return;
    }

    await confirmDeposit(escrow.id, txHash, verification.amount || escrow.totalAmount);

    res.json({
      success: true,
      status: "CONFIRMED",
      txHash,
      amount: verification.amount,
      blockNumber: verification.blockNumber,
    });
  } catch (err: any) {
    console.error("[VERIFY DEPOSIT]", err);
    res.status(500).json({ error: "Failed to verify deposit" });
  }
});

router.post("/escrows/:id/state", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { state, txHash } = req.body;
    const validStates = ["CREATED", "FUNDED", "ACTIVE", "COMPLETED", "DISPUTED", "REFUNDED"];
    if (!validStates.includes(state)) {
      res.status(400).json({ error: "Invalid state" });
      return;
    }

    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const isParticipant =
      escrow.buyerId === req.userId || escrow.sellerId === req.userId;
    if (!isParticipant) {
      res.status(403).json({ error: "Not a participant" });
      return;
    }

    const updateData: any = { state };
    if (state === "FUNDED") updateData.fundedAt = new Date();
    if (state === "COMPLETED") updateData.completedAt = new Date();

    await prisma.escrow.update({ where: { id: req.params.id }, data: updateData });

    if (txHash) {
      await prisma.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash,
          type: state === "FUNDED" ? "FUND" : state === "REFUNDED" ? "REFUND" : "RELEASE",
          fromAddress: req.userWallet || "",
          toAddress: "",
          amount: escrow.totalAmount,
          chainId: escrow.chainId,
        },
      });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update state" });
  }
});

// ══════════════════════════════════════════════════════════════
//  SUPPORTED CHAINS (public - for frontend wallet selector)
// ══════════════════════════════════════════════════════════════

router.get("/chains", async (_req: Request, res: Response) => {
  res.json({
    chains: [
      { id: "ETHEREUM", name: "Ethereum", chainId: 1, type: "evm", nativeCurrency: "ETH", icon: "🔷", blockExplorer: "https://etherscan.io" },
      { id: "BNB_CHAIN", name: "BNB Chain", chainId: 56, type: "evm", nativeCurrency: "BNB", icon: "🟡", blockExplorer: "https://bscscan.com" },
      { id: "POLYGON", name: "Polygon", chainId: 137, type: "evm", nativeCurrency: "MATIC", icon: "🟣", blockExplorer: "https://polygonscan.com" },
      { id: "ARBITRUM", name: "Arbitrum One", chainId: 42161, type: "evm", nativeCurrency: "ETH", icon: "🔵", blockExplorer: "https://arbiscan.io" },
      { id: "BASE", name: "Base", chainId: 8453, type: "evm", nativeCurrency: "ETH", icon: "🔷", blockExplorer: "https://basescan.org" },
      { id: "AVALANCHE", name: "Avalanche C-Chain", chainId: 43114, type: "evm", nativeCurrency: "AVAX", icon: "🔺", blockExplorer: "https://snowtrace.io" },
      { id: "OPTIMISM", name: "Optimism", chainId: 10, type: "evm", nativeCurrency: "ETH", icon: "🔴", blockExplorer: "https://optimistic.etherscan.io" },
      { id: "FANTOM", name: "Fantom", chainId: 250, type: "evm", nativeCurrency: "FTM", icon: "👻", blockExplorer: "https://ftmscan.com" },
      { id: "SOLANA", name: "Solana", chainId: 0, type: "svm", nativeCurrency: "SOL", icon: "☀️", blockExplorer: "https://solscan.io" },
      { id: "TRON", name: "TRON", chainId: 0, type: "tvm", nativeCurrency: "TRX", icon: "🔴", blockExplorer: "https://tronscan.org" },
    ],
  });
});

// ══════════════════════════════════════════════════════════════
//  PRICE FEED (CoinGecko proxy)
// ══════════════════════════════════════════════════════════════

const priceCache: { data: any; ts: number } = { data: {}, ts: 0 };
const PRICE_CACHE_TTL = 30_000;

router.get("/prices", async (req: Request, res: Response) => {
  try {
    const ids = (req.query.ids as string) || "ethereum,binancecoin,bitcoin,tether";
    const vs = (req.query.vs as string) || "usd";

    const now = Date.now();
    const cacheKey = `${ids}:${vs}`;
    if (priceCache.ts > now - PRICE_CACHE_TTL && priceCache.data[cacheKey]) {
      res.json(priceCache.data[cacheKey]);
      return;
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${vs}&include_24hr_change=true&include_market_cap=true`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      res.status(response.status).json({ error: "CoinGecko API error" });
      return;
    }

    const data = await response.json();
    priceCache.data[cacheKey] = data;
    priceCache.ts = now;

    res.json(data);
  } catch (err: any) {
    if (priceCache.data && Object.keys(priceCache.data).length > 0) {
      const firstKey = Object.keys(priceCache.data)[0];
      res.json({ ...priceCache.data[firstKey], _cached: true });
      return;
    }
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

export default router;
