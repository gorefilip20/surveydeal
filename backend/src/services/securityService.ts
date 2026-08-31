import { prisma } from "../lib/prisma";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export async function logSecurityEvent(
  eventType: string,
  severity: Severity,
  details?: Record<string, unknown>,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      userId,
      eventType,
      severity,
      ipAddress,
      userAgent,
      details: details as any,
    },
  });
}

export async function checkRateAbuse(
  userId: string,
  action: string,
  windowMs: number = 60000,
  maxAttempts: number = 10
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.securityEvent.count({
    where: {
      userId,
      eventType: action,
      createdAt: { gte: since },
    },
  });
  return count >= maxAttempts;
}

export async function getSecurityEvents(
  page: number = 1,
  limit: number = 50,
  filters?: { severity?: string; eventType?: string; userId?: string }
) {
  const where: any = {};
  if (filters?.severity) where.severity = filters.severity;
  if (filters?.eventType) where.eventType = filters.eventType;
  if (filters?.userId) where.userId = filters.userId;

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return { events, total, page, limit };
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}

export function validateEthAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function hashData(data: string): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(data).digest("hex");
}
