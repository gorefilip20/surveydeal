import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { rateDeal } from "../services/trustScoreService";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

interface AuthRequest extends Request {
  userId?: string;
}

function optionalAuth(req: AuthRequest, _res: Response, next: Function) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
      req.userId = payload.sub;
    } catch {}
  }
  next();
}

function userAuth(req: AuthRequest, res: Response, next: Function) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) { res.status(401).json({ error: "Missing token" }); return; }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch { res.status(401).json({ error: "Invalid token" }); }
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, network, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (category) where.category = category as string;
    if (network) where.network = network as string;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));

    const [deals, total] = await Promise.all([
      prisma.publicDeal.findMany({
        where,
        orderBy: { completedAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.publicDeal.count({ where }),
    ]);

    res.json({
      deals,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch deal feed" });
  }
});

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totalDeals, totalVolume, categoryBreakdown] = await Promise.all([
      prisma.publicDeal.count(),
      prisma.escrow.aggregate({
        where: { state: "COMPLETED" },
        _sum: { fundedAmount: true },
      }),
      prisma.publicDeal.groupBy({
        by: ["category"],
        _count: { id: true },
      }),
    ]);

    res.json({
      totalDeals,
      totalVolume: totalVolume._sum.fundedAmount || "0",
      categories: categoryBreakdown.map((c) => ({
        category: c.category,
        count: c._count.id,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

router.post("/publish", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { escrowId, isAnonymized } = req.body;

    const escrow = await prisma.escrow.findUnique({
      where: { id: escrowId },
      include: {
        token: { select: { symbol: true } },
        buyer: { select: { id: true, displayName: true, walletAddress: true } },
        seller: { select: { id: true, displayName: true, walletAddress: true } },
      },
    });

    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }
    if (escrow.state !== "COMPLETED") { res.status(400).json({ error: "Only completed escrows can be published" }); return; }
    if (escrow.buyerId !== req.userId && escrow.sellerId !== req.userId) {
      res.status(403).json({ error: "Not a participant" }); return;
    }

    const existing = await prisma.publicDeal.findUnique({ where: { escrowId } });
    if (existing) { res.status(409).json({ error: "Deal already published" }); return; }

    const deal = await prisma.publicDeal.create({
      data: {
        escrowId,
        category: escrow.category,
        title: escrow.title,
        amountDisplay: escrow.totalAmount,
        tokenSymbol: escrow.token.symbol,
        network: escrow.network,
        completedAt: escrow.completedAt || new Date(),
        isAnonymized: isAnonymized !== false,
        buyerDisplay: isAnonymized !== false
          ? `${escrow.buyer.walletAddress.slice(0, 6)}...${escrow.buyer.walletAddress.slice(-4)}`
          : escrow.buyer.displayName || escrow.buyer.walletAddress,
        sellerDisplay: isAnonymized !== false
          ? `${escrow.seller.walletAddress.slice(0, 6)}...${escrow.seller.walletAddress.slice(-4)}`
          : escrow.seller.displayName || escrow.seller.walletAddress,
      },
    });

    await prisma.escrow.update({
      where: { id: escrowId },
      data: { isPublicListing: true },
    });

    res.status(201).json(deal);
  } catch {
    res.status(500).json({ error: "Failed to publish deal" });
  }
});

router.post("/rate", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { escrowId, rating, review } = req.body;
    if (!escrowId || !rating) {
      res.status(400).json({ error: "escrowId and rating are required" }); return;
    }

    const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow || escrow.state !== "COMPLETED") {
      res.status(400).json({ error: "Escrow not found or not completed" }); return;
    }

    const isBuyer = escrow.buyerId === req.userId;
    const isSeller = escrow.sellerId === req.userId;
    if (!isBuyer && !isSeller) {
      res.status(403).json({ error: "Not a participant" }); return;
    }

    const targetUserId = isBuyer ? escrow.sellerId : escrow.buyerId;
    await rateDeal(escrowId, req.userId!, targetUserId, rating, review);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to submit rating" });
  }
});

router.get("/leaderboard", async (req: Request, res: Response) => {
  try {
    const { limit = "20" } = req.query;
    const limitNum = Math.min(50, Math.max(1, Number(limit)));

    const scores = await prisma.trustScore.findMany({
      orderBy: { score: "desc" },
      take: limitNum,
      include: {
        user: { select: { displayName: true, walletAddress: true, verificationTier: true } },
      },
    });

    res.json({
      leaderboard: scores.map((s, i) => ({
        rank: i + 1,
        userId: s.userId,
        displayName: s.user.displayName,
        walletAddress: `${s.user.walletAddress.slice(0, 6)}...${s.user.walletAddress.slice(-4)}`,
        verificationTier: s.user.verificationTier,
        score: s.score,
        level: s.level,
        totalDeals: s.totalDealsCompleted,
        avgRating: s.avgRating,
      })),
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

export default router;
