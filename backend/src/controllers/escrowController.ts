import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import * as crypto from "crypto";
import { prisma } from "../lib/prisma";
import { EVM_CHAIN_IDS, SUPPORTED_CHAINS } from "../lib/chains";
import {
  verifyDepositTransaction,
  confirmDeposit,
} from "../services/blockchainListener";
import { authLimiter, depositLimiter } from "../middleware/rateLimiter";
import { normalizeDepositEvent, persistIncomingDeposit, verifyWebhookSignature } from "../services/depositWebhookService";
import { validate } from "../middleware/validate";
import {
  loginSchema, profileUpdateSchema, createEscrowSchema,
  depositWalletSchema, verifyDepositSchema,
  disputeSchema, walletAddSchema, chatRoomCreateSchema, chatMessageSchema,
} from "../middleware/schemas";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}

const nonceStore = new Map<string, { nonce: string; expires: number }>();

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
    const payload = jwt.verify(header.slice(7), JWT_SECRET!) as {
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

router.get("/auth/nonce/:walletAddress", (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  if (!ethers.isAddress(walletAddress)) {
    res.status(400).json({ error: "Invalid wallet address" });
    return;
  }
  const nonce = crypto.randomBytes(32).toString("hex");
  const expires = Date.now() + 5 * 60 * 1000;
  nonceStore.set(walletAddress.toLowerCase(), { nonce, expires });

  const message = `Sign this message to log in to SurveyDeal.\n\nNonce: ${nonce}\nTimestamp: ${new Date().toISOString()}`;
  res.json({ message, nonce });
});

router.post("/auth/login", authLimiter, validate(loginSchema), async (req: Request, res: Response) => {
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

    const stored = nonceStore.get(walletAddress.toLowerCase());
    if (stored) {
      if (Date.now() > stored.expires) {
        nonceStore.delete(walletAddress.toLowerCase());
        res.status(401).json({ error: "Nonce expired, request a new one" });
        return;
      }
      if (!message.includes(stored.nonce)) {
        res.status(401).json({ error: "Invalid nonce in signed message" });
        return;
      }
      nonceStore.delete(walletAddress.toLowerCase());
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
      JWT_SECRET!,
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

router.post("/auth/refresh", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || user.isFrozen) {
      res.status(403).json({ error: "Account unavailable" });
      return;
    }
    const token = jwt.sign(
      { sub: user.id, wallet: user.walletAddress, isAdmin: user.isAdmin },
      JWT_SECRET!,
      { expiresIn: "24h" }
    );
    res.json({ token });
  } catch {
    res.status(500).json({ error: "Token refresh failed" });
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
  } catch {
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

router.post("/wallets", userAuth, validate(walletAddSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { address, network, label, isPreferred } = req.body;

    if (!address || !network) {
      res.status(400).json({ error: "address and network are required" });
      return;
    }

    const validNetworks = ["ETHEREUM", "BNB_CHAIN", "POLYGON", "ARBITRUM", "BASE", "AVALANCHE", "OPTIMISM", "FANTOM"];
    if (!validNetworks.includes(network)) {
      res.status(400).json({ error: `Invalid network. Supported: ${validNetworks.join(", ")}` });
      return;
    }

    const wallet = await prisma.userWallet.create({
      data: {
        userId: req.userId!,
        address: address.toLowerCase(),
        network: network as any,
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
      where: { id: req.params.walletId as string },
    });

    if (!wallet || wallet.userId !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    if (isPreferred) {
      await prisma.userWallet.updateMany({
        where: { userId: req.userId, network: wallet.network, id: { not: wallet.id } },
        data: { isPreferred: false },
      });
    }

    const updated = await prisma.userWallet.update({
      where: { id: req.params.walletId as string },
      data: {
        ...(isPreferred !== undefined && { isPreferred }),
        ...(label !== undefined && { label }),
      },
    });

    res.json(updated);
  } catch {
    res.status(500).json({ error: "Failed to update wallet" });
  }
});

router.delete("/wallets/:walletId", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await prisma.userWallet.findUnique({
      where: { id: req.params.walletId as string },
    });
    if (!wallet || wallet.userId !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    await prisma.userWallet.delete({ where: { id: req.params.walletId as string } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete wallet" });
  }
});

// ══════════════════════════════════════════════════════════════
//  ESCROW CRUD
// ══════════════════════════════════════════════════════════════

router.post("/escrows", userAuth, validate(createEscrowSchema), async (req: AuthRequest, res: Response) => {
  try {
    const {
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

    const resolvedChainId = chainId || 1;
    if (!EVM_CHAIN_IDS.includes(resolvedChainId)) {
      res.status(400).json({
        error: `Chain ${resolvedChainId} not supported. Supported: ${EVM_CHAIN_IDS.join(", ")}`,
      });
      return;
    }

    if (sellerWallet.toLowerCase() === req.userWallet?.toLowerCase()) {
      res.status(400).json({ error: "Buyer and seller cannot be the same wallet" });
      return;
    }

    const maxOnChain = await prisma.escrow.aggregate({ _max: { onChainId: true } });
    const nextOnChainId = (maxOnChain._max.onChainId ?? 0) + 1;

    const seller = await prisma.user.upsert({
      where: { walletAddress: sellerWallet.toLowerCase() },
      update: {},
      create: { walletAddress: sellerWallet.toLowerCase(), role: "SELLER" },
    });

    let token = await prisma.token.findFirst({
      where: { address: tokenAddress.toLowerCase(), chainId: resolvedChainId },
    });
    if (!token) {
      token = await prisma.token.create({
        data: {
          address: tokenAddress.toLowerCase(),
          chainId: resolvedChainId,
          network: ((network as string) || "ETHEREUM") as any,
          symbol: "UNKNOWN",
          name: "Unknown Token",
        },
      });
    }

    let arbiterId: string | undefined;
    if (arbiterWallet) {
      const arbiter = await prisma.user.findUnique({
        where: { walletAddress: arbiterWallet.toLowerCase() },
      });
      if (arbiter) arbiterId = arbiter.id;
    }

    const escrow = await prisma.escrow.create({
      data: {
        onChainId: nextOnChainId,
        chainId: resolvedChainId,
        network: ((network as string) || "ETHEREUM") as any,
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

    if (state) where.state = state as string;

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
      where: { id: req.params.id as string },
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

router.patch("/escrows/:id/state", userAuth, async (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "Escrow state is read-only; submit the on-chain transaction and wait for the indexer" });
});

/* Legacy state mutation implementation intentionally removed. */
/*
  try {
    const { state } = req.body;

    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id as string } });
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

    const allowed = VALID_TRANSITIONS[escrow.state] || [];
    if (!allowed.includes(state)) {
      res.status(400).json({
        error: `Invalid transition: ${escrow.state} -> ${state}. Allowed: ${allowed.join(", ") || "none"}`,
      });
      return;
    }

    if (state === "ACTIVE" && escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can activate the escrow" });
      return;
    }

    if (state === "REFUNDED" && escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Only the buyer can request a refund" });
      return;
    }

    if (state === "REFUNDED") {
      const refundResult = await processRefund(req.params.id as string);
      if (!refundResult.success) {
        res.status(500).json({ error: `Refund failed: ${refundResult.error}` });
        return;
      }
      const updated = await prisma.escrow.findUnique({ where: { id: req.params.id as string } });
      res.json({ ...updated, refundTxHash: refundResult.txHash });
      return;
    }

    const updateData: any = { state };
    if (state === "FUNDED") updateData.fundedAt = new Date();
    if (state === "COMPLETED") updateData.completedAt = new Date();

    const updated = await prisma.escrow.update({
      where: { id: req.params.id as string },
      data: updateData,
    });

    res.json(updated);
  } catch (err: any) {
    console.error("[UPDATE ESCROW STATE]", err);
    res.status(500).json({ error: "Failed to update state" });
  }
});

// ══════════════════════════════════════════════════════════════
*/

//  MILESTONE ACTIONS (USER-SIDE)
// ══════════════════════════════════════════════════════════════

router.post("/escrows/:id/milestones/:milestoneIndex/deliver", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow: any = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { milestones: true },
    });
    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }
    if (escrow.sellerId !== req.userId) { res.status(403).json({ error: "Only the seller can mark delivery" }); return; }
    if (!["FUNDED", "ACTIVE"].includes(escrow.state)) { res.status(400).json({ error: `Cannot deliver in state: ${escrow.state}` }); return; }

    const milestone = escrow.milestones.find((m: any) => m.index === parseInt(req.params.milestoneIndex as string));
    if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }
    if (milestone.released) { res.status(400).json({ error: "Milestone already released" }); return; }

    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { sellerDelivered: true },
    });

    res.json({ success: true, milestoneIndex: milestone.index });
  } catch (err: any) {
    console.error("[DELIVER MILESTONE]", err);
    res.status(500).json({ error: "Failed to mark milestone as delivered" });
  }
});

router.post("/escrows/:id/milestones/:milestoneIndex/approve", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow: any = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { milestones: true },
    });
    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }
    if (escrow.buyerId !== req.userId) { res.status(403).json({ error: "Only the buyer can approve milestones" }); return; }
    if (!["FUNDED", "ACTIVE"].includes(escrow.state)) { res.status(400).json({ error: `Cannot approve in state: ${escrow.state}` }); return; }

    const milestone = escrow.milestones.find((m: any) => m.index === parseInt(req.params.milestoneIndex as string));
    if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }
    if (milestone.released) { res.status(400).json({ error: "Milestone already released" }); return; }

    await prisma.milestone.update({
      where: { id: milestone.id },
      data: { buyerApproved: true },
    });

    res.json({ success: true, milestoneIndex: milestone.index });
  } catch (err: any) {
    console.error("[APPROVE MILESTONE]", err);
    res.status(500).json({ error: "Failed to approve milestone" });
  }
});

// ══════════════════════════════════════════════════════════════
//  DISPUTE MANAGEMENT
// ══════════════════════════════════════════════════════════════

router.post("/escrows/:id/disputes", userAuth, validate(disputeSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { reason, evidence, milestoneIndex } = req.body;
    if (!reason) { res.status(400).json({ error: "Reason is required" }); return; }

    const escrow: any = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { milestones: true, dispuInits: true },
    });
    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }

    const isParticipant = escrow.buyerId === req.userId || escrow.sellerId === req.userId;
    if (!isParticipant) { res.status(403).json({ error: "Not a participant" }); return; }

    if (!["FUNDED", "ACTIVE"].includes(escrow.state)) {
      res.status(400).json({ error: `Cannot dispute in state: ${escrow.state}` });
      return;
    }

    const pendingDisputes = escrow.dispuInits.filter((d: any) => d.outcome === "PENDING");
    if (pendingDisputes.length > 0) {
      res.status(400).json({ error: "There is already a pending dispute on this escrow" });
      return;
    }

    let milestoneId: string | undefined;
    if (milestoneIndex !== undefined) {
      const milestone = escrow.milestones.find((m: any) => m.index === milestoneIndex);
      if (!milestone) { res.status(404).json({ error: "Milestone not found" }); return; }
      milestoneId = milestone.id;
    }

    const dispute = await prisma.dispute.create({
      data: {
        escrowId: escrow.id,
        milestoneId,
        initiatorId: req.userId!,
        reason,
        evidence,
      },
    });

    res.status(201).json(dispute);
  } catch (err: any) {
    console.error("[CREATE DISPUTE]", err);
    res.status(500).json({ error: "Failed to create dispute" });
  }
});

router.get("/escrows/:id/disputes", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id as string } });
    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }

    const isParticipant = escrow.buyerId === req.userId || escrow.sellerId === req.userId || escrow.arbiterId === req.userId;
    if (!isParticipant) { res.status(403).json({ error: "Not a participant" }); return; }

    const disputes = await prisma.dispute.findMany({
      where: { escrowId: escrow.id },
      include: {
        initiator: { select: { id: true, walletAddress: true, displayName: true } },
        resolver: { select: { id: true, walletAddress: true, displayName: true } },
        milestone: { select: { id: true, index: true, description: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(disputes);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch disputes" });
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
  } catch {
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
    ],
  });
});

// ══════════════════════════════════════════════════════════════
//  DEPOSIT WALLET
// ══════════════════════════════════════════════════════════════

router.get("/escrows/:id/deposit", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow: any = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
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

    res.json({
      escrowId: escrow.id,
      depositAddress: escrow.depositWalletAddr,
      onChainId: escrow.onChainId,
      tokenAddress: escrow.token.address,
      tokenSymbol: escrow.token.symbol,
      expectedAmount: escrow.totalAmount,
      state: escrow.state,
      network: escrow.depositNetwork || "evm",
      chainId: escrow.chainId,
      instructions: `Send exactly ${escrow.totalAmount} ${escrow.token.symbol} to the deposit address: ${escrow.depositWalletAddr}`,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch deposit info" });
  }
});

router.post("/escrows/:id/deposit-wallet", userAuth, depositLimiter, validate(depositWalletSchema), async (_req: AuthRequest, res: Response) => {
  res.status(410).json({ error: "Custodial deposit wallets are disabled. Fund the verified escrow contract directly from your wallet." });
});

/* Legacy custodial wallet implementation retained only in git history; it must not run in production.
  try {
    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id as string } });
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
        depositWalletKey: wallet.encryptedPrivateKey,
        depositNetwork: "evm",
        derivationIndex: wallet.derivationIndex,
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
        network: "evm",
        chainId: escrow.chainId,
        derivationIndex: wallet.derivationIndex,
      },
    });
  } catch (err: any) {
    console.error("[DEPOSIT WALLET]", err);
    res.status(500).json({ error: "Failed to generate deposit wallet" });
  }
});

*/

router.post("/escrows/:id/verify-deposit", userAuth, validate(verifyDepositSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { txHash } = req.body;
    if (!txHash) {
      res.status(400).json({ error: "txHash is required" });
      return;
    }

    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
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

// ══════════════════════════════════════════════════════════════
//  CUSTODY PROVIDER WEBHOOK INGESTION
// ══════════════════════════════════════════════════════════════

router.post("/webhooks/custody/:provider", async (req: Request, res: Response) => {
  const secret = process.env.CUSTODY_WEBHOOK_SECRET;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body));
  if (!verifyWebhookSignature(rawBody, req.header("x-provider-signature"), secret)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }
  try {
    const provider = String(req.params.provider);
    const event = normalizeDepositEvent(provider, req.body);
    await prisma.webhookInbox.upsert({
      where: { provider_eventId: { provider, eventId: event.id } },
      create: { provider, eventId: event.id, payload: req.body as any, status: "RECEIVED" },
      update: {},
    });
    const result = await persistIncomingDeposit(event);
    await prisma.webhookInbox.update({ where: { provider_eventId: { provider, eventId: event.id } }, data: { status: "PROCESSED", processedAt: new Date() } });
    res.status(202).json({ accepted: true, status: result.status, escrowId: result.escrowId });
  } catch (error: any) {
    console.error("[CUSTODY WEBHOOK]", error);
    res.status(400).json({ error: "Invalid custody webhook event" });
  }
});

//  DISPLAY-ONLY DEPOSIT ADDRESSES
// ══════════════════════════════════════════════════════════════

router.get("/deposit-addresses", async (_req: Request, res: Response) => {
  try {
    const configs = await prisma.protocolConfig.findMany({
      where: { key: { in: ["depositAddress.BNB_BEP20_USDT", "depositAddress.TRON_TRC20_USDT", "depositAddress.SOLANA"] } },
    });
    const byKey = Object.fromEntries(configs.map((config) => [config.key, config.value]));
    res.json({
      displayOnly: true,
      custodial: true,
      warning: "These are shared receiving addresses, not per-escrow contract addresses. Verify the network and token before sending funds.",
      addresses: {
        bnbBep20Usdt: byKey["depositAddress.BNB_BEP20_USDT"] || "",
        tronTrc20Usdt: byKey["depositAddress.TRON_TRC20_USDT"] || "",
        solana: byKey["depositAddress.SOLANA"] || "",
      },
    });
  } catch {
    res.status(500).json({ error: "Deposit addresses are not configured" });
  }
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

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=${encodeURIComponent(vs)}&include_24hr_change=true&include_market_cap=true`;
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
  } catch {
    if (priceCache.data && Object.keys(priceCache.data).length > 0) {
      const firstKey = Object.keys(priceCache.data)[0];
      res.json({ ...priceCache.data[firstKey], _cached: true });
      return;
    }
    res.status(500).json({ error: "Failed to fetch prices" });
  }
});

export default router;
