import { PrismaClient, EscrowState } from "@prisma/client";
import { ethers } from "ethers";

const prisma = new PrismaClient();

// ── Multi-Chain RPC Configuration ────────────────────
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
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

// ── Listener State ───────────────────────────────────
const listeners: Map<number, ethers.JsonRpcProvider> = new Map();
let isRunning = false;
const POLL_INTERVAL = 12_000; // 12 seconds per chain

// ── Deposit Tracking ─────────────────────────────────
interface PendingDeposit {
  escrowId: string;
  depositAddress: string;
  tokenAddress: string;
  expectedAmount: string;
  chainId: number;
}

async function getPendingDeposits(): Promise<PendingDeposit[]> {
  const escrows = await prisma.escrow.findMany({
    where: {
      state: "CREATED",
      depositWalletAddr: { not: null },
    },
    include: { token: true },
  });

  return escrows.map((e) => ({
    escrowId: e.id,
    depositAddress: e.depositWalletAddr!.toLowerCase(),
    tokenAddress: e.token.address.toLowerCase(),
    expectedAmount: e.totalAmount,
    chainId: e.chainId,
  }));
}

// ── EVM Deposit Check ────────────────────────────────
async function checkEVMDeposits(chainId: number): Promise<void> {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pending = (await getPendingDeposits()).filter((d) => d.chainId === chainId);

  for (const deposit of pending) {
    try {
      const tokenContract = new ethers.Contract(deposit.tokenAddress, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(deposit.depositAddress);
      const balanceStr = balance.toString();
      const expected = BigInt(deposit.expectedAmount);

      if (BigInt(balanceStr) >= expected) {
        console.log(`[MULTI-CHAIN] Deposit confirmed for escrow ${deposit.escrowId} on chain ${chainId}`);

        // Update escrow state
        await prisma.escrow.update({
          where: { id: deposit.escrowId },
          data: {
            state: "FUNDED" as EscrowState,
            fundedAmount: balanceStr,
            fundedAt: new Date(),
            depositConfirmed: true,
          },
        });

        // Create transaction record
        await prisma.transaction.create({
          data: {
            escrowId: deposit.escrowId,
            txHash: `deposit-confirmed-${chainId}-${Date.now()}`,
            type: "FUND",
            fromAddress: deposit.depositAddress,
            toAddress: deposit.depositAddress,
            amount: balanceStr,
            chainId,
            status: "CONFIRMED",
          },
        });

        console.log(`[MULTI-CHAIN] Escrow ${deposit.escrowId} funded with ${balanceStr} tokens`);
      }
    } catch (err: any) {
      // Silently continue — token might not exist on this chain yet
      if (!err.message?.includes("call revert exception")) {
        console.error(`[MULTI-CHAIN] Error checking deposit for ${deposit.escrowId}:`, err.message);
      }
    }
  }
}

// ── Native Token Deposit Check (ETH/BNB/MATIC/etc.) ─
async function checkNativeDeposits(chainId: number): Promise<void> {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pending = (await getPendingDeposits()).filter(
    (d) => d.chainId === chainId && d.tokenAddress === ethers.ZeroAddress
  );

  for (const deposit of pending) {
    try {
      const balance = await provider.getBalance(deposit.depositAddress);
      const expected = BigInt(deposit.expectedAmount);

      if (balance >= expected) {
        console.log(`[MULTI-CHAIN] Native deposit confirmed for escrow ${deposit.escrowId} on chain ${chainId}`);

        await prisma.escrow.update({
          where: { id: deposit.escrowId },
          data: {
            state: "FUNDED" as EscrowState,
            fundedAmount: balance.toString(),
            fundedAt: new Date(),
            depositConfirmed: true,
          },
        });

        await prisma.transaction.create({
          data: {
            escrowId: deposit.escrowId,
            txHash: `native-deposit-${chainId}-${Date.now()}`,
            type: "FUND",
            fromAddress: deposit.depositAddress,
            toAddress: deposit.depositAddress,
            amount: balance.toString(),
            chainId,
            status: "CONFIRMED",
          },
        });
      }
    } catch (err: any) {
      console.error(`[MULTI-CHAIN] Native deposit check error for ${deposit.escrowId}:`, err.message);
    }
  }
}

// ── Main Listener Loop ───────────────────────────────
async function listenerLoop(): Promise<void> {
  while (isRunning) {
    try {
      const chainIds = Object.keys(CHAIN_RPC_URLS).map(Number);

      for (const chainId of chainIds) {
        if (!isRunning) break;

        try {
          await checkEVMDeposits(chainId);
          await checkNativeDeposits(chainId);
        } catch (err: any) {
          console.error(`[MULTI-CHAIN] Chain ${chainId} listener error:`, err.message);
        }
      }

      // Wait before next polling cycle
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    } catch (err: any) {
      console.error("[MULTI-CHAIN] Listener loop error:", err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

// ── Public API ───────────────────────────────────────

export async function startBlockchainListener(): Promise<void> {
  if (isRunning) {
    console.log("[MULTI-CHAIN] Listener already running");
    return;
  }

  isRunning = true;
  console.log("[MULTI-CHAIN] Starting multi-chain deposit listener...");
  console.log(`[MULTI-CHAIN] Monitoring chains: ${Object.keys(CHAIN_RPC_URLS).join(", ")}`);
  console.log(`[MULTI-CHAIN] Poll interval: ${poll_INTERVAL / 1000}s`);

  // Start the listener loop (non-blocking)
  listenerLoop().catch((err) => {
    console.error("[MULTI-CHAIN] Fatal listener error:", err);
    isRunning = false;
  });
}

export async function stopBlockchainListener(): Promise<void> {
  isRunning = false;
  console.log("[MULTI-CHAIN] Listener stopped");
}

/**
 * Verify a deposit transaction on any supported chain.
 * Used by the escrow controller's verify-deposit endpoint.
 */
export async function verifyDepositTransaction(
  txHash: string,
  chainId: number,
  expectedRecipient: string,
  expectedAmount: string
): Promise<{
  verified: boolean;
  amount?: string;
  blockNumber?: number;
  error?: string;
}> {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) {
    return { verified: false, error: `Chain ${chainId} not supported` };
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tx = await provider.getTransaction(txHash);

    if (!tx) {
      return { verified: false, error: "Transaction not found" };
    }

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      return { verified: false, error: "Transaction failed or pending" };
    }

    // Parse ERC20 Transfer events
    const transferTopic = ethers.id("Transfer(address,address,uint256)");
    const transfers = receipt.logs.filter(
      (log) => log.topics[0] === transferTopic
    );

    for (const transfer of transfers) {
      const to = ethers.getAddress("0x" + transfer.topics[2].slice(26));
      if (to.toLowerCase() === expectedRecipient.toLowerCase()) {
        const amount = BigInt(transfer.data);
        return {
          verified: true,
          amount: amount.toString(),
          blockNumber: receipt.blockNumber,
        };
      }
    }

    // Check native ETH/BNB transfer
    if (tx.to?.toLowerCase() === expectedRecipient.toLowerCase()) {
      return {
        verified: true,
        amount: tx.value.toString(),
        blockNumber: receipt.blockNumber,
      };
    }

    return { verified: false, error: "Transfer to expected address not found" };
  } catch (err: any) {
    return { verified: false, error: err.message };
  }
}

/**
 * Confirm a deposit in the database.
 * Called after successful verification.
 */
export async function confirmDeposit(
  escrowId: string,
  txHash: string,
  amount: string
): Promise<void> {
  await prisma.escrow.update({
    where: { id: escrowId },
    data: {
      state: "FUNDED",
      fundedAmount: amount,
      fundedAt: new Date(),
      depositConfirmed: true,
    },
  });

  await prisma.transaction.create({
    data: {
      escrowId,
      txHash,
      type: "FUND",
      fromAddress: "EXTERNAL",
      toAddress: "ESCROW",
      amount,
      chainId: 0,
      status: "CONFIRMED",
    },
  });
}
