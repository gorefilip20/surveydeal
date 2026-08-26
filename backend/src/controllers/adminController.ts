import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient, EscrowState, Dispoutcome, ChainNetwork } from "@prisma/client";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { z } from "zod";

const prisma = new PrismaClient();
const router = Router();

const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";

// ══════════════════════════════════════════════════════════════
//  AUTH MIDDLEWARE
// ══════════════════════════════════════════════════════════════

interface AuthRequest extends Request {
  adminId?: string;
  adminWallet?: string;
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
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

// ══════════════════════════════════════════════════════════════
//  ADMIN AUTH ENDPOINTS
// ══════════════════════════════════════════════════════════════

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_WALLET = process.env.ADMIN_WALLET?.toLowerCase();

router.post("/auth/simple-login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_WALLET) {
      res.status(503).json({ error: "Admin authentication is not configured" });
      return;
    }
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
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
    console.error("[ADMIN AUTH]", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!ADMIN_WALLET) {
      res.status(503).json({ error: "Admin authentication is not configured" });
      return;
    }

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
      JWT_SECRET,
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
    const { search, network, page = "1", limit = "20" } = req.query;

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

    const userAssets = users.map((u) => {
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
      where: { userId: String(req.params.id) },
      orderBy: [{ isPreferred: "desc" }, { createdAt: "desc" }],
    });
    res.json(wallets);
  } catch (err: any) {
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
        userId: String(req.params.id),
        address: address.toLowerCase(),
        network: network as ChainNetwork,
        label,
        isPreferred: isPreferred || false,
      },
    });

    await auditLog(req.adminId!, "ADD_USER_WALLET", "wallet", wallet.id, { address, network }, req.ip);
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
      where: { id: String(req.params.walletId) },
      data: {
        ...(isPreferred !== undefined && { isPreferred }),
        ...(label !== undefined && { label }),
      },
    });
    res.json(wallet);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to update wallet" });
  }
});

router.delete("/users/:userId/wallets/:walletId", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.userWallet.delete({ where: { id: String(req.params.walletId) } });
    await auditLog(req.adminId!, "REMOVE_USER_WALLET", "wallet", String(req.params.walletId), {}, req.ip);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete wallet" });
  }
});

// ══════════════════════════════════════════════════════════════
//  ADMIN APPROVAL FOR ESCROWS
// ══════════════════════════════════════════════════════════════

router.post("/escrows/:id/approve-milestone/:milestoneIndex", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const escrowId = String(req.params.id);
    const milestoneIndex = parseInt(String(req.params.milestoneIndex));

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { milestones: true, token: true },
    });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const milestone = escrow.milestones.find((m) => m.index === milestoneIndex);
    if (!milestone) {
      res.status(404).json({ error: "Milestone not found" });
      return;
    }

    if (milestone.released) {
      res.status(400).json({ error: "Milestone already released" });
      return;
    }

    // Call smart contract adminApproveMilestone
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    // Import contract ABI
    const ESCROW_ABI = [
      "function adminApproveMilestone(uint256 escrowId, uint256 milestoneIndex) external",
      "function adminForceRelease(uint256 escrowId, uint256 milestoneIndex) external",
    ];

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ESCROW_ABI, wallet);

    let tx;
    const { force } = req.body;

    if (force) {
      tx = await contract.adminForceRelease(escrow.onChainId, milestoneIndex);
    } else {
      tx = await contract.adminApproveMilestone(escrow.onChainId, milestoneIndex);
    }

    const receipt = await tx.wait();

    // Update milestone in DB
    await prisma.milestone.update({
      where: { id: milestone.id },
      data: {
        adminApproved: true,
        released: true,
        releasedAt: new Date(),
      },
    });

    // Create transaction record
    await prisma.transaction.create({
      data: {
        escrowId: escrow.id,
        txHash: receipt.hash,
        type: "ADMIN_RELEASE",
        fromAddress: CONTRACT_ADDRESS,
        toAddress: escrow.sellerId,
        amount: milestone.amount,
        chainId: escrow.chainId,
        blockNumber: receipt.blockNumber,
      },
    });

    await auditLog(
      req.adminId!,
      force ? "ADMIN_FORCE_RELEASE" : "ADMIN_APPROVE_MILESTONE",
      "escrow",
      escrowId,
      { milestoneIndex, txHash: receipt.hash, force },
      req.ip
    );

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      milestoneIndex,
    });
  } catch (err: any) {
    console.error("[ADMIN APPROVE MILESTONE]", err);
    res.status(500).json({ error: "Failed to approve milestone", details: err.message });
  }
});

router.post("/escrows/:id/approve-all", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const escrowId = String(req.params.id);

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: { milestones: true },
    });

    if (!escrow) {
      res.status(404).json({ error: "Escrow not found" });
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);

    const ESCROW_ABI = [
      "function adminApproveAllMilestones(uint256 escrowId) external",
    ];

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ESCROW_ABI, wallet);
    const tx = await contract.adminApproveAllMilestones(escrow.onChainId);
    const receipt = await tx.wait();

    // Update all unreleased milestones
    await prisma.milestone.updateMany({
      where: { escrowId, released: false },
      data: { adminApproved: true, released: true, releasedAt: new Date() },
    });

    await auditLog(req.adminId!, "ADMIN_APPROVE_ALL_MILESTONES", "escrow", escrowId, { txHash: receipt.hash }, req.ip);

    res.json({ success: true, txHash: receipt.hash });
  } catch (err: any) {
    console.error("[ADMIN APPROVE ALL]", err);
    res.status(500).json({ error: "Failed to approve all milestones", details: err.message });
  }
});

// ══════════════════════════════════════════════════════════════
//  EXISTING ADMIN ENDPOINTS (simplified, unchanged logic)
// ══════════════════════════════════════════════════════════════

router.get("/escrows", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { state, network, search, page = "1", limit = "20", sortBy = "createdAt", sortOrder = "desc" } = req.query;

    const where: any = {};
    if (state) where.state = state as EscrowState;
    if (network) where.network = network as ChainNetwork;

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
      where: { id: String(req.params.id) },
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

router.patch("/users/:id/status", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, reason } = req.body;
    if (!["ACTIVE", "FROZEN"].includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    if (targetUser.isAdmin && targetUser.id !== req.adminId) {
      res.status(403).json({ error: "Cannot freeze another admin" });
      return;
    }

    const isFrozen = status === "FROZEN";
    await prisma.user.update({ where: { id: String(req.params.id) }, data: { isFrozen } });

    await auditLog(req.adminId!, isFrozen ? "FREEZE_USER" : "UNFREEZE_USER", "user", String(req.params.id), { reason, walletAddress: targetUser.walletAddress }, req.ip);

    res.json({ success: true, user: { id: targetUser.id, walletAddress: targetUser.walletAddress, isFrozen } });
  } catch (err: any) {
    console.error("[ADMIN USER STATUS]", err);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// ══════════════════════════════════════════════════════════════
//  SUPPORTED CHAINS ENDPOINT
// ══════════════════════════════════════════════════════════════

router.get("/chains", authMiddleware, async (_req: AuthRequest, res: Response) => {
  res.json({
    chains: [
      { id: "ETHEREUM", name: "Ethereum", chainId: 1, type: "evm", rpcUrl: "https://eth.llamarpc.com", blockExplorer: "https://etherscan.io", nativeCurrency: "ETH" },
      { id: "BNB_CHAIN", name: "BNB Chain", chainId: 56, type: "evm", rpcUrl: "https://bsc-dataseed.binance.org", blockExplorer: "https://bscscan.com", nativeCurrency: "BNB" },
      { id: "POLYGON", name: "Polygon", chainId: 137, type: "evm", rpcUrl: "https://polygon-rpc.com", blockExplorer: "https://polygonscan.com", nativeCurrency: "MATIC" },
      { id: "ARBITRUM", name: "Arbitrum One", chainId: 42161, type: "evm", rpcUrl: "https://arb1.arbitrum.io/rpc", blockExplorer: "https://arbiscan.io", nativeCurrency: "ETH" },
      { id: "BASE", name: "Base", chainId: 8453, type: "evm", rpcUrl: "https://mainnet.base.org", blockExplorer: "https://basescan.org", nativeCurrency: "ETH" },
      { id: "AVALANCHE", name: "Avalanche C-Chain", chainId: 43114, type: "evm", rpcUrl: "https://api.avax.network/ext/bc/C/rpc", blockExplorer: "https://snowtrace.io", nativeCurrency: "AVAX" },
      { id: "OPTIMISM", name: "Optimism", chainId: 10, type: "evm", rpcUrl: "https://mainnet.optimism.io", blockExplorer: "https://optimistic.etherscan.io", nativeCurrency: "ETH" },
      { id: "FANTOM", name: "Fantom", chainId: 250, type: "evm", rpcUrl: "https://rpc.ftm.tools", blockExplorer: "https://ftmscan.com", nativeCurrency: "FTM" },
      { id: "SOLANA", name: "Solana", chainId: 0, type: "svm", rpcUrl: "https://api.mainnet-beta.solana.com", blockExplorer: "https://solscan.io", nativeCurrency: "SOL" },
      { id: "TRON", name: "TRON", chainId: 0, type: "tvm", rpcUrl: "https://api.trongrid.io", blockExplorer: "https://tronscan.org", nativeCurrency: "TRX" },
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
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch audit log" });
  }
});

export default router;
