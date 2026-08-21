import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { SUPPORTED_CHAINS } from "../lib/chains";
import { releaseMilestone, releaseAllMilestones } from "../services/escrowRelease";
import { processRefund } from "../services/refundService";
import { authLimiter } from "../middleware/rateLimiter";
import { validate } from "../middleware/validate";
import { adminLoginSchema, adminDisputeResolveSchema, adminTokenStatusSchema, adminUserStatusSchema } from "../middleware/schemas";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable must be set");
}

// ══════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════

interface AuthRequest extends Request {
  adminId?: string;
  adminWallet?: string;
}

async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET!) as {
      sub: string;
      wallet: string;
      isAdmin: boolean;
    };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, walletAddress: true, isAdmin: true, isFrozen: true },
    });
    if (!user || !payload.isAdmin || !user.isAdmin || user.walletAddress !== payload.wallet?.toLowerCase()) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    if (user.isFrozen) {
      res.status(403).json({ error: "Admin account is frozen" });
      return;
    }
    req.adminId = user.id;
    req.adminWallet = user.walletAddress;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ══════════════════════════════════════════════════════════════
//  ADMIN AUTH ENDPOINTS
// ══════════════════════════════════════════════════════════════

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

let adminPasswordHash: string | null = null;
(async () => {
  if (ADMIN_PASSWORD) {
    adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  }
})();

router.post("/auth/simple-login", authLimiter, validate(adminLoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_WALLET) {
      res.status(503).json({ error: "Admin credentials are not configured" });
      return;
    }
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (!ADMIN_EMAIL || !adminPasswordHash) {
      res.status(500).json({ error: "Admin credentials not configured" });
      return;
    }
    const emailMatch = email === ADMIN_EMAIL;
    const passwordMatch = await bcrypt.compare(password, adminPasswordHash);
    if (!emailMatch || !passwordMatch) {
      res.status(401).json({ error: "Invalid admin credentials" });
      return;
    }

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

    const token = jwt.sign(
      { sub: user.id, wallet: user.walletAddress, isAdmin: true },
      JWT_SECRET!,
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
    console.error("[ADMIN AUTH]", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/auth/login", authLimiter, async (req: Request, res: Response) => {
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

    const token = jwt.sign(
      { sub: user.id, wallet: user.walletAddress, isAdmin: true },
      JWT_SECRET!,
      { expiresIn: "24h" }
    );

    res.json({ token, user: { id: user.id, walletAddress: user.walletAddress } });
  } catch {
    res.status(500).json({ error: "Authentication failed" });
  }
});

// ══════════════════════════════════════════════════════════════
//  ADMIN ASSET DASHBOARD
// ══════════════════════════════════════════════════════════════

router.get("/analytics/overview", authMiddleware, async (_req: AuthRequest, res: Response) => {
  try {
    const [
      totalEscrows,
      activeEscrows,
      disputedEscrows,
      completedEscrows,
      refundedEscrows,
      totalUsers,
      frozenUsers,
    ] = await Promise.all([
      prisma.escrow.count(),
      prisma.escrow.count({ where: { state: "ACTIVE" } }),
      prisma.escrow.count({ where: { state: "DISPUTED" } }),
      prisma.escrow.count({ where: { state: "COMPLETED" } }),
      prisma.escrow.count({ where: { state: "REFUNDED" } }),
      prisma.user.count(),
      prisma.user.count({ where: { isFrozen: true } }),
    ]);

    const allEscrows = await prisma.escrow.findMany({
      select: { fundedAmount: true, protocolFeeTotal: true },
    });

    let totalVolume = BigInt(0);
    let totalFees = BigInt(0);
    for (const e of allEscrows) {
      totalVolume += BigInt(e.fundedAmount || "0");
      totalFees += BigInt(e.protocolFeeTotal || "0");
    }

    const recentTransactions = await prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        escrow: {
          select: { id: true, title: true, onChainId: true },
        },
      },
    });

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
  } catch (err: any) {
    console.error("[ADMIN ANALYTICS]", err);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ── Per-User Asset Summary ─────────────────────────────────

router.get("/user-assets", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (search) {
      where.OR = [
        { walletAddress: { contains: (search as string).toLowerCase(), mode: "insensitive" } },
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
          wallets: true,
          buyerEscrows: {
            select: {
              id: true,
              totalAmount: true,
              fundedAmount: true,
              releasedAmount: true,
              state: true,
              network: true,
              token: { select: { symbol: true, decimals: true } },
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
          sellerEscrows: {
            select: {
              id: true,
              totalAmount: true,
              fundedAmount: true,
              releasedAmount: true,
              state: true,
              network: true,
              token: { select: { symbol: true, decimals: true } },
              createdAt: true,
            },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.user.count({ where }),
    ]);

    const userAssets = users.map((u: any) => {
      let totalBuyVolume = BigInt(0);
      let totalSellVolume = BigInt(0);
      let activeBuyEscrows = 0;
      let activeSellEscrows = 0;

      for (const e of u.buyerEscrows) {
        totalBuyVolume += BigInt(e.fundedAmount || "0");
        if (["ACTIVE", "FUNDED", "CREATED", "DISPUTED"].includes(e.state)) activeBuyEscrows++;
      }
      for (const e of u.sellerEscrows) {
        totalSellVolume += BigInt(e.fundedAmount || "0");
        if (["ACTIVE", "FUNDED", "CREATED", "DISPUTED"].includes(e.state)) activeSellEscrows++;
      }

      return {
        id: u.id,
        walletAddress: u.walletAddress,
        displayName: u.displayName,
        email: u.email,
        role: u.role,
        isAdmin: u.isAdmin,
        isArbiter: u.isArbiter,
        isFrozen: u.isFrozen,
        createdAt: u.createdAt,
        wallets: u.wallets,
        stats: {
          totalBuyVolume: totalBuyVolume.toString(),
          totalSellVolume: totalSellVolume.toString(),
          totalBuyEscrows: u.buyerEscrows.length,
          totalSellEscrows: u.sellerEscrows.length,
          activeBuyEscrows,
          activeSellEscrows,
          totalVolume: (totalBuyVolume + totalSellVolume).toString(),
        },
        recentBuyEscrows: u.buyerEscrows.slice(0, 5),
        recentSellEscrows: u.sellerEscrows.slice(0, 5),
      };
    });

    res.json({
      users: userAssets,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    console.error("[ADMIN USER ASSETS]", err);
    res.status(500).json({ error: "Failed to fetch user assets" });
  }
});

// ── Per-User Wallet Management ─────────────────────────────

router.get("/users/:id/wallets", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const wallets = await prisma.userWallet.findMany({
      where: { userId: req.params.id as string as string },
      orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
    });
    res.json(wallets);
  } catch {
    res.status(500).json({ error: "Failed to fetch wallets" });
  }
});

router.post("/users/:id/wallets", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { address, network, label, isPreferred } = req.body;
    if (!address || !network) {
      res.status(400).json({ error: "address and network are required" });
      return;
    }

    const wallet = await prisma.userWallet.create({
      data: {
        userId: req.params.id as string as string,
        address: address.toLowerCase(),
        network: network as any,
        label,
        isPreferred: isPreferred || false,
      },
    });

    await auditLog(req.adminId!, "ADD_USER_WALLET", "wallet", wallet.id, { address, network }, req.ip || "");
    res.status(201).json(wallet);
  } catch (err: any) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "Wallet already exists for this user on this network" });
      return;
    }
    res.status(500).json({ error: "Failed to add wallet" });
  }
});

router.patch("/users/:userId/wallets/:walletId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { isPreferred, label } = req.body;
    const wallet = await prisma.userWallet.update({
      where: { id: req.params.walletId as string },
      data: {
        ...(isPreferred !== undefined && { isPreferred }),
        ...(label !== undefined && { label }),
      },
    });
    res.json(wallet);
  } catch {
    res.status(500).json({ error: "Failed to update wallet" });
  }
});

router.delete("/users/:userId/wallets/:walletId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.userWallet.delete({ where: { id: req.params.walletId as string } });
    await auditLog(req.adminId!, "REMOVE_USER_WALLET", "wallet", req.params.walletId as string, {}, req.ip || "");
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete wallet" });
  }
});

// ══════════════════════════════════════════════════════════════
//  ADMIN MILESTONE RELEASE (CUSTODIAL)
// ══════════════════════════════════════════════════════════════

router.post("/escrows/:id/approve-milestone/:milestoneIndex", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const escrowId = req.params.id as string;
    const milestoneIndex = parseInt(req.params.milestoneIndex as string);

    const escrow: any = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { milestones: true, token: true },
    });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const milestone = escrow.milestones.find((m: any) => m.index === milestoneIndex);
    if (!milestone) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }

    if (milestone.released) {
      res.status(400).json({ error: "Milestone already released" });
      return;
    }

    if (!["FUNDED", "ACTIVE"].includes(escrow.state)) {
      res.status(400).json({ error: `Cannot release funds from escrow in state: ${escrow.state}` });
      return;
    }

    const result = await releaseMilestone(escrowId, milestoneIndex, req.adminId!);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    await auditLog(
      req.adminId!,
      "ADMIN_RELEASE_MILESTONE",
      "escrow",
      escrowId,
      { milestoneIndex, txHash: result.txHash },
      req.ip
    );

    res.json({
      success: true,
      txHash: result.txHash,
      blockNumber: result.blockNumber,
      milestoneIndex,
    });
  } catch (err: any) {
    console.error("[ADMIN APPROVE MILESTONE]", err);
    res.status(500).json({ error: "Failed to release milestone", details: err.message });
  }
});

router.post("/escrows/:id/approve-all", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const escrowId = req.params.id as string;

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { milestones: true },
    });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    if (!["FUNDED", "ACTIVE"].includes(escrow.state)) {
      res.status(400).json({ error: `Cannot release funds from escrow in state: ${escrow.state}` });
      return;
    }

    const result = await releaseAllMilestones(escrowId, req.adminId!);

    if (!result.success) {
      res.status(500).json({ error: result.error });
      return;
    }

    await auditLog(req.adminId!, "ADMIN_RELEASE_ALL_MILESTONES", "escrow", escrowId, { txHash: result.txHash }, req.ip || "");

    res.json({ success: true, txHash: result.txHash, blockNumber: result.blockNumber });
  } catch (err: any) {
    console.error("[ADMIN APPROVE ALL]", err);
    res.status(500).json({ error: "Failed to release all milestones", details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  ADMIN ESCROW & USER MANAGEMENT
// ══════════════════════════════════════════════════════════════

router.get("/escrows", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { state, network, search, page = "1", limit = "20", sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const where: any = {};
    if (state) where.state = state as string;
    if (network) where.network = network as string;

    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: "insensitive" } },
        { buyer: { walletAddress: { contains: (search as string).toLowerCase() } } },
        { seller: { walletAddress: { contains: (search as string).toLowerCase() } } },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [escrows, total] = await Promise.all([
      prisma.escrow.findMany({
        where,
        include: {
          buyer: { select: { id: true, walletAddress: true, displayName: true, isFrozen: true } },
          seller: { select: { id: true, walletAddress: true, displayName: true, isFrozen: true } },
          arbiter: { select: { id: true, walletAddress: true, displayName: true } },
          token: { select: { symbol: true, decimals: true, network: true, logoUrl: true } },
          milestones: { orderBy: { index: "asc" } },
          _count: { select: { transactions: true } },
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
  } catch (err: any) {
    console.error("[ADMIN ESCROWS]", err);
    res.status(500).json({ error: "Failed to fetch escrows" });
  }
});

router.get("/escrows/:id", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { id: req.params.id as string },
      include: {
        buyer: { select: { id: true, walletAddress: true, displayName: true, isFrozen: true, wallets: true } },
        seller: { select: { id: true, walletAddress: true, displayName: true, isFrozen: true, wallets: true } },
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

    res.json(escrow);
  } catch (err: any) {
    console.error("[ADMIN ESCROW DETAIL]", err);
    res.status(500).json({ error: "Failed to fetch escrow" });
  }
});

router.get("/users", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { search, frozen, role, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (frozen === "true") where.isFrozen = true;
    if (frozen === "false") where.isFrozen = false;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { walletAddress: { contains: (search as string).toLowerCase(), mode: "insensitive" } },
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
  } catch (err: any) {
    console.error("[ADMIN USERS]", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.patch("/users/:id/status", authMiddleware, validate(adminUserStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!["ACTIVE", "FROZEN"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id: req.params.id as string } });
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (targetUser.isAdmin && targetUser.id !== req.adminId) {
      res.status(403).json({ error: "Cannot freeze another admin" });
      return;
    }

    const isFrozen = status === "FROZEN";
    await prisma.user.update({ where: { id: req.params.id as string }, data: { isFrozen } });

    await auditLog(req.adminId!, isFrozen ? "FREEZE_USER" : "UNFREEZE_USER", "user", req.params.id as string, { reason, walletAddress: targetUser.walletAddress }, req.ip || "");

    res.json({ success: true, user: { id: targetUser.id, walletAddress: targetUser.walletAddress, isFrozen } });
  } catch (err: any) {
    console.error("[ADMIN USER STATUS]", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// ══════════════════════════════════════════════════════════════
//  ADMIN DISPUTE MANAGEMENT
// ══════════════════════════════════════════════════════════════

router.get("/disputes", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { outcome, page = "1", limit = "20" } = req.query;
    const where: any = {};
    if (outcome) where.outcome = outcome as string;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
        include: {
          escrow: { select: { id: true, title: true, onChainId: true, state: true, totalAmount: true, network: true } },
          initiator: { select: { id: true, walletAddress: true, displayName: true } },
          resolver: { select: { id: true, walletAddress: true, displayName: true } },
          milestone: { select: { id: true, index: true, description: true, amount: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.dispute.count({ where }),
    ]);

    res.json({ disputes, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (err: any) {
    console.error("[ADMIN DISPUTES]", err);
    res.status(500).json({ error: "Failed to fetch disputes" });
  }
});

router.post("/disputes/:id/resolve", authMiddleware, validate(adminDisputeResolveSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { outcome } = req.body;
    if (!["BUYER_FAVORED", "SELLER_FAVORED", "SPLIT"].includes(outcome)) {
      res.status(400).json({ error: "outcome must be BUYER_FAVORED, SELLER_FAVORED, or SPLIT" });
      return;
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: req.params.id as string },
      include: { escrow: true },
    });
    if (!dispute) { res.status(404).json({ error: "Dispute not found" }); return; }
    if (dispute.outcome !== "PENDING") { res.status(400).json({ error: "Dispute already resolved" }); return; }

    await prisma.dispute.update({
      where: { id: dispute.id },
      data: { outcome, resolverId: req.adminId, resolvedAt: new Date() },
    });

    if (outcome === "SELLER_FAVORED") {
      await prisma.escrow.update({ where: { id: dispute.escrowId }, data: { state: "ACTIVE" } });
    } else if (outcome === "BUYER_FAVORED") {
      const refundResult = await processRefund(dispute.escrowId);
      if (!refundResult.success) {
        res.status(500).json({ error: `Refund failed: ${refundResult.error}` });
        return;
      }
    } else {
      await prisma.escrow.update({ where: { id: dispute.escrowId }, data: { state: "ACTIVE" } });
    }

    await auditLog(req.adminId!, "RESOLVE_DISPUTE", "dispute", dispute.id, { outcome, escrowId: dispute.escrowId }, req.ip || "");

    res.json({ success: true, outcome });
  } catch (err: any) {
    console.error("[ADMIN RESOLVE DISPUTE]", err);
    res.status(500).json({ error: "Failed to resolve dispute" });
  }
});

// ══════════════════════════════════════════════════════════════
//  ADMIN TOKEN MANAGEMENT
// ══════════════════════════════════════════════════════════════

router.get("/tokens", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, chainId, page = "1", limit = "50" } = req.query;
    const where: any = {};
    if (status) where.status = status as string;
    if (chainId) where.chainId = Number(chainId);

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));

    const [tokens, total] = await Promise.all([
      prisma.token.findMany({
        where,
        orderBy: [{ status: "desc" }, { symbol: "asc" }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.token.count({ where }),
    ]);

    res.json({ tokens, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch {
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

router.patch("/tokens/:id/status", authMiddleware, validate(adminTokenStatusSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.body;
    if (!["ACTIVE", "BLACKLISTED", "FEATURED"].includes(status)) {
      res.status(400).json({ error: "status must be ACTIVE, BLACKLISTED, or FEATURED" });
      return;
    }

    const token = await prisma.token.update({
      where: { id: req.params.id as string },
      data: { status },
    });

    await auditLog(req.adminId!, "UPDATE_TOKEN_STATUS", "token", token.id, { status, symbol: token.symbol }, req.ip || "");
    res.json(token);
  } catch {
    res.status(500).json({ error: "Failed to update token status" });
  }
});

// ══════════════════════════════════════════════════════════════
//  SUPPORTED CHAINS ENDPOINT
// ══════════════════════════════════════════════════════════════

router.get("/chains", authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.json({
    chains: [
      { id: "ETHEREUM", name: "Ethereum", chainId: 1, type: "evm", blockExplorer: "https://etherscan.io", nativeCurrency: "ETH" },
      { id: "BNB_CHAIN", name: "BNB Chain", chainId: 56, type: "evm", blockExplorer: "https://bscscan.com", nativeCurrency: "BNB" },
      { id: "POLYGON", name: "Polygon", chainId: 137, type: "evm", blockExplorer: "https://polygonscan.com", nativeCurrency: "MATIC" },
      { id: "ARBITRUM", name: "Arbitrum One", chainId: 42161, type: "evm", blockExplorer: "https://arbiscan.io", nativeCurrency: "ETH" },
      { id: "BASE", name: "Base", chainId: 8453, type: "evm", blockExplorer: "https://basescan.org", nativeCurrency: "ETH" },
      { id: "AVALANCHE", name: "Avalanche C-Chain", chainId: 43114, type: "evm", blockExplorer: "https://snowtrace.io", nativeCurrency: "AVAX" },
      { id: "OPTIMISM", name: "Optimism", chainId: 10, type: "evm", blockExplorer: "https://optimistic.etherscan.io", nativeCurrency: "ETH" },
      { id: "FANTOM", name: "Fantom", chainId: 250, type: "evm", blockExplorer: "https://ftmscan.com", nativeCurrency: "FTM" },
    ],
  });
});

// ══════════════════════════════════════════════════════════════
//  AUDIT LOG
// ══════════════════════════════════════════════════════════════

async function auditLog(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>,
  ipAddress?: string
) {
  try {
    await prisma.adminAuditLog.create({
      data: { adminId, action, entityType, entityId, details: details as any, ipAddress },
    });
  } catch (err) {
    console.error("[AUDIT LOG ERROR]", err);
  }
}

router.get("/audit-log", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { page = "1", limit = "50" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(200, Math.max(1, Number(limit)));

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.adminAuditLog.count(),
    ]);

    res.json({
      logs,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

export default router;
