import { z } from "zod";

const ethAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const loginSchema = z.object({
  walletAddress: ethAddress,
  signature: z.string().min(1, "Signature is required"),
  message: z.string().min(1, "Message is required"),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().max(50).optional(),
  email: z.string().email().optional(),
});

export const createEscrowSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  sellerAddress: ethAddress,
  tokenAddress: ethAddress,
  chainId: z.number().int().positive(),
  network: z.enum(["ETHEREUM", "BNB_CHAIN", "POLYGON", "ARBITRUM", "BASE", "AVALANCHE", "OPTIMISM", "FANTOM"]),
  mode: z.enum(["LOCKED", "ARBITER"]).optional(),
  milestones: z.array(z.object({
    description: z.string().min(1).max(500),
    amount: z.string().min(1),
  })).min(1).max(20),
  deadline: z.string().datetime().optional(),
  agreementText: z.string().max(10000).optional(),
});

export const escrowStateSchema = z.object({
  state: z.enum(["FUNDED", "ACTIVE", "COMPLETED", "DISPUTED", "REFUNDED"]),
});

export const depositWalletSchema = z.object({
  method: z.enum(["WALLET_DIRECT", "DEPOSIT_TRANSFER"]).optional(),
});

export const verifyDepositSchema = z.object({
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash"),
});

export const disputeSchema = z.object({
  reason: z.string().min(10).max(2000),
  evidence: z.string().max(5000).optional(),
  milestoneIndex: z.number().int().min(0).optional(),
});

export const walletAddSchema = z.object({
  address: ethAddress,
  network: z.enum(["ETHEREUM", "BNB_CHAIN", "POLYGON", "ARBITRUM", "BASE", "AVALANCHE", "OPTIMISM", "FANTOM"]),
  label: z.string().max(50).optional(),
  isPreferred: z.boolean().optional(),
});

export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const adminDisputeResolveSchema = z.object({
  outcome: z.enum(["BUYER_FAVORED", "SELLER_FAVORED", "SPLIT"]),
  notes: z.string().max(2000).optional(),
});

export const adminTokenStatusSchema = z.object({
  status: z.enum(["ACTIVE", "BLACKLISTED", "FEATURED"]),
});

export const adminUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "FROZEN"]),
  reason: z.string().max(500).optional(),
});

export const chatRoomCreateSchema = z.object({
  escrowId: z.string().optional(),
  subject: z.string().min(1).max(200).optional(),
  message: z.string().min(1).max(5000).optional(),
});

export const chatMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});
