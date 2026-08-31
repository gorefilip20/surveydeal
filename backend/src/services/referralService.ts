import * as crypto from "crypto";
import { prisma } from "../lib/prisma";

const REFERRAL_REWARD_BPS = 1000; // 10% of protocol fee

export async function generateReferralCode(userId: string): Promise<string> {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing.code;

  const code = `SD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  await prisma.referralCode.create({ data: { userId, code } });
  return code;
}

export async function applyReferral(
  referralCode: string,
  newUserId: string
): Promise<boolean> {
  const ref = await prisma.referralCode.findUnique({ where: { code: referralCode } });
  if (!ref || !ref.isActive || ref.userId === newUserId) return false;

  const existing = await prisma.referral.findUnique({
    where: { senderId_receiverId: { senderId: ref.userId, receiverId: newUserId } },
  });
  if (existing) return false;

  await prisma.referral.create({
    data: {
      senderId: ref.userId,
      receiverId: newUserId,
      referralCode: referralCode,
    },
  });

  await prisma.referralCode.update({
    where: { code: referralCode },
    data: { totalUses: { increment: 1 } },
  });

  return true;
}

export async function processReferralReward(
  escrowId: string,
  protocolFee: string
): Promise<void> {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    select: { referralCode: true, buyerId: true },
  });
  if (!escrow?.referralCode) return;

  const ref = await prisma.referralCode.findUnique({
    where: { code: escrow.referralCode },
  });
  if (!ref) return;

  const fee = BigInt(protocolFee);
  const reward = (fee * BigInt(REFERRAL_REWARD_BPS)) / BigInt(10000);
  if (reward <= BigInt(0)) return;

  await prisma.referral.updateMany({
    where: { senderId: ref.userId, receiverId: escrow.buyerId },
    data: {
      escrowId,
      rewardAmount: reward.toString(),
    },
  });

  await prisma.referralCode.update({
    where: { id: ref.id },
    data: {
      totalEarned: {
        set: (BigInt(ref.totalEarned) + reward).toString(),
      },
    },
  });
}

export async function getReferralStats(userId: string) {
  const code = await prisma.referralCode.findUnique({ where: { userId } });
  const referrals = await prisma.referral.findMany({
    where: { senderId: userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return {
    code: code?.code || null,
    totalReferrals: code?.totalUses || 0,
    totalEarned: code?.totalEarned || "0",
    isActive: code?.isActive || false,
    recentReferrals: referrals,
  };
}
