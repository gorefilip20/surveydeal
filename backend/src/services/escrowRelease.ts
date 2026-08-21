import { ethers } from "ethers";
import { prisma } from "../lib/prisma";
import { CHAIN_RPC_URLS } from "../lib/chains";
import { decrypt } from "./cryptoUtils";

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
  feeTxHash?: string;
  blockNumber?: number;
  feeAmount?: string;
  error?: string;
}

interface FeeConfig {
  feeBasisPoints: number;
  feeRecipient: string;
}

async function getProtocolFeeConfig(): Promise<FeeConfig> {
  const [bpConfig, recipientConfig] = await Promise.all([
    prisma.protocolConfig.findUnique({ where: { key: "feeBasisPoints" } }),
    prisma.protocolConfig.findUnique({ where: { key: "feeRecipient" } }),
  ]);

  return {
    feeBasisPoints: bpConfig ? parseInt(bpConfig.value, 10) : 100,
    feeRecipient: recipientConfig?.value || process.env.ADMIN_WALLET || "",
  };
}

function calculateFee(amount: bigint, basisPoints: number): bigint {
  return (amount * BigInt(basisPoints)) / BigInt(10000);
}

async function transferTokens(
  connectedWallet: ethers.Wallet,
  toAddress: string,
  amount: bigint,
  tokenAddress: string,
  label: string
): Promise<{ txHash: string; blockNumber: number }> {
  if (tokenAddress === ethers.ZeroAddress) {
    const tx = await connectedWallet.sendTransaction({ to: toAddress, value: amount });
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error(`${label}: Native transfer failed`);
    return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, connectedWallet);
  const tx = await tokenContract.transfer(toAddress, amount);
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`${label}: ERC20 transfer failed`);
  return { txHash: receipt.hash, blockNumber: receipt.blockNumber };
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
    const connectedWallet = depositWallet.connect(provider) as unknown as ethers.Wallet;

    await ensureGas(depositWallet, provider, chainId);

    const feeConfig = await getProtocolFeeConfig();
    const totalAmount = BigInt(amount);
    const feeAmount = calculateFee(totalAmount, feeConfig.feeBasisPoints);
    const sellerAmount = totalAmount - feeAmount;

    const sellerResult = await transferTokens(
      connectedWallet, sellerAddress, sellerAmount, tokenAddress, "Seller release"
    );

    let feeTxHash: string | undefined;
    if (feeAmount > BigInt(0) && feeConfig.feeRecipient) {
      try {
        const feeResult = await transferTokens(
          connectedWallet, feeConfig.feeRecipient, feeAmount, tokenAddress, "Fee collection"
        );
        feeTxHash = feeResult.txHash;
        console.log(`[RELEASE] Fee ${feeAmount.toString()} sent to ${feeConfig.feeRecipient}: ${feeTxHash}`);
      } catch (feeErr: any) {
        console.error(`[RELEASE] Fee transfer failed (seller already paid): ${feeErr.message}`);
      }
    }

    return {
      success: true,
      txHash: sellerResult.txHash,
      feeTxHash,
      blockNumber: sellerResult.blockNumber,
      feeAmount: feeAmount.toString(),
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

  const milestone = escrow.milestones.find((m) => m.index === milestoneIndex);
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

  const newFeeTotal = (
    BigInt(escrow.protocolFeeTotal || "0") + BigInt(result.feeAmount || "0")
  ).toString();

  const allReleased =
    escrow.milestones.filter((m) => m.id !== milestone.id).every((m) => m.released);

  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      releasedAmount: newReleasedAmount,
      protocolFeeTotal: newFeeTotal,
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
      feeAmount: result.feeAmount,
      chainId: escrow.chainId,
      blockNumber: result.blockNumber,
      status: "CONFIRMED",
    },
  });

  if (result.feeTxHash) {
    await prisma.transaction.create({
      data: {
        escrowId,
        txHash: result.feeTxHash,
        type: "FEE_COLLECTION",
        fromAddress: escrow.depositWalletAddr,
        toAddress: (await getProtocolFeeConfig()).feeRecipient,
        amount: result.feeAmount || "0",
        chainId: escrow.chainId,
        blockNumber: result.blockNumber,
        status: "CONFIRMED",
      },
    });
  }

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

  const unreleased = escrow.milestones.filter((m) => !m.released);
  if (unreleased.length === 0) {
    return { success: false, error: "All milestones already released" };
  }

  const totalAmount = unreleased
    .reduce((sum: bigint, m) => sum + BigInt(m.amount), BigInt(0))
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

  const newFeeTotal = (
    BigInt(escrow.protocolFeeTotal || "0") + BigInt(result.feeAmount || "0")
  ).toString();

  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      releasedAmount: newReleasedAmount,
      protocolFeeTotal: newFeeTotal,
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
      feeAmount: result.feeAmount,
      chainId: escrow.chainId,
      blockNumber: result.blockNumber,
      status: "CONFIRMED",
    },
  });

  if (result.feeTxHash) {
    await prisma.transaction.create({
      data: {
        escrowId,
        txHash: result.feeTxHash,
        type: "FEE_COLLECTION",
        fromAddress: escrow.depositWalletAddr,
        toAddress: (await getProtocolFeeConfig()).feeRecipient,
        amount: result.feeAmount || "0",
        chainId: escrow.chainId,
        blockNumber: result.blockNumber,
        status: "CONFIRMED",
      },
    });
  }

  return result;
}
