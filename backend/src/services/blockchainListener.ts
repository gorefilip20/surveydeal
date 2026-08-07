import { ethers } from "ethers";
import { prisma } from "../lib/prisma";
import { CHAIN_RPC_URLS } from "../lib/chains";

const ERC20_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
];

const TRANSFER_TOPIC = ethers.id("Transfer(address,address,uint256)");
const MIN_CONFIRMATIONS = 3;

let isRunning = false;
const POLL_INTERVAL = 15_000;

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

  return escrows.map((e: any) => ({
    escrowId: e.id,
    depositAddress: e.depositWalletAddr!.toLowerCase(),
    tokenAddress: e.token.address.toLowerCase(),
    expectedAmount: e.totalAmount,
    chainId: e.chainId,
  }));
}

async function findTransferTxHash(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
  depositAddress: string,
  currentBlock: number
): Promise<{ txHash: string; blockNumber: number; amount: string } | null> {
  try {
    const fromBlock = Math.max(0, currentBlock - 1000);
    const paddedAddress = ethers.zeroPadValue(depositAddress, 32);

    const logs = await provider.getLogs({
      address: tokenAddress,
      topics: [TRANSFER_TOPIC, null, paddedAddress],
      fromBlock,
      toBlock: currentBlock,
    });

    if (logs.length > 0) {
      const latest = logs[logs.length - 1];
      return {
        txHash: latest.transactionHash,
        blockNumber: latest.blockNumber,
        amount: BigInt(latest.data).toString(),
      };
    }
  } catch {
    // Log scanning not supported on all RPCs
  }
  return null;
}

async function checkEVMDeposits(chainId: number): Promise<void> {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pending = (await getPendingDeposits()).filter((d) => d.chainId === chainId);
  if (pending.length === 0) return;

  let currentBlock: number;
  try {
    currentBlock = await provider.getBlockNumber();
  } catch {
    console.error(`[LISTENER] Failed to get block number for chain ${chainId}`);
    return;
  }

  for (const deposit of pending) {
    try {
      if (deposit.tokenAddress === ethers.ZeroAddress) continue;

      const tokenContract = new ethers.Contract(deposit.tokenAddress, ERC20_ABI, provider);
      const balance = await tokenContract.balanceOf(deposit.depositAddress);
      const balanceStr = balance.toString();
      const expected = BigInt(deposit.expectedAmount);

      if (BigInt(balanceStr) >= expected) {
        const transferInfo = await findTransferTxHash(
          provider,
          deposit.tokenAddress,
          deposit.depositAddress,
          currentBlock
        );

        const txHash = transferInfo?.txHash || `deposit-${chainId}-${deposit.escrowId}-${currentBlock}`;
        const blockNumber = transferInfo?.blockNumber || currentBlock;

        const confirmations = currentBlock - blockNumber;
        if (confirmations < MIN_CONFIRMATIONS) {
          console.log(`[LISTENER] Deposit for ${deposit.escrowId} has ${confirmations}/${MIN_CONFIRMATIONS} confirmations`);
          continue;
        }

        const existing = await prisma.transaction.findUnique({ where: { txHash } });
        if (existing) continue;

        console.log(`[LISTENER] Deposit confirmed for escrow ${deposit.escrowId} on chain ${chainId}`);

        await prisma.escrow.update({
          where: { id: deposit.escrowId },
          data: {
            state: "FUNDED" as any,
            fundedAmount: balanceStr,
            fundedAt: new Date(),
            depositConfirmed: true,
          },
        });

        await prisma.transaction.create({
          data: {
            escrowId: deposit.escrowId,
            txHash,
            type: "FUND",
            fromAddress: "DEPOSITOR",
            toAddress: deposit.depositAddress,
            amount: balanceStr,
            chainId,
            blockNumber,
            status: "CONFIRMED",
          },
        });

        console.log(`[LISTENER] Escrow ${deposit.escrowId} funded with ${balanceStr} tokens (tx: ${txHash})`);
      }
    } catch (err: any) {
      if (!err.message?.includes("call revert exception") && !err.message?.includes("BAD_DATA")) {
        console.error(`[LISTENER] Error checking deposit for ${deposit.escrowId} on chain ${chainId}:`, err.message);
      }
    }
  }
}

async function checkNativeDeposits(chainId: number): Promise<void> {
  const rpcUrl = CHAIN_RPC_URLS[chainId];
  if (!rpcUrl) return;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const pending = (await getPendingDeposits()).filter(
    (d) => d.chainId === chainId && d.tokenAddress === ethers.ZeroAddress
  );

  if (pending.length === 0) return;

  let currentBlock: number;
  try {
    currentBlock = await provider.getBlockNumber();
  } catch {
    return;
  }

  for (const deposit of pending) {
    try {
      const balance = await provider.getBalance(deposit.depositAddress);
      const expected = BigInt(deposit.expectedAmount);

      if (balance >= expected) {
        const txHash = `native-${chainId}-${deposit.escrowId}-${currentBlock}`;

        const existing = await prisma.transaction.findUnique({ where: { txHash } });
        if (existing) continue;

        console.log(`[LISTENER] Native deposit confirmed for escrow ${deposit.escrowId} on chain ${chainId}`);

        await prisma.escrow.update({
          where: { id: deposit.escrowId },
          data: {
            state: "FUNDED" as any,
            fundedAmount: balance.toString(),
            fundedAt: new Date(),
            depositConfirmed: true,
          },
        });

        await prisma.transaction.create({
          data: {
            escrowId: deposit.escrowId,
            txHash,
            type: "FUND",
            fromAddress: "DEPOSITOR",
            toAddress: deposit.depositAddress,
            amount: balance.toString(),
            chainId,
            blockNumber: currentBlock,
            status: "CONFIRMED",
          },
        });
      }
    } catch (err: any) {
      console.error(`[LISTENER] Native deposit check error for ${deposit.escrowId}:`, err.message);
    }
  }
}

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
          console.error(`[LISTENER] Chain ${chainId} error:`, err.message);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
    } catch (err: any) {
      console.error("[LISTENER] Loop error:", err.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

export async function startBlockchainListener(): Promise<void> {
  if (isRunning) {
    console.log("[LISTENER] Already running");
    return;
  }

  isRunning = true;
  console.log("[LISTENER] Starting multi-chain deposit listener...");
  console.log(`[LISTENER] Monitoring chains: ${Object.keys(CHAIN_RPC_URLS).join(", ")}`);
  console.log(`[LISTENER] Poll interval: ${POLL_INTERVAL / 1000}s, min confirmations: ${MIN_CONFIRMATIONS}`);

  listenerLoop().catch((err) => {
    console.error("[LISTENER] Fatal error:", err);
    isRunning = false;
  });
}

export async function stopBlockchainListener(): Promise<void> {
  isRunning = false;
  console.log("[LISTENER] Stopped");
}

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

    const receipt = await tx.wait(MIN_CONFIRMATIONS);
    if (!receipt || receipt.status !== 1) {
      return { verified: false, error: "Transaction failed or pending" };
    }

    const transfers = receipt.logs.filter(
      (log) => log.topics[0] === TRANSFER_TOPIC
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

export async function confirmDeposit(
  escrowId: string,
  txHash: string,
  amount: string
): Promise<void> {
  const escrow = await prisma.escrow.findUnique({ where: { id: escrowId } });

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
      toAddress: escrow?.depositWalletAddr || "ESCROW",
      amount,
      chainId: escrow?.chainId || 0,
      status: "CONFIRMED",
    },
  });
}
