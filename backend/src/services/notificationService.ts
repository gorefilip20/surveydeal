import { prisma } from "../lib/prisma";
import type { NotificationType } from "@prisma/client";

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, unknown>
): Promise<void> {
  await prisma.notification.create({
    data: { userId, type, title, message, data: data as any },
  });
}

export async function notifyEscrowParties(
  escrowId: string,
  type: NotificationType,
  title: string,
  message: string,
  excludeUserId?: string
): Promise<void> {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    select: { buyerId: true, sellerId: true, arbiterId: true },
  });
  if (!escrow) return;

  const userIds = [escrow.buyerId, escrow.sellerId, escrow.arbiterId].filter(
    (id): id is string => !!id && id !== excludeUserId
  );

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type,
      title,
      message,
      data: { escrowId } as any,
    })),
  });
}

export async function getUserNotifications(
  userId: string,
  page: number = 1,
  limit: number = 20,
  unreadOnly: boolean = false
) {
  const where: any = { userId };
  if (unreadOnly) where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, read: false } }),
  ]);

  return { notifications, total, unreadCount, page, limit };
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  const where: any = { userId };
  if (ids?.length) where.id = { in: ids };
  await prisma.notification.updateMany({ where, data: { read: true } });
}
