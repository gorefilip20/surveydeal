import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient, EscrowState, DisputeOutcome, TokenStatus } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { z } from "zod";

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

const ESCROW_ABI = [
  "function resolveDisputeByArbiter(uint256 escrowId, uint256 milestoneIndex, uint256 buyerBasisPoints) external",
  "function blacklistToken(address token) external",
  "function unblacklistToken(address token) external",
  "function setFeaturedToken(address token, bool featured) external",
  "function updateFeeConfig(uint256 feeBasisPoints, uint256 maxFeeAbsolute, address feeRecipient) external",
  "function pause() external",
  "function unpause() external",
  "function addArbiter(address arbiter) external",
  "function removeArbiter(address arbiter) external",
  "function getEscrow(uint256 escrowId) view returns (tuple(uint256 id, address buyer, address seller, address arbiter, address token, uint256 totalAmount, uint256 fundedAmount, uint256 releasedAmount, uint256 protocolFeeCollected, uint8 state, uint8 mode, bytes32 agreementHash, uint256 createdAt, uint256 fundedAt, uint256 deadline, uint256 milestoneCount))",
  "function getMilestones(uint256 escrowId) view returns (tuple(string description, uint256 amount, bool released, bool disputed, bool buyerApproved, bool sellerDelivered)[])",
  "function getUnreleasedAmount(uint256 escrowId) view returns (uint256)",
  "event DisputeResolved(uint256 indexed escrowId, uint256 milestoneIndex, uint256 buyerShare, uint256 sellerShare)",
];

function getContract(): ethers.Contract {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
  return new ethers.Contract(CONTRACT_ADDRESS, ESCROW_ABI, wallet);
}

// ──────────────────────────────────────────────
//  AUTH MIDDLEWARE
// ──────────────────────────────────────────────

interface AuthRequest extends Request {
  adminId?: string;
  adminWallet?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as {
      sub: string;
      wallet: string;
      isAdmin: boolean;
    };

    if (!payload.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    req.adminId = payload.sub;
    req.adminWallet = payload.wallet;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function isAdminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if (!req.adminId) {
      res.status(403).json({ error: "Admin identity could not be verified" });
      return;
    }
    next();
  });
}

async function auditLog(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
  ipAddress?: string
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: { adminId, action, entityType, entityId, details: details as any, ipAddress },
  });
}

// ──────────────────────────────────────────────
//  VALIDATION SCHEMAS
// ──────────────────────────────────────────────

const ResolveDisputeSchema = z.object({
  escrowId: z.number().int().nonnegative(),
  milestoneIndex: z.number().int().nonnegative(),
  outcome: z.enum(["FORCE_RELEASE", "FORCE_REFUND"]),
  buyerSharePercent: z.number().min(0).max(100).optional(),
  reason: z.string().min(10).max(2000),
});

const GlobalConfigSchema = z.object({
  feeBasisPoints: z.number().int().min(0).max(1000),
  maxFeeAbsolute: z.string(),
  feeRecipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const UserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "FROZEN"]),
  reason: z.string().min(5).max(500),
});

const TokenRegistrySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chainId: z.number().int().positive(),
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  decimals: z.number().int().min(0).max(18).default(18),
  logoUrl: z.string().url().optional(),
  isReflective: z.boolean().default(false),
  hasTax: z.boolean().default(false),
  taxBasisPoints: z.number().int().min(0).max(5000).optional(),
  coingeckoId: z.string().optional(),
});

const TokenUpdateSchema = z.object({
  symbol: z.string().min(1).max(20).optional(),
  name: z.string().min(1).max(100).optional(),
  decimals: z.number().int().min(0).max(18).optional(),
  logoUrl: z.string().url().nullable().optional(),
  isReflective: z.boolean().optional(),
  hasTax: z.boolean().optional(),
  taxBasisPoints: z.number().int().min(0).max(5000).nullable().optional(),
  coingeckoId: z.string().nullable().optional(),
});

// ──────────────────────────────────────────────
//  AUTH ENDPOINTS
// ──────────────────────────────────────────────

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@surveydeal.io";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "SurveyDeal@2024";
const ADMIN_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

router.post("/auth/simple-login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      res.status(401).json({ error: "Invalid admin credentials" });
      return;
    }

    // Find or create the admin user
    let user = await prisma.user.findUnique({
      where: { walletAddress: ADMIN_WALLET.toLowerCase() },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          walletAddress: ADMIN_WALLET.toLowerCase(),
          email: ADMIN_EMAIL,
          displayName: "Admin",
          isAdmin: true,
          role: "ADMIN",
        },
      });
    } else if (!user.isAdmin) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true, role: "ADMIN", email: ADMIN_EMAIL },
      });
    }

    if (user.isFrozen) {
      res.status(403).json({ error: "Admin account is frozen" });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, wallet: user.walletAddress, isAdmin: true },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
        email: user.email,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = req.body;

    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      res.status(401).json({ error: "Signature verification failed" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user?.isAdmin) {
      res.status(403).json({ error: "Not an admin account" });
      return;
    }

    if (user.isFrozen) {
      res.status(403).json({ error: "Account is frozen. Contact a super-administrator." });
      return;
    }

    const token = jwt.sign(
      { sub: user.id, wallet: user.walletAddress, isAdmin: true },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        displayName: user.displayName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Authentication failed" });
  }
});

// ──────────────────────────────────────────────
//  DISPUTE ARBITRATION CENTER
//  POST /api/admin/disputes/:id/resolve
// ──────────────────────────────────────────────

router.post("/disputes/:id/resolve", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = ResolveDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { escrowId, milestoneIndex, outcome, reason, buyerSharePercent } = parsed.data;

    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { milestones: true, disputes: true },
    }) as any;

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.state !== EscrowState.DISPUTED) {
      res.status(400).json({ error: `Escrow is in ${escrow.state} state, expected DISPUTED` });
      return;
    }

    if (escrow.mode !== "ARBITER") {
      res.status(400).json({ error: "Cannot arbitrate a locked-mode escrow. Both parties must use consensus resolution." });
      return;
    }

    const targetMilestone = escrow.milestones.find((m: any) => m.index === milestoneIndex);
    if (!targetMilestone) {
      res.status(400).json({ error: `Milestone index ${milestoneIndex} not found on this escrow` });
      return;
    }

    if (!targetMilestone.disputed) {
      res.status(400).json({ error: `Milestone ${milestoneIndex} is not in disputed state` });
      return;
    }

    if (targetMilestone.released) {
      res.status(400).json({ error: `Milestone ${milestoneIndex} has already been released` });
      return;
    }

    let buyerBasisPoints: number;

    if (outcome === "FORCE_RELEASE") {
      buyerBasisPoints = 0;
    } else if (outcome === "FORCE_REFUND") {
      buyerBasisPoints = 10000;
    } else {
      buyerBasisPoints = Math.round((buyerSharePercent ?? 50) * 100);
    }

    const contract = getContract();
    const tx = await contract.resolveDisputeByArbiter(escrowId, milestoneIndex, buyerBasisPoints);
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      res.status(502).json({ error: "On-chain transaction reverted" });
      return;
    }

    const dispute = escrow.disputes.find(
      (d: any) => d.milestoneId === targetMilestone.id && d.outcome === "PENDING"
    );

    let prismaOutcome: DisputeOutcome;
    if (buyerBasisPoints === 10000) {
      prismaOutcome = DisputeOutcome.BUYER_FAVORED;
    } else if (buyerBasisPoints === 0) {
      prismaOutcome = DisputeOutcome.SELLER_FAVORED;
    } else {
      prismaOutcome = DisputeOutcome.SPLIT;
    }

    if (dispute) {
      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          outcome: prismaOutcome,
          buyerShareBps: buyerBasisPoints,
          sellerShareBps: 10000 - buyerBasisPoints,
          resolverId: req.adminId,
          resolvedAt: new Date(),
        },
      });
    }

    await prisma.milestone.update({
      where: { id: targetMilestone.id },
      data: {
        released: true,
        disputed: false,
        releasedAt: new Date(),
      },
    });

    await prisma.transaction.create({
      data: {
        escrowId: escrow.id,
        txHash: receipt.hash,
        type: "DISPUTE_RESOLUTION",
        fromAddress: CONTRACT_ADDRESS,
        toAddress: outcome === "FORCE_REFUND" ? escrow.buyerId : escrow.sellerId,
        amount: targetMilestone.amount,
        chainId: escrow.chainId,
        blockNumber: receipt.blockNumber,
        status: "CONFIRMED",
      },
    });

    const allResolved = escrow.milestones.every(
      (m: any) => m.released || m.id === targetMilestone.id
    );

    await prisma.escrow.update({
      where: { id: escrow.id },
      data: {
        state: allResolved ? EscrowState.COMPLETED : EscrowState.ACTIVE,
        completedAt: allResolved ? new Date() : undefined,
      },
    });

    await auditLog(req.adminId!, "RESOLVE_DISPUTE", "escrow", escrow.id, {
      escrowId,
      milestoneIndex,
      outcome,
      buyerBasisPoints,
      reason,
      txHash: receipt.hash,
      prismaOutcome,
    }, req.ip ?? undefined);

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      outcome,
      buyerBasisPoints,
      sellerBasisPoints: 10000 - buyerBasisPoints,
      escrowNewState: allResolved ? "COMPLETED" : "ACTIVE",
    });
  } catch (err: any) {
    res.status(500).json({ error: "Dispute resolution failed", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  GLOBAL FEE & WALLET DESTINATION SWAPPER
//  POST /api/admin/config
// ──────────────────────────────────────────────

router.post("/config", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = GlobalConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { feeBasisPoints, maxFeeAbsolute, feeRecipient } = parsed.data;

    const previousConfig = await prisma.protocolConfig.findMany({
      where: { key: { in: ["feeBasisPoints", "maxFeeAbsolute", "feeRecipient"] } },
    });
    const previousMap: Record<string, string> = {};
    for (const cfg of previousConfig) {
      previousMap[cfg.key] = cfg.value;
    }

    const contract = getContract();
    const tx = await contract.updateFeeConfig(feeBasisPoints, maxFeeAbsolute, feeRecipient);
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      res.status(502).json({ error: "On-chain fee config update reverted" });
      return;
    }

    await prisma.protocolConfig.upsert({
      where: { key: "feeBasisPoints" },
      update: { value: String(feeBasisPoints), updatedBy: req.adminId },
      create: {
        key: "feeBasisPoints",
        value: String(feeBasisPoints),
        description: "Protocol fee in basis points (100 = 1%)",
        updatedBy: req.adminId,
      },
    });

    await prisma.protocolConfig.upsert({
      where: { key: "maxFeeAbsolute" },
      update: { value: maxFeeAbsolute, updatedBy: req.adminId },
      create: {
        key: "maxFeeAbsolute",
        value: maxFeeAbsolute,
        description: "Maximum absolute fee cap in token base units",
        updatedBy: req.adminId,
      },
    });

    await prisma.protocolConfig.upsert({
      where: { key: "feeRecipient" },
      update: { value: feeRecipient.toLowerCase(), updatedBy: req.adminId },
      create: {
        key: "feeRecipient",
        value: feeRecipient.toLowerCase(),
        description: "Wallet address receiving protocol fees",
        updatedBy: req.adminId,
      },
    });

    await auditLog(req.adminId!, "UPDATE_GLOBAL_CONFIG", "config", "fees", {
      previous: previousMap,
      updated: { feeBasisPoints, maxFeeAbsolute, feeRecipient },
      txHash: receipt.hash,
    }, req.ip ?? undefined);

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      config: {
        feeBasisPoints,
        feePercent: `${(feeBasisPoints / 100).toFixed(2)}%`,
        maxFeeAbsolute,
        feeRecipient,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update global config", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  USER ASSET FREEZING BLOCK
//  PATCH /api/admin/users/:id/status
// ──────────────────────────────────────────────

router.patch("/users/:id/status", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = UserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { status, reason } = parsed.data;
    const targetUserId = req.params.id as string;

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        buyerEscrows: { where: { state: { in: [EscrowState.CREATED, EscrowState.FUNDED, EscrowState.ACTIVE] } } },
        sellerEscrows: { where: { state: { in: [EscrowState.CREATED, EscrowState.FUNDED, EscrowState.ACTIVE] } } },
      },
    }) as any;

    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (targetUser.isAdmin && targetUser.id !== req.adminId) {
      res.status(403).json({ error: "Cannot freeze another admin. Revoke admin privileges first." });
      return;
    }

    if (targetUser.id === req.adminId && status === "FROZEN") {
      res.status(403).json({ error: "Cannot freeze your own account" });
      return;
    }

    const isFrozen = status === "FROZEN";

    await prisma.user.update({
      where: { id: targetUserId },
      data: { isFrozen },
    });

    const activeEscrowCount = targetUser.buyerEscrows.length + targetUser.sellerEscrows.length;

    await auditLog(req.adminId!, isFrozen ? "FREEZE_USER" : "UNFREEZE_USER", "user", targetUserId, {
      reason,
      walletAddress: targetUser.walletAddress,
      previousFrozenState: targetUser.isFrozen,
      activeEscrowsAtFreeze: activeEscrowCount,
    }, req.ip ?? undefined);

    res.json({
      success: true,
      user: {
        id: targetUser.id,
        walletAddress: targetUser.walletAddress,
        displayName: targetUser.displayName,
        isFrozen,
        status,
      },
      activeEscrows: activeEscrowCount,
      message: isFrozen
        ? `User ${targetUser.walletAddress} has been frozen. They cannot create new escrows or authenticate. ${activeEscrowCount} active escrow(s) remain in place.`
        : `User ${targetUser.walletAddress} has been unfrozen. Full access restored.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update user status", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ESCROW MANAGEMENT
// ──────────────────────────────────────────────

router.get("/escrows", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const {
      state,
      mode,
      chainId,
      page = "1",
      limit = "20",
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const where: Record<string, unknown> = {};
    if (state) where.state = state as EscrowState;
    if (mode) where.mode = mode;
    if (chainId) where.chainId = Number(chainId);

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [escrows, total] = await Promise.all([
      prisma.escrow.findMany({
        where,
        include: {
          buyer: { select: { id: true, walletAddress: true, displayName: true, isFrozen: true } },
          seller: { select: { id: true, walletAddress: true, displayName: true, isFrozen: true } },
          arbiter: { select: { id: true, walletAddress: true, displayName: true } },
          token: true,
          milestones: { orderBy: { index: "asc" } },
          _count: { select: { disputes: true } },
        },
        orderBy: { [sortBy as string]: sortOrder },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.escrow.count({ where }),
    ]);

    res.json({
      escrows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch escrows" });
  }
});

router.get("/escrows/:id", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: {
        buyer: true,
        seller: true,
        arbiter: true,
        token: true,
        milestones: { orderBy: { index: "asc" } },
        transactions: { orderBy: { createdAt: "desc" } },
        disputes: {
          include: { initiator: true, resolver: true },
          orderBy: { createdAt: "desc" },
        },
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
//  USER MANAGEMENT
// ──────────────────────────────────────────────

router.get("/users", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { search, frozen, role, page = "1", limit = "20" } = req.query;

    const where: Record<string, unknown> = {};
    if (frozen === "true") where.isFrozen = true;
    if (frozen === "false") where.isFrozen = false;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { walletAddress: { contains: search as string, mode: "insensitive" } },
        { displayName: { contains: search as string, mode: "insensitive" } },
        { email: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          _count: {
            select: {
              buyerEscrows: true,
              sellerEscrows: true,
              disputes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      users,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ──────────────────────────────────────────────
//  TOKEN REGISTRY
// ──────────────────────────────────────────────

router.get("/tokens", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, chainId, search } = req.query;
    const where: Record<string, unknown> = {};
    if (status) where.status = status as TokenStatus;
    if (chainId) where.chainId = Number(chainId);
    if (search) {
      where.OR = [
        { symbol: { contains: search as string, mode: "insensitive" } },
        { name: { contains: search as string, mode: "insensitive" } },
        { address: { contains: search as string, mode: "insensitive" } },
      ];
    }

    const tokens = await prisma.token.findMany({
      where,
      orderBy: { updatedAt: "desc" },
    });

    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

router.post("/tokens", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = TokenRegistrySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const token = await prisma.token.create({
      data: {
        ...parsed.data,
        address: parsed.data.address.toLowerCase(),
        addedBy: req.adminId,
      },
    });

    await auditLog(req.adminId!, "ADD_TOKEN", "token", token.id, parsed.data, req.ip ?? undefined);

    res.status(201).json(token);
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Token already registered on this chain" });
      return;
    }
    res.status(500).json({ error: "Failed to register token" });
  }
});

router.patch("/tokens/:id/status", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.body.status as string;
    if (!["ACTIVE", "BLACKLISTED", "FEATURED"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const token = await prisma.token.findUnique({ where: { id: req.params.id as string } }) as any;
    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    const contract = getContract();

    if (status === "BLACKLISTED") {
      const tx = await contract.blacklistToken(token.address);
      await tx.wait();
    } else if (token.status === "BLACKLISTED" && status !== "BLACKLISTED") {
      const tx = await contract.unblacklistToken(token.address);
      await tx.wait();
    }

    if (status === "FEATURED") {
      const tx = await contract.setFeaturedToken(token.address, true);
      await tx.wait();
    } else if (token.status === "FEATURED" && status !== "FEATURED") {
      const tx = await contract.setFeaturedToken(token.address, false);
      await tx.wait();
    }

    const updated = await prisma.token.update({
      where: { id: req.params.id as string },
      data: { status: status as any },
    });

    await auditLog(req.adminId!, "UPDATE_TOKEN_STATUS", "token", token.id, {
      previousStatus: token.status,
      newStatus: status,
    }, req.ip ?? undefined);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update token status", details: err.message });
  }
});

router.put("/tokens/:id", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = TokenUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const existing = await prisma.token.findUnique({ where: { id: req.params.id as string } });
    if (!existing) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    const updated = await prisma.token.update({
      where: { id: req.params.id as string },
      data: parsed.data,
    });

    await auditLog(req.adminId!, "UPDATE_TOKEN", "token", updated.id, {
      before: {
        symbol: existing.symbol,
        name: existing.name,
        decimals: existing.decimals,
        isReflective: existing.isReflective,
        hasTax: existing.hasTax,
        taxBasisPoints: existing.taxBasisPoints,
      },
      after: parsed.data,
    }, req.ip ?? undefined);

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update token", details: err.message });
  }
});

router.delete("/tokens/:id", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const token = await prisma.token.findUnique({
      where: { id: req.params.id as string },
      include: { _count: { select: { escrows: true } } },
    });

    if (!token) {
      res.status(404).json({ error: "Token not found" });
      return;
    }

    if (token._count.escrows > 0) {
      res.status(409).json({
        error: "Cannot delete token with active escrows",
        activeEscrows: token._count.escrows,
      });
      return;
    }

    if (token.status !== "BLACKLISTED") {
      const contract = getContract();
      const tx = await contract.blacklistToken(token.address);
      await tx.wait();
    }

    await prisma.token.delete({ where: { id: req.params.id as string } });

    await auditLog(req.adminId!, "DELETE_TOKEN", "token", token.id, {
      address: token.address,
      symbol: token.symbol,
      chainId: token.chainId,
    }, req.ip ?? undefined);

    res.json({ success: true, deletedToken: token.symbol });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete token", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  PROTOCOL PAUSE / UNPAUSE
// ──────────────────────────────────────────────

router.post("/config/pause", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contract = getContract();
    const tx = await contract.pause();
    await tx.wait();

    await prisma.protocolConfig.upsert({
      where: { key: "paused" },
      update: { value: "true", updatedBy: req.adminId },
      create: { key: "paused", value: "true", description: "Protocol pause state", updatedBy: req.adminId },
    });

    await auditLog(req.adminId!, "PAUSE_PROTOCOL", "config", "protocol", {}, req.ip ?? undefined);

    res.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to pause protocol", details: err.message });
  }
});

router.post("/config/unpause", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const contract = getContract();
    const tx = await contract.unpause();
    await tx.wait();

    await prisma.protocolConfig.upsert({
      where: { key: "paused" },
      update: { value: "false", updatedBy: req.adminId },
      create: { key: "paused", value: "false", description: "Protocol pause state", updatedBy: req.adminId },
    });

    await auditLog(req.adminId!, "UNPAUSE_PROTOCOL", "config", "protocol", {}, req.ip ?? undefined);

    res.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to unpause protocol", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ARBITER MANAGEMENT
// ──────────────────────────────────────────────

router.post("/arbiters", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const contract = getContract();
    const tx = await contract.addArbiter(walletAddress);
    await tx.wait();

    const user = await prisma.user.upsert({
      where: { walletAddress: walletAddress.toLowerCase() },
      update: { isArbiter: true, role: "ARBITER" },
      create: { walletAddress: walletAddress.toLowerCase(), isArbiter: true, role: "ARBITER" },
    });

    await auditLog(req.adminId!, "ADD_ARBITER", "user", user.id, { walletAddress }, req.ip ?? undefined);

    res.json({ success: true, user, txHash: tx.hash });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to add arbiter", details: err.message });
  }
});

router.delete("/arbiters/:walletAddress", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const walletAddress = req.params.walletAddress as string;

    const contract = getContract();
    const tx = await contract.removeArbiter(walletAddress);
    await tx.wait();

    const user = await prisma.user.update({
      where: { walletAddress: walletAddress.toLowerCase() },
      data: { isArbiter: false, role: "BUYER" },
    });

    await auditLog(req.adminId!, "REMOVE_ARBITER", "user", user.id, { walletAddress }, req.ip ?? undefined);

    res.json({ success: true, txHash: tx.hash });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to remove arbiter", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ANALYTICS DASHBOARD
// ──────────────────────────────────────────────

router.get("/analytics/overview", isAdminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalEscrows,
      activeEscrows,
      disputedEscrows,
      completedEscrows,
      refundedEscrows,
      totalUsers,
      frozenUsers,
      allEscrows,
      recentTransactions,
    ] = await Promise.all([
      prisma.escrow.count(),
      prisma.escrow.count({ where: { state: EscrowState.ACTIVE } }),
      prisma.escrow.count({ where: { state: EscrowState.DISPUTED } }),
      prisma.escrow.count({ where: { state: EscrowState.COMPLETED } }),
      prisma.escrow.count({ where: { state: EscrowState.REFUNDED } }),
      prisma.user.count(),
      prisma.user.count({ where: { isFrozen: true } }),
      prisma.escrow.findMany({ select: { fundedAmount: true, protocolFeeTotal: true } }),
      prisma.transaction.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { escrow: { include: { token: true } } },
      }),
    ]);

    let totalVolume = BigInt(0);
    let totalFees = BigInt(0);
    for (const e of allEscrows) {
      if (e.fundedAmount) totalVolume += BigInt(e.fundedAmount);
      if (e.protocolFeeTotal) totalFees += BigInt(e.protocolFeeTotal);
    }

    res.json({
      totalEscrows,
      activeEscrows,
      disputedEscrows,
      completedEscrows,
      refundedEscrows,
      totalUsers,
      frozenUsers,
      totalVolume: totalVolume.toString(),
      totalFees: totalFees.toString(),
      recentTransactions,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ──────────────────────────────────────────────
//  AUDIT LOG
// ──────────────────────────────────────────────

router.get("/audit-log", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = "1", limit = "50", action, entityType } = req.query;
    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

// ──────────────────────────────────────────────
//  ADMIN: APPROVE & RELEASE ESCROW FUNDS
//  POST /api/admin/escrows/:id/approve-release
// ──────────────────────────────────────────────

router.post("/escrows/:id/approve-release", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { notes } = req.body;
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: { token: true, buyer: true, seller: true },
    });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (escrow.adminApproved) {
      res.status(400).json({ error: "Escrow already approved" });
      return;
    }

    if (escrow.state !== "FUNDED" && escrow.state !== "ACTIVE") {
      res.status(400).json({ error: `Cannot approve escrow in ${escrow.state} state. Must be FUNDED or ACTIVE.` });
      return;
    }

    const updated = await prisma.escrow.update({
      where: { id: req.params.id as string },
      data: {
        adminApproved: true,
        adminApprovedBy: req.adminId,
        adminApprovedAt: new Date(),
        adminNotes: notes || null,
      },
      include: { token: true, buyer: true, seller: true, milestones: true },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.adminId!,
        action: "APPROVE_RELEASE",
        entityType: "Escrow",
        entityId: escrow.id,
        details: {
          onChainId: escrow.onChainId,
          totalAmount: escrow.totalAmount,
          tokenSymbol: escrow.token?.symbol,
          sellerAddress: escrow.seller.walletAddress,
          notes: notes || null,
        },
      },
    });

    await prisma.transaction.create({
      data: {
        escrowId: escrow.id,
        txHash: `admin-release-${Date.now()}-${escrow.id}`,
        type: "ADMIN_RELEASE",
        fromAddress: "ADMIN",
        toAddress: escrow.seller.walletAddress,
        amount: escrow.totalAmount,
        chainId: escrow.chainId,
        status: "APPROVED",
      },
    });

    res.json({
      success: true,
      message: "Escrow funds approved for release",
      escrow: updated,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to approve escrow", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ADMIN: REVOKE APPROVAL
//  POST /api/admin/escrows/:id/revoke-approval
// ──────────────────────────────────────────────

router.post("/escrows/:id/revoke-approval", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { reason } = req.body;
    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id as string } });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (!escrow.adminApproved) {
      res.status(400).json({ error: "Escrow is not currently approved" });
      return;
    }

    const updated = await prisma.escrow.update({
      where: { id: req.params.id as string },
      data: {
        adminApproved: false,
        adminNotes: reason ? `REVOKED: ${reason}` : "Approval revoked by admin",
      },
      include: { token: true, buyer: true, seller: true, milestones: true },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: req.adminId!,
        action: "REVOKE_APPROVAL",
        entityType: "Escrow",
        entityId: escrow.id,
        details: { reason: reason || "No reason provided" },
      },
    });

    res.json({ success: true, message: "Approval revoked", escrow: updated });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to revoke approval", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ADMIN: GET PENDING APPROVALS
//  GET /api/admin/pending-approvals
// ──────────────────────────────────────────────

router.get("/pending-approvals", isAdminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const escrows = await prisma.escrow.findMany({
      where: {
        adminApproved: false,
        state: { in: ["FUNDED", "ACTIVE"] },
      },
      include: {
        token: true,
        buyer: true,
        seller: true,
        milestones: true,
        transactions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ escrows, count: escrows.length });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch pending approvals", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ADMIN: DEPOSIT TRACKING OVERVIEW
//  GET /api/admin/deposits
// ──────────────────────────────────────────────

router.get("/deposits", isAdminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const where: Record<string, unknown> = {
      type: { in: ["FUND", "DEPOSIT_WALLET"] },
    };
    if (status) where.status = status;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          escrow: {
            include: { token: true, buyer: true, seller: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({
      deposits: transactions,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch deposits", details: err.message });
  }
});

// ──────────────────────────────────────────────
//  ADMIN: VAULT BALANCE SUMMARY
//  GET /api/admin/vault-summary
// ──────────────────────────────────────────────

router.get("/vault-summary", isAdminMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const escrows = await prisma.escrow.findMany({
      where: { state: { in: ["FUNDED", "ACTIVE", "COMPLETED"] } },
      include: { token: true },
    });

    const vaultByToken: Record<string, { symbol: string; totalLocked: string; totalReleased: string; count: number }> = {};

    for (const e of escrows) {
      const sym = e.token?.symbol || "UNKNOWN";
      if (!vaultByToken[sym]) {
        vaultByToken[sym] = { symbol: sym, totalLocked: "0", totalReleased: "0", count: 0 };
      }
      vaultByToken[sym].count++;
      const locked = BigInt(e.fundedAmount || "0") - BigInt(e.releasedAmount || "0");
      vaultByToken[sym].totalLocked = (BigInt(vaultByToken[sym].totalLocked) + locked).toString();
      vaultByToken[sym].totalReleased = (BigInt(vaultByToken[sym].totalReleased) + BigInt(e.releasedAmount || "0")).toString();
    }

    const pendingApprovals = await prisma.escrow.count({
      where: { adminApproved: false, state: { in: ["FUNDED", "ACTIVE"] } },
    });

    res.json({
      vault: Object.values(vaultByToken),
      totalEscrows: escrows.length,
      pendingApprovals,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch vault summary", details: err.message });
  }
});

export default router;
