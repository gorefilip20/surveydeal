import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { validate } from "../middleware/validate";
import { chatRoomCreateSchema, chatMessageSchema } from "../middleware/schemas";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// ── Auth Middleware ───────────────────────────────────
interface AuthRequest extends Request {
  userId?: string;
  userWallet?: string;
  isAdmin?: boolean;
}

function authMiddleware(req: AuthRequest, res: Response, next: Function) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization token" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as {
      sub: string;
      wallet: string;
      isAdmin?: boolean;
    };
    req.userId = payload.sub;
    req.userWallet = payload.wallet;
    req.isAdmin = payload.isAdmin || false;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function adminMiddleware(req: AuthRequest, res: Response, next: Function) {
  authMiddleware(req, res, () => {
    if (!req.isAdmin) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

// ══════════════════════════════════════════════════════
//  USER: Create or get support chat room
// ══════════════════════════════════════════════════════

router.post("/rooms", authMiddleware, validate(chatRoomCreateSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { escrowId, subject, initialMessage } = req.body;

    // Check if user already has an open room for this escrow (if specified)
    if (escrowId) {
      const existing = await prisma.chatRoom.findFirst({
        where: {
          userId: req.userId,
          escrowId,
          status: "OPEN",
        },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 10,
            include: { sender: { select: { id: true, displayName: true, isAdmin: true } } },
          },
        },
      });

      if (existing) {
        res.json(existing);
        return;
      }
    }

    // Create new room
    const room = await prisma.chatRoom.create({
      data: {
        userId: req.userId!,
        escrowId: escrowId || undefined,
        subject: subject || "Support Request",
        messages: initialMessage
          ? {
              create: {
                senderId: req.userId!,
                content: initialMessage,
              },
            }
          : undefined,
      },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { sender: { select: { id: true, displayName: true, isAdmin: true } } },
        },
      },
    });

    res.status(201).json(room);
  } catch (err: any) {
    console.error("[CHAT CREATE ROOM]", err);
    res.status(500).json({ error: "Failed to create chat room" });
  }
});

// ══════════════════════════════════════════════════════
//  USER: Get my chat rooms
// ══════════════════════════════════════════════════════

router.get("/rooms", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const rooms = await prisma.chatRoom.findMany({
      where: { userId: req.userId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, displayName: true, isAdmin: true } } },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(rooms);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// ══════════════════════════════════════════════════════
//  USER/ADMIN: Get messages in a room
// ══════════════════════════════════════════════════════

router.get("/rooms/:roomId/messages", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const room = await prisma.chatRoom.findUnique({
      where: { id: req.params.roomId as string },
    });

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // Check access: user owns the room OR is admin
    if (room.userId !== req.userId && !req.isAdmin) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const messages = await prisma.chatMessage.findMany({
      where: { roomId: req.params.roomId as string },
      include: {
        sender: {
          select: { id: true, displayName: true, isAdmin: true, walletAddress: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark messages as read
    await prisma.chatMessage.updateMany({
      where: {
        roomId: req.params.roomId as string,
        senderId: { not: req.userId },
        read: false,
      },
      data: { read: true },
    });

    res.json(messages);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// ══════════════════════════════════════════════════════
//  USER/ADMIN: Send a message
// ══════════════════════════════════════════════════════

router.post("/rooms/:roomId/messages", authMiddleware, validate(chatMessageSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      res.status(400).json({ error: "Message content required" });
      return;
    }

    const room = await prisma.chatRoom.findUnique({
      where: { id: req.params.roomId as string },
    });

    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    // Check access
    if (room.userId !== req.userId && !req.isAdmin) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    // Check room is open
    if (room.status === "CLOSED") {
      res.status(400).json({ error: "Chat room is closed" });
      return;
    }

    const message = await prisma.chatMessage.create({
      data: {
        roomId: req.params.roomId as string,
        senderId: req.userId!,
        content: content.trim(),
      },
      include: {
        sender: {
          select: { id: true, displayName: true, isAdmin: true, walletAddress: true },
        },
      },
    });

    // Update room's updatedAt
    await prisma.chatRoom.update({
      where: { id: req.params.roomId as string },
      data: { updatedAt: new Date() },
    });

    res.status(201).json(message);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ══════════════════════════════════════════════════════
//  ADMIN: Get all support rooms (inbox)
// ══════════════════════════════════════════════════════

router.get("/admin/rooms", adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = "1", limit = "20" } = req.query;

    const where: any = {};
    if (status) where.status = status as string;
    else where.status = { in: ["OPEN", "WAITING"] };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [rooms, total] = await Promise.all([
      prisma.chatRoom.findMany({
        where,
        include: {
          user: { select: { id: true, walletAddress: true, displayName: true } },
          escrow: { select: { id: true, title: true, onChainId: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { sender: { select: { id: true, displayName: true, isAdmin: true } } },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.chatRoom.count({ where }),
    ]);

    res.json({
      rooms,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch admin inbox" });
  }
});

// ══════════════════════════════════════════════════════
//  ADMIN: Close a room
// ══════════════════════════════════════════════════════

router.patch("/admin/rooms/:roomId/close", adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const room = await prisma.chatRoom.update({
      where: { id: req.params.roomId as string },
      data: { status: "CLOSED", closedAt: new Date(), closedBy: req.userId },
    });
    res.json(room);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to close room" });
  }
});

// ══════════════════════════════════════════════════════
//  ADMIN: Escalate a room
// ══════════════════════════════════════════════════════

router.patch("/admin/rooms/:roomId/escalate", adminMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const room = await prisma.chatRoom.update({
      where: { id: req.params.roomId as string },
      data: { status: "ESCALATED" },
    });
    res.json(room);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to escalate room" });
  }
});

export default router;
