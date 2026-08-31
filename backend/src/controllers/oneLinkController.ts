import { Router, Request, Response } from "express";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

interface AuthRequest extends Request {
  userId?: string;
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

router.post("/generate", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { escrowId } = req.body;
    if (!escrowId) { res.status(400).json({ error: "escrowId is required" }); return; }

    const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });
    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }
    if (escrow.sellerId !== req.userId && escrow.buyerId !== req.userId) {
      res.status(403).json({ error: "Not a participant" }); return;
    }

    if (escrow.shareToken) {
      res.json({ shareToken: escrow.shareToken, url: `/deal/${escrow.shareToken}` });
      return;
    }

    const shareToken = crypto.randomBytes(16).toString("hex");
    await prisma.escrow.update({
      where: { id: escrowId },
      data: { shareToken },
    });

    res.status(201).json({ shareToken, url: `/deal/${shareToken}` });
  } catch {
    res.status(500).json({ error: "Failed to generate share link" });
  }
});

router.get("/:shareToken", async (req: Request, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { shareToken: req.params.shareToken },
      include: {
        buyer: { select: { displayName: true, walletAddress: true, verificationTier: true } },
        seller: { select: { displayName: true, walletAddress: true, verificationTier: true } },
        token: { select: { symbol: true, name: true, decimals: true, network: true, logoUrl: true } },
        milestones: { orderBy: { index: "asc" }, select: { index: true, description: true, amount: true, released: true } },
        template: { select: { name: true, category: true } },
      },
    });

    if (!escrow) { res.status(404).json({ error: "Deal not found" }); return; }

    const buyerTrust = await prisma.trustScore.findUnique({ where: { userId: escrow.buyerId } });
    const sellerTrust = await prisma.trustScore.findUnique({ where: { userId: escrow.sellerId } });

    res.json({
      id: escrow.id,
      title: escrow.title,
      description: escrow.description,
      category: escrow.category,
      state: escrow.state,
      network: escrow.network,
      chainId: escrow.chainId,
      totalAmount: escrow.totalAmount,
      fundedAmount: escrow.fundedAmount,
      token: escrow.token,
      mode: escrow.mode,
      deadline: escrow.deadline,
      isInsured: escrow.isInsured,
      buyer: {
        ...escrow.buyer,
        walletAddress: `${escrow.buyer.walletAddress.slice(0, 6)}...${escrow.buyer.walletAddress.slice(-4)}`,
        trustScore: buyerTrust ? { score: buyerTrust.score, level: buyerTrust.level } : null,
      },
      seller: {
        ...escrow.seller,
        walletAddress: `${escrow.seller.walletAddress.slice(0, 6)}...${escrow.seller.walletAddress.slice(-4)}`,
        trustScore: sellerTrust ? { score: sellerTrust.score, level: sellerTrust.level } : null,
      },
      milestones: escrow.milestones,
      template: escrow.template,
      createdAt: escrow.createdAt,
      depositAddress: escrow.state === "CREATED" ? escrow.depositWalletAddr : undefined,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch deal" });
  }
});

router.post("/:shareToken/fund", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({
      where: { shareToken: req.params.shareToken },
    });
    if (!escrow) { res.status(404).json({ error: "Deal not found" }); return; }
    if (escrow.state !== "CREATED") { res.status(400).json({ error: "Deal already funded or in progress" }); return; }

    res.json({
      escrowId: escrow.id,
      depositAddress: escrow.depositWalletAddr,
      totalAmount: escrow.totalAmount,
      chainId: escrow.chainId,
      message: escrow.depositWalletAddr
        ? "Send funds to the deposit address"
        : "Deposit wallet needs to be generated first",
    });
  } catch {
    res.status(500).json({ error: "Failed to get funding info" });
  }
});

export default router;
