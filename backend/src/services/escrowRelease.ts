import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import { decrypt } from "./cryptoUtils";

const prisma = new PrismaClient();

const CHAIN_RPC_URLS: Record<number, string> = {
  1: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
  56: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
  137: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  42161: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  8453: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  43114: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
  10: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
  250: process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools",
};

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const MNEMONIC = process.env.GENERATION_MNEMONIC || process.env.BIP32_MNEMONIC;
const BASE_DERIVATION_PATH = "m/44'/60'/0'/0";

function getProvider(chainId: number): ethers.JsonRpcProvider {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) throw new Error(`Chain ${chainId} not supported`);
  return new ethers.JsonRpcProvider(rpcUrl);
}

function reconstructDepositWallet(
  derivationIndex: number,
  encryptedKey: string | null
): ethers.Wallet {
  if (encryptedKey) {
    const privateKey = decrypt(encryptedKey);
    return new ethers.Wallet(privateKey);
  }
  if (!MNEMONIC) {
    throw new Error("Cannot reconstruct wallet: no encrypted key and no mnemonic");
  }
  const path = `${BASE_DERIVATION_PATH}/${derivationIndex}`;
  return ethers.HDNodeWallet.fromMnemonic(
    ethers.Mnemonic.fromPhrase(MNEMONIC),
    path
  ) as unknown as ethers.Wallet;
}

async function ensureGas(
  depositWallet: ethers.Wallet,
  provider: ethers.JsonRpcProvider,
  chainId: number
): Promise<void> {
  const balance = await provider.getBalance(depositWallet.address);
  const minGas = ethers.parseEther("0.002");

  if (balance >= minGas) return;

  const adminKey = process.env.ADMIN_PRIVATE_KEY;
  if (!adminKey) throw new Error("ADMIN_PRIVATE_KEY required for gas funding");

  const adminWallet = new ethers.Wallet(adminKey, provider);
  const gasAmount = ethers.parseEther("0.005");

  const tx = await adminWallet.sendTransaction({
    to: depositWallet.address,
    value: gasAmount,
  });
  await tx.wait();
  console.log(`[RELEASE] Funded gas to ${depositWallet.address} on chain ${chainId}: ${tx.hash}`);
}

export interface ReleaseResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  error?: string;
}

export async function releaseERC20ToSeller(
  escrowId: string,
  milestoneId: string,
  amount: string,
  sellerAddress: string,
  tokenAddress: string,
  chainId: number,
  derivationIndex: number,
  encryptedKey: string | null
): Promise<ReleaseResult> {
  try {
    const provider = getProvider(chainId);
    const depositWallet = reconstructDepositWallet(derivationIndex, encryptedKey);
    const connectedWallet = depositWallet.connect(provider);

    await ensureGas(depositWallet, provider, chainId);

    if (tokenAddress === ethers.ZeroAddress) {
      const tx = await connectedWallet.sendTransaction({
        to: sellerAddress,
        value: BigInt(amount),
      });
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: "Native transfer failed" };
      }
      return {
        success: true,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    }

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, connectedWallet);
    const tx = await tokenContract.transfer(sellerAddress, BigInt(amount));
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      return { success: false, error: "ERC20 transfer failed" };
    }

    return {
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    };
  } catch (err: any) {
    console.error(`[RELEASE] Failed for escrow ${escrowId}:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function releaseMilestone(
  escrowId: string,
  milestoneIndex: number,
  adminId: string
): Promise<ReleaseResult> {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      milestones: { orderBy: { index: "asc" } },
      token: true,
      seller: true,
    },
  });

  if (!escrow) return { success: false, error: "Escrow not found" };

  const milestone = escrow.milestones.find((m: any) => m.index === milestoneIndex);
  if (!milestone) return { success: false, error: "Milestone not found" };
  if (milestone.released) return { success: false, error: "Milestone already released" };

  if (!escrow.depositWalletAddr) {
    return { success: false, error: "No deposit wallet on this escrow" };
  }

  if (!["FUNDED", "ACTIVE"].includes(escrow.state)) {
    return { success: false, error: `Cannot release from state ${escrow.state}` };
  }

  const result = await releaseERC20ToSeller(
    escrowId,
    milestone.id,
    milestone.amount,
    escrow.seller.walletAddress,
    escrow.token.address,
    escrow.chainId,
    escrow.derivationIndex || 0,
    escrow.depositWalletKey
  );

  if (!result.success) return result;

  await prisma.milestone.update({
    where: { id: milestone.id },
    data: {
      adminApproved: true,
      released: true,
      dispensed: true,
      releasedAt: new Date(),
    },
  });

  const newReleasedAmount = (
    BigInt(escrow.releasedAmount || "0") + BigInt(milestone.amount)
  ).toString();

  const allReleased =
    escrow.milestones.filter((m: any) => m.id !== milestone.id).every((m: any) => m.released);

  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      releasedAmount: newReleasedAmount,
      state: allReleased ? "COMPLETED" : "ACTIVE",
      ...(allReleased && { completedAt: new Date() }),
    },
  });

  await prisma.transaction.create({
    data: {
      escrowId,
      txHash: result.txHash!,
      type: "RELEASE",
      fromAddress: escrow.depositWalletAddr,
      toAddress: escrow.seller.walletAddress,
      amount: milestone.amount,
      chainId: escrow.chainId,
      blockNumber: result.blockNumber,
      status: "CONFIRMED",
    },
  });

  return result;
}

export async function releaseAllMilestones(
  escrowId: string,
  adminId: string
): Promise<ReleaseResult> {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: {
      milestones: { orderBy: { index: "asc" } },
      token: true,
      seller: true,
    },
  });

  if (!escrow) return { success: false, error: "Escrow not found" };
  if (!escrow.depositWalletAddr) {
    return { success: false, error: "No deposit wallet on this escrow" };
  }

  const unreleased = escrow.milestones.filter((m: any) => !m.released);
  if (unreleased.length === 0) {
    return { success: false, error: "All milestones already released" };
  }

  const totalAmount = unreleased
    .reduce((sum: bigint, m: any) => sum + BigInt(m.amount), BigInt(0))
    .toString();

  const result = await releaseERC20ToSeller(
    escrowId,
    "all",
    totalAmount,
    escrow.seller.walletAddress,
    escrow.token.address,
    escrow.chainId,
    escrow.derivationIndex || 0,
    escrow.depositWalletKey
  );

  if (!result.success) return result;

  await prisma.milestone.updateMany({
    where: { escrowId, released: false },
    data: {
      adminApproved: true,
      released: true,
      dispensed: true,
      releasedAt: new Date(),
    },
  });

  const newReleasedAmount = (
    BigInt(escrow.releasedAmount || "0") + BigInt(totalAmount)
  ).toString();

  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      releasedAmount: newReleasedAmount,
      state: "COMPLETED",
      completedAt: new Date(),
    },
  });

  await prisma.transaction.create({
    data: {
      escrowId,
      txHash: result.txHash!,
      type: "RELEASE",
      fromAddress: escrow.depositWalletAddr,
      toAddress: escrow.seller.walletAddress,
      amount: totalAmount,
      chainId: escrow.chainId,
      blockNumber: result.blockNumber,
      status: "CONFIRMED",
    },
  });

  return result;
}
