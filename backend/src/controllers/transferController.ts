import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ethers } from "ethers";
import { prisma } from "../lib/prisma";
import { CHAIN_RPC_URLS, SUPPORTED_CHAINS } from "../lib/chains";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;
const ADMIN_PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;

const BLOCK_EXPLORERS: Record<number, string> = Object.fromEntries(
  SUPPORTED_CHAINS.map((c) => [c.chainId, c.blockExplorer])
);

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// ── Auth Middleware ───────────────────────────────────
interface AuthRequest extends Request {
  userId?: string;
  isAdmin?: boolean;
}

function adminAuth(req: AuthRequest, res: Response, next: Function) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as {
      sub: string;
      isAdmin: boolean;
    };
    if (!payload.isAdmin) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    req.userId = payload.sub;
    req.isAdmin = true;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ══════════════════════════════════════════════════════
//  ADMIN: Transfer tokens to any wallet
//  POST /api/admin/transfer
// ══════════════════════════════════════════════════════

router.post("/transfer", adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { toAddress, tokenAddress, amount, chainId, note } = req.body;

    if (!toAddress || !tokenAddress || !amount || !chainId) {
      res.status(400).json({ error: "toAddress, tokenAddress, amount, and chainId required" });
      return;
    }

    const rpcUrl = CHAIN_RPC_URLS[chainId];
    if (!rpcUrl) {
      res.status(400).json({ error: `Chain ${chainId} not supported` });
      return;
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(ADMIN_PRIVATE_KEY, provider);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);

    // Get token info
    const [symbol, decimals] = await Promise.all([
      tokenContract.symbol(),
      tokenContract.decimals(),
    ]);

    const amountBigInt = ethers.parseUnits(amount, Number(decimals));

    // Execute transfer
    const tx = await tokenContract.transfer(toAddress, amountBigInt);
    const receipt = await tx.wait();

    const explorerUrl = BLOCK_EXPLORERS[chainId] || "";
    const txUrl = explorerUrl ? `${explorerUrl}/tx/${receipt.hash}` : null;

    // Store in database
    const transfer = await prisma.adminTransfer.create({
      data: {
        adminId: req.userId!,
        toAddress: toAddress.toLowerCase(),
        tokenAddress: tokenAddress.toLowerCase(),
        tokenSymbol: symbol,
        amount: amountBigInt.toString(),
        amountDisplay: `${amount} ${symbol}`,
        chainId,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        note: note || undefined,
      },
    });

    // Audit log
    await prisma.adminAuditLog.create({
      data: {
        adminId: req.userId!,
        action: "TRANSFER_TOKENS",
        entityType: "transfer",
        entityId: transfer.id,
        details: {
          toAddress,
          tokenAddress,
          symbol,
          amount,
          chainId,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
        },
      },
    });

    res.json({
      success: true,
      transfer: {
        id: transfer.id,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        amount: `${amount} ${symbol}`,
        toAddress,
        tokenAddress,
        chainId,
        explorerUrl: txUrl,
        timestamp: transfer.createdAt,
      },
    });
  } catch (err: any) {
    console.error("[ADMIN TRANSFER]", err);
    res.status(500).json({ error: "Transfer failed", details: err.message });
  }
});

// ══════════════════════════════════════════════════════
//  ADMIN: Get transfer history
//  GET /api/admin/transfers
// ══════════════════════════════════════════════════════

router.get("/transfers", adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { page = "1", limit = "20" } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));

    const [transfers, total] = await Promise.all([
      prisma.adminTransfer.findMany({
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.adminTransfer.count(),
    ]);

    // Add explorer URLs
    const enriched = transfers.map((t: any) => {
      const explorer = BLOCK_EXPLORERS[t.chainId] || "";
      return {
        ...t,
        explorerUrl: explorer ? `${explorer}/tx/${t.txHash}` : null,
      };
    });

    res.json({
      transfers: enriched,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to fetch transfers" });
  }
});

// ══════════════════════════════════════════════════════
//  ADMIN: Generate transfer proof (JSON receipt)
//  GET /api/admin/transfers/:id/proof
// ══════════════════════════════════════════════════════

router.get("/transfers/:id/proof", adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const transfer: any = await prisma.adminTransfer.findUnique({
      where: { id: req.params.id as string },
      include: {
        admin: { select: { id: true, displayName: true, walletAddress: true } },
      },
    });

    if (!transfer) {
      res.status(404).json({ error: "Transfer not found" });
      return;
    }

    const explorer = BLOCK_EXPLORERS[transfer.chainId] || "";

    const proof = {
      title: "SurveyDeal — Transfer Proof",
      version: "1.0",
      generatedAt: new Date().toISOString(),
      transfer: {
        id: transfer.id,
        txHash: transfer.txHash,
        blockNumber: transfer.blockNumber,
        chainId: transfer.chainId,
        chainName: getChainName(transfer.chainId),
        tokenAddress: transfer.tokenAddress,
        tokenSymbol: transfer.tokenSymbol,
        amount: transfer.amountDisplay,
        fromAddress: transfer.admin?.walletAddress || "Unknown",
        toAddress: transfer.toAddress,
        timestamp: transfer.createdAt.toISOString(),
        note: transfer.note,
      },
      verification: {
        explorerUrl: explorer ? `${explorer}/tx/${transfer.txHash}` : null,
        blockExplorer: explorer || null,
        status: "CONFIRMED",
      },
      platform: {
        name: "SurveyDeal",
        type: "Crypto Escrow Marketplace",
        contractAddress: CONTRACT_ADDRESS || "N/A",
      },
      admin: {
        id: transfer.admin?.id,
        name: transfer.admin?.displayName || "Admin",
        wallet: transfer.admin?.walletAddress,
      },
    };

    res.json(proof);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate proof" });
  }
});

// ══════════════════════════════════════════════════════
//  ADMIN: Generate PDF-style HTML receipt
//  GET /api/admin/transfers/:id/receipt
// ══════════════════════════════════════════════════════

router.get("/transfers/:id/receipt", adminAuth, async (req: AuthRequest, res: Response) => {
  try {
    const transfer: any = await prisma.adminTransfer.findUnique({
      where: { id: req.params.id as string },
      include: {
        admin: { select: { displayName: true, walletAddress: true } },
      },
    });

    if (!transfer) {
      res.status(404).json({ error: "Transfer not found" });
      return;
    }

    const explorer = BLOCK_EXPLORERS[transfer.chainId] || "";
    const txUrl = explorer ? `${explorer}/tx/${transfer.txHash}` : "#";
    const chainName = getChainName(transfer.chainId);

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SurveyDeal Transfer Receipt</title>
  <style>
    body { font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #fff; color: #333; }
    .header { text-align: center; border-bottom: 2px dashed #333; padding-bottom: 20px; margin-bottom: 20px; }
    .logo { font-size: 24px; font-weight: bold; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dotted #ccc; }
    .label { color: #666; }
    .value { font-weight: bold; text-align: right; max-width: 60%; word-break: break-all; }
    .highlight { background: #f0f0f0; padding: 12px; border-radius: 4px; margin: 16px 0; text-align: center; }
    .amount { font-size: 20px; font-weight: bold; }
    .footer { text-align: center; margin-top: 30px; border-top: 2px dashed #333; padding-top: 20px; font-size: 12px; color: #666; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">SURVEYDEAL</div>
    <div>Crypto Escrow Marketplace</div>
    <div style="font-size: 12px; color: #666;">Transfer Receipt / Proof of Payment</div>
  </div>

  <div class="highlight">
    <div class="amount">${transfer.amountDisplay}</div>
    <div style="color: #666; font-size: 12px;">TRANSFERRED</div>
  </div>

  <div class="row">
    <span class="label">Date:</span>
    <span class="value">${transfer.createdAt.toISOString()}</span>
  </div>
  <div class="row">
    <span class="label">Chain:</span>
    <span class="value">${chainName} (Chain ID: ${transfer.chainId})</span>
  </div>
  <div class="row">
    <span class="label">Token:</span>
    <span class="value">${transfer.tokenSymbol}</span>
  </div>
  <div class="row">
    <span class="label">Token Contract:</span>
    <span class="value">${transfer.tokenAddress}</span>
  </div>
  <div class="row">
    <span class="label">Amount:</span>
    <span class="value">${transfer.amountDisplay}</span>
  </div>
  <div class="row">
    <span class="label">From (Admin):</span>
    <span class="value">${transfer.admin?.walletAddress || "N/A"}</span>
  </div>
  <div class="row">
    <span class="label">To:</span>
    <span class="value">${transfer.toAddress}</span>
  </div>
  <div class="row">
    <span class="label">TX Hash:</span>
    <span class="value"><a href="${txUrl}" target="_blank">${transfer.txHash}</a></span>
  </div>
  <div class="row">
    <span class="label">Block Number:</span>
    <span class="value">${transfer.blockNumber}</span>
  </div>
  ${transfer.note ? `
  <div class="row">
    <span class="label">Note:</span>
    <span class="value">${transfer.note}</span>
  </div>
  ` : ""}

  <div class="footer">
    <p>This receipt was generated by SurveyDeal Escrow Platform.</p>
    <p>Verify this transaction on the blockchain: <a href="${txUrl}" target="_blank">${txUrl}</a></p>
    <p>Transfer ID: ${transfer.id}</p>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to generate receipt" });
  }
});

// ── Helpers ──────────────────────────────────────────
function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: "Ethereum",
    56: "BNB Chain",
    137: "Polygon",
    42161: "Arbitrum One",
    8453: "Base",
    43114: "Avalanche C-Chain",
    10: "Optimism",
    250: "Fantom",
  };
  return names[chainId] || `Chain ${chainId}`;
}

export default router;
