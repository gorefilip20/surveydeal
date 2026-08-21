import { ethers } from "ethers";
import { prisma } from "../lib/prisma";
import { CHAIN_RPC_URLS } from "../lib/chains";
import { decrypt } from "./cryptoUtils";
import type { ReleaseResult } from "./escrowRelease";

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
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
  console.log(`[REFUND] Funded gas to ${depositWallet.address} on chain ${chainId}: ${tx.hash}`);
}

export async function refundERC20ToBuyer(
  escrowId: string,
  amount: string,
  buyerAddress: string,
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
        to: buyerAddress,
        value: BigInt(amount),
      });
      const receipt = await tx.wait();
      if (!receipt || receipt.status !== 1) {
        return { success: false, error: "Native refund transfer failed" };
      }
      return { success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
    }

    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, connectedWallet);
    const tx = await tokenContract.transfer(buyerAddress, BigInt(amount));
    const receipt = await tx.wait();

    if (!receipt || receipt.status !== 1) {
      return { success: false, error: "ERC20 refund transfer failed" };
    }

    return { success: true, txHash: receipt.hash, blockNumber: receipt.blockNumber };
  } catch (err: any) {
    console.error(`[REFUND] Failed for escrow ${escrowId}:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function processRefund(escrowId: string): Promise<ReleaseResult> {
  const escrow = await prisma.escrow.findUnique({
    where: { id: escrowId },
    include: { token: true, buyer: true, milestones: true },
  });

  if (!escrow) return { success: false, error: "Escrow not found" };
  if (!escrow.depositWalletAddr) return { success: false, error: "No deposit wallet" };

  const unreleasedAmount = escrow.milestones
    .filter((m) => !m.released)
    .reduce((sum, m) => sum + BigInt(m.amount), BigInt(0));

  if (unreleasedAmount <= BigInt(0)) {
    return { success: false, error: "No unreleased funds to refund" };
  }

  const result = await refundERC20ToBuyer(
    escrowId,
    unreleasedAmount.toString(),
    escrow.buyer.walletAddress,
    escrow.token.address,
    escrow.chainId,
    escrow.derivationIndex || 0,
    escrow.depositWalletKey
  );

  if (!result.success) return result;

  await prisma.escrow.update({
    where: { id: escrowId },
    data: { state: "REFUNDED", completedAt: new Date() },
  });

  await prisma.transaction.create({
    data: {
      escrowId,
      txHash: result.txHash!,
      type: "REFUND",
      fromAddress: escrow.depositWalletAddr,
      toAddress: escrow.buyer.walletAddress,
      amount: unreleasedAmount.toString(),
      chainId: escrow.chainId,
      blockNumber: result.blockNumber,
      status: "CONFIRMED",
    },
  });

  return result;
}
