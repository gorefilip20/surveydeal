import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { userAuth, adminAuth, AuthRequest } from "../middleware/auth";

const router = Router();

const OFFICIAL_TEMPLATES = [
  {
    name: "Freelance Web Development",
    description: "Standard web development project with wireframe, development, and launch milestones",
    category: "FREELANCE" as const,
    milestoneTemplates: [
      { description: "Wireframe & Design Mockup", percentAmount: 25 },
      { description: "Frontend & Backend Development", percentAmount: 50 },
      { description: "Testing, Revisions & Launch", percentAmount: 25 },
    ],
    defaultDeadlineDays: 30,
    tags: ["web", "development", "freelance"],
  },
  {
    name: "Domain Name Purchase",
    description: "Secure domain transfer with verification and DNS propagation milestones",
    category: "DOMAIN_SALE" as const,
    milestoneTemplates: [
      { description: "Domain Ownership Verification", percentAmount: 30 },
      { description: "Transfer Initiation & Auth Code", percentAmount: 40 },
      { description: "DNS Propagation & Confirmation", percentAmount: 30 },
    ],
    defaultDeadlineDays: 14,
    tags: ["domain", "transfer"],
  },
  {
    name: "Used Vehicle Sale",
    description: "Vehicle sale with inspection, title transfer, and delivery milestones",
    category: "VEHICLE_SALE" as const,
    milestoneTemplates: [
      { description: "Vehicle Inspection Report", percentAmount: 20 },
      { description: "Title Transfer & Documentation", percentAmount: 50 },
      { description: "Vehicle Delivery & Final Check", percentAmount: 30 },
    ],
    defaultDeadlineDays: 21,
    tags: ["vehicle", "car", "sale"],
  },
  {
    name: "Real Estate Earnest Money",
    description: "Real estate deposit escrow with inspection, appraisal, and closing milestones",
    category: "REAL_ESTATE" as const,
    milestoneTemplates: [
      { description: "Home Inspection Complete", percentAmount: 20 },
      { description: "Appraisal & Financing Approved", percentAmount: 30 },
      { description: "Closing & Title Transfer", percentAmount: 50 },
    ],
    defaultDeadlineDays: 45,
    tags: ["real-estate", "property", "earnest-money"],
  },
  {
    name: "Influencer Sponsorship",
    description: "Influencer marketing campaign with content approval milestones",
    category: "INFLUENCER" as const,
    milestoneTemplates: [
      { description: "Content Draft Submitted", percentAmount: 30 },
      { description: "Revisions Approved & Post Published", percentAmount: 40 },
      { description: "Analytics Report (7-day)", percentAmount: 30 },
    ],
    defaultDeadlineDays: 21,
    tags: ["influencer", "marketing", "social-media"],
  },
  {
    name: "Wholesale Goods Purchase",
    description: "Wholesale trade with sample, production, and shipping milestones",
    category: "WHOLESALE" as const,
    milestoneTemplates: [
      { description: "Sample Approval", percentAmount: 15 },
      { description: "Production Complete & Quality Check", percentAmount: 35 },
      { description: "Shipping & Tracking Provided", percentAmount: 25 },
      { description: "Delivery Confirmed", percentAmount: 25 },
    ],
    defaultDeadlineDays: 60,
    tags: ["wholesale", "trade", "shipping"],
  },
  {
    name: "Business Partnership Agreement",
    description: "Partnership capital contribution with vesting milestones",
    category: "PARTNERSHIP" as const,
    milestoneTemplates: [
      { description: "Agreement Signed & Notarized", percentAmount: 20 },
      { description: "Initial Capital Contribution", percentAmount: 40 },
      { description: "First Quarter Review & KPI Check", percentAmount: 40 },
    ],
    defaultDeadlineDays: 90,
    tags: ["partnership", "business", "investment"],
  },
  {
    name: "Crypto OTC Trade",
    description: "Over-the-counter crypto trade with verification milestones",
    category: "CRYPTO_TRADE" as const,
    milestoneTemplates: [
      { description: "Token Verification & Proof of Funds", percentAmount: 50 },
      { description: "Transfer Complete & Confirmed", percentAmount: 50 },
    ],
    defaultDeadlineDays: 3,
    tags: ["crypto", "otc", "trade"],
  },
];

router.get("/", async (req: Request, res: Response) => {
  try {
    const { category, search, page = "1", limit = "20", sort = "upvotes" } = req.query;

    const where: any = { isPublic: true };
    if (category) where.category = category as string;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        { tags: { hasSome: [(search as string).toLowerCase()] } },
      ];
    }

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));

    const orderBy: any = sort === "newest" ? { createdAt: "desc" } : sort === "popular" ? { usageCount: "desc" } : { upvotes: "desc" };

    const [templates, total] = await Promise.all([
      prisma.escrowTemplate.findMany({
        where,
        include: { creator: { select: { id: true, displayName: true, walletAddress: true } } },
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.escrowTemplate.count({ where }),
    ]);

    res.json({ templates, pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

router.get("/categories", (_req: Request, res: Response) => {
  res.json({
    categories: [
      { id: "CRYPTO_TRADE", name: "Crypto Trade", icon: "coins", description: "OTC trades, token swaps" },
      { id: "FREELANCE", name: "Freelance & Services", icon: "briefcase", description: "Web dev, design, consulting" },
      { id: "REAL_ESTATE", name: "Real Estate", icon: "home", description: "Earnest money, property deals" },
      { id: "DOMAIN_SALE", name: "Domain Sales", icon: "globe", description: "Domain transfers, websites" },
      { id: "VEHICLE_SALE", name: "Vehicle Sales", icon: "car", description: "Cars, motorcycles, equipment" },
      { id: "WHOLESALE", name: "Wholesale & Trade", icon: "package", description: "Bulk goods, manufacturing" },
      { id: "PARTNERSHIP", name: "Partnership", icon: "handshake", description: "Business partnerships, investments" },
      { id: "INFLUENCER", name: "Influencer", icon: "megaphone", description: "Sponsorships, content deals" },
      { id: "CUSTOM", name: "Custom", icon: "settings", description: "Custom escrow arrangement" },
    ],
  });
});

router.get("/official", (_req: Request, res: Response) => {
  res.json({ templates: OFFICIAL_TEMPLATES });
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const template = await prisma.escrowTemplate.findUnique({
      where: { id: req.params.id },
      include: { creator: { select: { id: true, displayName: true, walletAddress: true } } },
    });
    if (!template) { res.status(404).json({ error: "Template not found" }); return; }
    res.json(template);
  } catch { res.status(500).json({ error: "Failed to fetch template" }); }
});

router.post("/", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, category, milestoneTemplates, defaultDeadlineDays, verticalFields, tags, isPublic } = req.body;

    if (!name || !description || !category || !milestoneTemplates?.length) {
      res.status(400).json({ error: "name, description, category, and milestoneTemplates are required" });
      return;
    }

    const template = await prisma.escrowTemplate.create({
      data: {
        name,
        description,
        category,
        creatorId: req.userId!,
        milestoneTemplates: milestoneTemplates as any,
        defaultDeadlineDays,
        verticalFields: verticalFields as any,
        tags: tags || [],
        isPublic: isPublic || false,
      },
    });

    res.status(201).json(template);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to create template" });
  }
});

router.post("/:id/upvote", userAuth, async (req: AuthRequest, res: Response) => {
  try {
    const template = await prisma.escrowTemplate.update({
      where: { id: req.params.id },
      data: { upvotes: { increment: 1 } },
    });
    res.json({ upvotes: template.upvotes });
  } catch { res.status(500).json({ error: "Failed to upvote" }); }
});

router.post("/seed-official", adminAuth, async (_req: Request, res: Response) => {
  try {
    let admin = await prisma.user.findFirst({ where: { isAdmin: true } });
    if (!admin) {
      admin = await prisma.user.create({
        data: { walletAddress: "0x0000000000000000000000000000000000000000", isAdmin: true, role: "ADMIN" },
      });
    }

    for (const t of OFFICIAL_TEMPLATES) {
      const existing = await prisma.escrowTemplate.findFirst({ where: { name: t.name, isOfficial: true } });
      if (!existing) {
        await prisma.escrowTemplate.create({
          data: {
            ...t,
            milestoneTemplates: t.milestoneTemplates as any,
            creatorId: admin.id,
            isPublic: true,
            isOfficial: true,
          },
        });
      }
    }

    res.json({ success: true, count: OFFICIAL_TEMPLATES.length });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to seed templates" });
  }
});

export default router;
