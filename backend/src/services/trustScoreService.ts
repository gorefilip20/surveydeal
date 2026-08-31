import { prisma } from "../lib/prisma";

const LEVEL_THRESHOLDS: { min: number; level: string }[] = [
  { min: 0, level: "NEW" },
  { min: 100, level: "BRONZE" },
  { min: 300, level: "SILVER" },
  { min: 600, level: "GOLD" },
  { min: 1000, level: "PLATINUM" },
  { min: 2000, level: "DIAMOND" },
];

function calculateLevel(score: number): string {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= LEVEL_THRESHOLDS[i].min) return LEVEL_THRESHOLDS[i].level;
  }
  return "NEW";
}

export async function recalculateTrustScore(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      buyerEscrows: { where: { state: { in: ["COMPLETED", "REFUNDED", "DISPUTED"] } } },
      sellerEscrows: { where: { state: { in: ["COMPLETED", "REFUNDED", "DISPUTED"] } } },
    },
  });
  if (!user) return;

  const allEscrows = [...user.buyerEscrows, ...user.sellerEscrows];
  const completed = allEscrows.filter((e) => e.state === "COMPLETED");
  const disputed = allEscrows.filter((e) => e.state === "DISPUTED");

  let totalVolume = BigInt(0);
  for (const e of completed) totalVolume += BigInt(e.fundedAmount || "0");

  const disputeRate = allEscrows.length > 0 ? disputed.length / allEscrows.length : 0;

  const existing = await prisma.trustScore.findUnique({ where: { userId } });
  const ratings = existing
    ? await prisma.dealRating.findMany({ where: { trustScoreId: existing.id } })
    : [];

  const avgRating =
    ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
      : 0;

  let score = completed.length * 50;
  score += Math.floor(Number(totalVolume) / 1e18) * 2;
  score += Math.round(avgRating * 20);
  score -= Math.round(disputeRate * 200);
  score = Math.max(0, score);

  const level = calculateLevel(score);

  await prisma.trustScore.upsert({
    where: { userId },
    update: {
      score,
      totalDealsCompleted: completed.length,
      totalVolume: totalVolume.toString(),
      disputeRate,
      avgRating,
      totalRatings: ratings.length,
      level,
      lastCalculatedAt: new Date(),
    },
    create: {
      userId,
      score,
      totalDealsCompleted: completed.length,
      totalVolume: totalVolume.toString(),
      disputeRate,
      avgRating,
      totalRatings: ratings.length,
      level,
    },
  });
}

export async function rateDeal(
  escrowId: string,
  raterId: string,
  targetUserId: string,
  rating: number,
  review?: string
): Promise<void> {
  if (rating < 1 || rating > 5) throw new Error("Rating must be 1-5");

  let trustScore = await prisma.trustScore.findUnique({ where: { userId: targetUserId } });
  if (!trustScore) {
    trustScore = await prisma.trustScore.create({ data: { userId: targetUserId } });
  }

  await prisma.dealRating.upsert({
    where: { escrowId_raterId: { escrowId, raterId } },
    update: { rating, review },
    create: {
      trustScoreId: trustScore.id,
      escrowId,
      raterId,
      rating,
      review,
    },
  });

  await recalculateTrustScore(targetUserId);
}
