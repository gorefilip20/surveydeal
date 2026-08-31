import { Router, Request, Response } from "express";
import * as crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { recalculateTrustScore } from "../services/trustScoreService";
import {
  generateReferralCode,
  getReferralStats,
  applyReferral,
} from "../services/referralService";
import {
  getUserNotifications,
  markNotificationsRead,
} from "../services/notificationService";

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

// ── Trust Score ─────────────────────────────────────

router.get("/trust-score", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    await recalculateTrustScore(req.userId!);
    const score = await prisma.trustScore.findUnique({
      where: { userId: req.userId },
      include: {
        ratings: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!score) {
      res.json({ score: 0, level: "NEW", totalDealsCompleted: 0, totalVolume: "0", disputeRate: 0, avgRating: 0 });
      return;
    }
    res.json(score);
  } catch {
    res.status(500).json({ error: "Failed to fetch trust score" });
  }
});

router.get("/trust-score/:userId", async (req: Request, res: Response) => {
  try {
    const score = await prisma.trustScore.findUnique({
      where: { userId: req.params.userId },
      include: {
        user: { select: { displayName: true, walletAddress: true, verificationTier: true, createdAt: true } },
      },
    });
    if (!score) { res.status(404).json({ error: "Trust score not found" }); return; }
    res.json({
      score: score.score,
      level: score.level,
      totalDealsCompleted: score.totalDealsCompleted,
      avgRating: score.avgRating,
      totalRatings: score.totalRatings,
      disputeRate: score.disputeRate,
      user: {
        displayName: score.user.displayName,
        walletAddress: `${score.user.walletAddress.slice(0, 6)}...${score.user.walletAddress.slice(-4)}`,
        verificationTier: score.user.verificationTier,
        memberSince: score.user.createdAt,
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch trust score" });
  }
});

// ── Referral Program ────────────────────────────────

router.get("/referral", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getReferralStats(req.userId!);
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Failed to fetch referral info" });
  }
});

router.post("/referral/generate", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const code = await generateReferralCode(req.userId!);
    res.json({ code, shareUrl: `/join/${code}` });
  } catch {
    res.status(500).json({ error: "Failed to generate referral code" });
  }
});

router.post("/referral/apply", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ error: "Referral code is required" }); return; }
    const applied = await applyReferral(code, req.userId!);
    if (!applied) { res.status(400).json({ error: "Invalid or already used referral code" }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to apply referral" });
  }
});

// ── Notifications ───────────────────────────────────

router.get("/notifications", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page = "1", limit = "20", unread } = req.query;
    const result = await getUserNotifications(
      req.userId!,
      Math.max(1, Number(page)),
      Math.min(50, Math.max(1, Number(limit))),
      unread === "true"
    );
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

router.post("/notifications/read", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { ids } = req.body;
    await markNotificationsRead(req.userId!, ids);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

router.get("/notifications/preferences", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    let prefs = await prisma.notificationPreference.findUnique({ where: { userId: req.userId } });
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({ data: { userId: req.userId! } });
    }
    res.json(prefs);
  } catch {
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

router.patch("/notifications/preferences", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { emailEnabled, pushEnabled, dealUpdates, disputeAlerts, referralAlerts, marketingEmails } = req.body;
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: req.userId },
      update: {
        ...(emailEnabled !== undefined && { emailEnabled }),
        ...(pushEnabled !== undefined && { pushEnabled }),
        ...(dealUpdates !== undefined && { dealUpdates }),
        ...(disputeAlerts !== undefined && { disputeAlerts }),
        ...(referralAlerts !== undefined && { referralAlerts }),
        ...(marketingEmails !== undefined && { marketingEmails }),
      },
      create: { userId: req.userId!, emailEnabled, pushEnabled, dealUpdates, disputeAlerts, referralAlerts, marketingEmails },
    });
    res.json(prefs);
  } catch {
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// ── Verification Tier ───────────────────────────────

router.get("/verification", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { verificationTier: true, email: true, phone: true, kycVerifiedAt: true },
    });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const escrowLimits = {
      ANONYMOUS: { maxSingle: "1000", maxTotal: "5000", description: "Wallet-only, for small deals" },
      VERIFIED: { maxSingle: "50000", maxTotal: "200000", description: "Email + phone verified" },
      KYC: { maxSingle: "unlimited", maxTotal: "unlimited", description: "Government ID verified" },
    };

    res.json({
      currentTier: user.verificationTier,
      email: user.email ? `${user.email.slice(0, 3)}***` : null,
      phone: user.phone ? `***${user.phone.slice(-4)}` : null,
      kycVerifiedAt: user.kycVerifiedAt,
      limits: escrowLimits[user.verificationTier],
      tiers: escrowLimits,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch verification status" });
  }
});

router.post("/verification/email", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: "Valid email is required" }); return;
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { email },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user && user.phone && user.verificationTier === "ANONYMOUS") {
      await prisma.user.update({
        where: { id: req.userId },
        data: { verificationTier: "VERIFIED" },
      });
    } else if (user && user.verificationTier === "ANONYMOUS") {
      // Email alone doesn't upgrade, but we store it
    }

    res.json({ success: true, message: "Email updated" });
  } catch (err: any) {
    if (err.code === "P2002") { res.status(409).json({ error: "Email already in use" }); return; }
    res.status(500).json({ error: "Failed to update email" });
  }
});

router.post("/verification/phone", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      res.status(400).json({ error: "Valid phone number is required" }); return;
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { phone },
    });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user && user.email && user.verificationTier === "ANONYMOUS") {
      await prisma.user.update({
        where: { id: req.userId },
        data: { verificationTier: "VERIFIED" },
      });
    }

    res.json({ success: true, message: "Phone updated" });
  } catch {
    res.status(500).json({ error: "Failed to update phone" });
  }
});

// ── API Keys (White-Label) ──────────────────────────

router.get("/api-keys", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      select: { id: true, name: true, keyPrefix: true, permissions: true, rateLimit: true, isActive: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(keys);
  } catch {
    res.status(500).json({ error: "Failed to fetch API keys" });
  }
});

router.post("/api-keys", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, permissions } = req.body;
    if (!name) { res.status(400).json({ error: "Name is required" }); return; }

    const rawKey = `sd_${crypto.randomBytes(32).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.slice(0, 12);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.userId!,
        name,
        keyHash,
        keyPrefix,
        permissions: permissions || ["read"],
        rateLimit: 1000,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      keyPrefix,
      permissions: apiKey.permissions,
      message: "Save this key — it will not be shown again",
    });
  } catch {
    res.status(500).json({ error: "Failed to create API key" });
  }
});

router.delete("/api-keys/:id", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const key = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
    if (!key || key.userId !== req.userId) { res.status(403).json({ error: "Not authorized" }); return; }
    await prisma.apiKey.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete API key" });
  }
});

// ── Multi-Sig ───────────────────────────────────────

router.post("/escrows/:id/multisig/approve", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body;
    if (!action) { res.status(400).json({ error: "action is required" }); return; }

    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }
    if (escrow.mode !== "MULTISIG") { res.status(400).json({ error: "Escrow is not in multi-sig mode" }); return; }

    const isParticipant = escrow.buyerId === req.userId || escrow.sellerId === req.userId || escrow.arbiterId === req.userId;
    if (!isParticipant) { res.status(403).json({ error: "Not a participant" }); return; }

    const approval = await prisma.multiSigApproval.upsert({
      where: { escrowId_signerId_action: { escrowId: escrow.id, signerId: req.userId!, action } },
      update: { approved: true },
      create: { escrowId: escrow.id, signerId: req.userId!, action, approved: true },
    });

    const totalApprovals = await prisma.multiSigApproval.count({
      where: { escrowId: escrow.id, action, approved: true },
    });

    const thresholdMet = totalApprovals >= escrow.requiredSignatures;

    res.json({
      approval,
      totalApprovals,
      requiredSignatures: escrow.requiredSignatures,
      thresholdMet,
    });
  } catch {
    res.status(500).json({ error: "Failed to submit approval" });
  }
});

router.get("/escrows/:id/multisig/status", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const escrow = await prisma.escrow.findUnique({ where: { id: req.params.id } });
    if (!escrow) { res.status(404).json({ error: "Escrow not found" }); return; }

    const approvals = await prisma.multiSigApproval.findMany({
      where: { escrowId: escrow.id },
      include: { signer: { select: { displayName: true, walletAddress: true } } },
    });

    const grouped: Record<string, any[]> = {};
    for (const a of approvals) {
      if (!grouped[a.action]) grouped[a.action] = [];
      grouped[a.action].push(a);
    }

    res.json({
      mode: escrow.mode,
      requiredSignatures: escrow.requiredSignatures,
      actions: grouped,
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch multi-sig status" });
  }
});

export default router;
