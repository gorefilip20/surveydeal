import { ethers } from "ethers";
import { PrismaClient, EscrowState } from "@prisma/client";

const prisma = new PrismaClient();

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8545";
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "31337", 10);

const LISTENER_ABI = [
  "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, address token, uint256 totalAmount, uint8 mode)",
  "event EscrowFunded(uint256 indexed escrowId, uint256 actualAmount)",
  "event EscrowActivated(uint256 indexed escrowId)",
  "event MilestoneDelivered(uint256 indexed escrowId, uint256 milestoneIndex)",
  "event MilestoneApproved(uint256 indexed escrowId, uint256 milestoneIndex)",
  "event FundsReleased(uint256 indexed escrowId, uint256 milestoneIndex, uint256 amount)",
  "event DisputeInitiated(uint256 indexed escrowId, uint256 milestoneIndex, address initiator)",
  "event DisputeResolved(uint256 indexed escrowId, uint256 milestoneIndex, uint256 buyerShare, uint256 sellerShare)",
  "event EscrowRefunded(uint256 indexed escrowId, uint256 amount)",
  "event EscrowCompleted(uint256 indexed escrowId)",
  "function getEscrow(uint256 escrowId) view returns (tuple(uint256 id, address buyer, address seller, address arbiter, address token, uint256 totalAmount, uint256 fundedAmount, uint256 releasedAmount, uint256 protocolFeeCollected, uint8 state, uint8 mode, bytes32 agreementHash, uint256 createdAt, uint256 fundedAt, uint256 deadline, uint256 milestoneCount))",
  "function getMilestones(uint256 escrowId) view returns (tuple(string description, uint256 amount, bool released, bool disputed, bool buyerApproved, bool sellerDelivered)[])",
];

const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const RECONNECT_DELAY_MS = 5000;
const MAX_RECONNECT_DELAY_MS = 60000;
const DEPOSIT_POLL_INTERVAL_MS = 15_000;

let currentReconnectDelay = RECONNECT_DELAY_MS;
let provider: ethers.JsonRpcProvider | null = null;
let contract: ethers.Contract | null = null;
let isShuttingDown = false;
let depositPollTimer: ReturnType<typeof setInterval> | null = null;

const RPC_ENDPOINTS: Record<number, string> = {
  31337: process.env.RPC_LOCAL || "http://127.0.0.1:8545",
  1: process.env.RPC_ETH || "https://eth.llamarpc.com",
  56: process.env.RPC_BSC || "https://bsc-dataseed1.binance.org",
  42161: process.env.RPC_ARB || "https://arb1.arbitrum.io/rpc",
  8453: process.env.RPC_BASE || "https://mainnet.base.org",
  137: process.env.RPC_POLYGON || "https://polygon-rpc.com",
  10: process.env.RPC_OP || "https://mainnet.optimism.io",
};

const providerCache: Map<number, ethers.JsonRpcProvider> = new Map();

function log(level: string, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`[${timestamp}] [BlockchainListener] [${level}] ${message}${metaStr}`);
}

function getTransactionLog(txHash: string, blockNumber: number): { txHash: string; blockNumber: number; chainId: number } {
  return { txHash, blockNumber, chainId: CHAIN_ID };
}

function getProviderForChain(chainId: number): ethers.JsonRpcProvider {
  const cached = providerCache.get(chainId);
  if (cached) return cached;

  const rpcUrl = RPC_ENDPOINTS[chainId];
  if (!rpcUrl) {
    throw new Error(`No RPC endpoint configured for chainId ${chainId}`);
  }

  const newProvider = new ethers.JsonRpcProvider(rpcUrl);
  providerCache.set(chainId, newProvider);
  return newProvider;
}

// ──────────────────────────────────────────────
//  DEPOSIT VERIFICATION
// ──────────────────────────────────────────────

export interface DepositVerificationResult {
  verified: boolean;
  status: "CONFIRMED" | "PENDING" | "FAILED" | "NOT_FOUND";
  blockNumber?: number;
  from?: string;
  to?: string;
  tokenAmount?: string;
  nativeAmount?: string;
  confirmations?: number;
  error?: string;
}

export async function verifyDepositTransaction(
  txHash: string,
  chainId: number,
  expectedTo: string,
  expectedTokenAddress?: string,
  expectedAmount?: string
): Promise<DepositVerificationResult> {
  log("info", `Verifying deposit tx`, { txHash, chainId, expectedTo });

  let rpcProvider: ethers.JsonRpcProvider;
  try {
    rpcProvider = getProviderForChain(chainId);
  } catch (err: any) {
    return { verified: false, status: "FAILED", error: err.message };
  }

  try {
    const [receipt, tx] = await Promise.all([
      rpcProvider.getTransactionReceipt(txHash),
      rpcProvider.getTransaction(txHash),
    ]);

    if (!receipt || !tx) {
      const pendingTx = await rpcProvider.getTransaction(txHash);
      if (pendingTx && !pendingTx.blockNumber) {
        return { verified: false, status: "PENDING" };
      }
      return { verified: false, status: "NOT_FOUND", error: "Transaction not found on chain" };
    }

    if (receipt.status === 0) {
      return {
        verified: false,
        status: "FAILED",
        blockNumber: receipt.blockNumber,
        error: "Transaction reverted on-chain",
      };
    }

    const latestBlock = await rpcProvider.getBlockNumber();
    const confirmations = latestBlock - receipt.blockNumber;

    const normalizedTo = expectedTo.toLowerCase();
    const txTo = (tx.to || "").toLowerCase();

    let tokenTransferVerified = false;
    let transferAmount = "0";

    if (expectedTokenAddress) {
      const transferTopic = ethers.id("Transfer(address,address,uint256)");
      const normalizedToken = expectedTokenAddress.toLowerCase();

      for (const logEntry of receipt.logs) {
        if (logEntry.address.toLowerCase() !== normalizedToken) continue;
        if (logEntry.topics[0] !== transferTopic) continue;
        if (logEntry.topics.length < 3) continue;

        const toAddr = ethers.getAddress("0x" + logEntry.topics[2].slice(26)).toLowerCase();
        if (toAddr === normalizedTo) {
          transferAmount = BigInt(logEntry.data).toString();
          tokenTransferVerified = true;
          break;
        }
      }

      if (!tokenTransferVerified) {
        return {
          verified: false,
          status: "FAILED",
          blockNumber: receipt.blockNumber,
          confirmations,
          error: `No ERC20 Transfer to ${expectedTo} found in transaction logs`,
        };
      }
    } else {
      if (txTo !== normalizedTo) {
        return {
          verified: false,
          status: "FAILED",
          blockNumber: receipt.blockNumber,
          confirmations,
          from: tx.from,
          to: tx.to || undefined,
          error: `Transaction recipient ${tx.to} does not match expected ${expectedTo}`,
        };
      }
      transferAmount = tx.value.toString();
    }

    if (expectedAmount && expectedAmount !== "0") {
      const actual = BigInt(transferAmount);
      const expected = BigInt(expectedAmount);
      const tolerance = expected / 100n;
      if (actual < expected - tolerance) {
        return {
          verified: false,
          status: "FAILED",
          blockNumber: receipt.blockNumber,
          confirmations,
          from: tx.from,
          to: expectedTo,
          tokenAmount: expectedTokenAddress ? transferAmount : undefined,
          nativeAmount: !expectedTokenAddress ? transferAmount : undefined,
          error: `Transfer amount ${actual.toString()} is less than expected ${expected.toString()}`,
        };
      }
    }

    return {
      verified: true,
      status: "CONFIRMED",
      blockNumber: receipt.blockNumber,
      from: tx.from,
      to: expectedTo,
      tokenAmount: expectedTokenAddress ? transferAmount : undefined,
      nativeAmount: !expectedTokenAddress ? transferAmount : undefined,
      confirmations,
    };
  } catch (err: any) {
    log("error", `RPC error verifying deposit`, { txHash, chainId, error: err.message });
    return { verified: false, status: "FAILED", error: `RPC query failed: ${err.message}` };
  }
}

// ──────────────────────────────────────────────
//  DEPOSIT CONFIRMATION (updates DB)
// ──────────────────────────────────────────────

export async function confirmDeposit(
  escrowId: string,
  txHash: string,
  verification: DepositVerificationResult
): Promise<{ success: boolean; error?: string }> {
  if (!verification.verified) {
    return { success: false, error: verification.error || "Transaction not verified" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({
        where: { id: escrowId },
        include: { token: true },
      });

      if (!escrow) {
        throw new Error("Escrow not found");
      }

      if (escrow.depositConfirmed) {
        return { success: true, alreadyConfirmed: true };
      }

      if (escrow.state !== "CREATED" && escrow.state !== "FUNDED") {
        throw new Error(`Escrow in invalid state for deposit confirmation: ${escrow.state}`);
      }

      const depositAmount = verification.tokenAmount || verification.nativeAmount || escrow.totalAmount;

      await tx.escrow.update({
        where: { id: escrowId },
        data: {
          depositConfirmed: true,
          state: EscrowState.FUNDED,
          fundedAmount: depositAmount,
          fundedAt: new Date(),
        },
      });

      const existingTx = await tx.transaction.findUnique({
        where: { txHash },
      });

      if (existingTx) {
        await tx.transaction.update({
          where: { txHash },
          data: {
            status: "CONFIRMED",
            blockNumber: verification.blockNumber,
          },
        });
      } else {
        await tx.transaction.create({
          data: {
            escrowId: escrow.id,
            txHash,
            type: "FUND",
            fromAddress: verification.from || "",
            toAddress: verification.to || escrow.depositWalletAddr || "",
            amount: depositAmount,
            chainId: escrow.chainId,
            blockNumber: verification.blockNumber || 0,
            status: "CONFIRMED",
          },
        });
      }

      const pendingDepositTx = await tx.transaction.findFirst({
        where: {
          escrowId: escrow.id,
          type: "DEPOSIT_WALLET",
          status: { in: ["PENDING", "AWAITING_DEPOSIT"] },
        },
      });

      if (pendingDepositTx) {
        await tx.transaction.update({
          where: { id: pendingDepositTx.id },
          data: { status: "CONFIRMED" },
        });
      }

      return { success: true };
    });

    log("info", `Deposit confirmed for escrow ${escrowId}`, {
      txHash,
      blockNumber: verification.blockNumber,
    });

    return result;
  } catch (err: any) {
    if (err.code === "P2002") {
      log("warn", `Duplicate transaction hash ${txHash} during deposit confirmation`);
      return { success: true };
    }
    log("error", `Failed to confirm deposit for escrow ${escrowId}`, { error: err.message });
    return { success: false, error: err.message };
  }
}

// ──────────────────────────────────────────────
//  DEPOSIT WALLET POLLING
// ──────────────────────────────────────────────

async function pollDepositWallets(): Promise<void> {
  try {
    const pendingEscrows = await prisma.escrow.findMany({
      where: {
        depositWalletAddr: { not: null },
        depositConfirmed: false,
        state: { in: ["CREATED"] },
        fundingMethod: "DEPOSIT_TRANSFER",
      },
      include: { token: true },
    });

    if (pendingEscrows.length === 0) return;

    log("info", `Polling ${pendingEscrows.length} deposit wallet(s) for incoming transfers`);

    for (const escrow of pendingEscrows) {
      if (isShuttingDown) return;

      try {
        const chainProvider = getProviderForChain(escrow.chainId);
        const depositAddr = escrow.depositWalletAddr!;

        if (escrow.token) {
          const tokenContract = new ethers.Contract(
            escrow.token.address,
            ERC20_ABI,
            chainProvider
          );

          const balance: bigint = await tokenContract.balanceOf(depositAddr);

          if (balance > 0n) {
            const expectedAmount = BigInt(escrow.totalAmount);
            const tolerance = expectedAmount / 100n;

            if (balance >= expectedAmount - tolerance) {
              log("info", `Deposit detected for escrow ${escrow.id}`, {
                depositAddr,
                balance: balance.toString(),
                expected: escrow.totalAmount,
              });

              await prisma.$transaction(async (tx) => {
                await tx.escrow.update({
                  where: { id: escrow.id },
                  data: {
                    depositConfirmed: true,
                    state: EscrowState.FUNDED,
                    fundedAmount: balance.toString(),
                    fundedAt: new Date(),
                  },
                });

                await tx.transaction.create({
                  data: {
                    escrowId: escrow.id,
                    txHash: `auto-detected-${depositAddr}-${Date.now()}`,
                    type: "FUND",
                    fromAddress: "auto-detected",
                    toAddress: depositAddr,
                    amount: balance.toString(),
                    chainId: escrow.chainId,
                    status: "CONFIRMED",
                  },
                });

                const pendingTx = await tx.transaction.findFirst({
                  where: {
                    escrowId: escrow.id,
                    type: "DEPOSIT_WALLET",
                    status: { in: ["PENDING", "AWAITING_DEPOSIT"] },
                  },
                });

                if (pendingTx) {
                  await tx.transaction.update({
                    where: { id: pendingTx.id },
                    data: { status: "CONFIRMED" },
                  });
                }
              });

              log("info", `Escrow ${escrow.id} auto-confirmed via balance detection`);
            }
          }
        } else {
          const balance = await chainProvider.getBalance(depositAddr);

          if (balance > 0n) {
            log("info", `Native deposit detected for escrow ${escrow.id}`, {
              depositAddr,
              balance: balance.toString(),
            });

            await prisma.$transaction(async (tx) => {
              await tx.escrow.update({
                where: { id: escrow.id },
                data: {
                  depositConfirmed: true,
                  state: EscrowState.FUNDED,
                  fundedAmount: balance.toString(),
                  fundedAt: new Date(),
                },
              });

              await tx.transaction.create({
                data: {
                  escrowId: escrow.id,
                  txHash: `auto-detected-native-${depositAddr}-${Date.now()}`,
                  type: "FUND",
                  fromAddress: "auto-detected",
                  toAddress: depositAddr,
                  amount: balance.toString(),
                  chainId: escrow.chainId,
                  status: "CONFIRMED",
                },
              });
            });
          }
        }
      } catch (err: any) {
        log("warn", `Failed to poll deposit for escrow ${escrow.id}`, {
          error: err.message,
          chainId: escrow.chainId,
        });
      }
    }
  } catch (err: any) {
    log("error", `Deposit polling cycle failed`, { error: err.message });
  }
}

function startDepositPolling(): void {
  if (depositPollTimer) return;

  log("info", `Starting deposit wallet polling (every ${DEPOSIT_POLL_INTERVAL_MS / 1000}s)`);

  pollDepositWallets().catch((err) => {
    log("error", `Initial deposit poll failed`, { error: err.message });
  });

  depositPollTimer = setInterval(() => {
    if (!isShuttingDown) {
      pollDepositWallets().catch((err) => {
        log("error", `Deposit poll cycle failed`, { error: err.message });
      });
    }
  }, DEPOSIT_POLL_INTERVAL_MS);
}

function stopDepositPolling(): void {
  if (depositPollTimer) {
    clearInterval(depositPollTimer);
    depositPollTimer = null;
    log("info", "Deposit wallet polling stopped");
  }
}

// ──────────────────────────────────────────────
//  EVENT HANDLERS
// ──────────────────────────────────────────────

async function handleEscrowFunded(
  escrowId: bigint,
  actualAmount: bigint,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  const txMeta = getTransactionLog(event.transactionHash, event.blockNumber);
  log("info", `EscrowFunded received`, { onChainId, actualAmount: actualAmount.toString(), ...txMeta });

  try {
    await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({ where: { onChainId } });

      if (!escrow) {
        log("warn", `Escrow ${onChainId} not found in database, skipping EscrowFunded`);
        return;
      }

      if (escrow.state !== EscrowState.CREATED) {
        log("warn", `Escrow ${onChainId} not in CREATED state (current: ${escrow.state}), skipping`);
        return;
      }

      await tx.escrow.update({
        where: { onChainId },
        data: {
          state: EscrowState.FUNDED,
          fundedAmount: actualAmount.toString(),
          fundedAt: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash: txMeta.txHash,
          type: "FUND",
          fromAddress: escrow.buyerId,
          toAddress: CONTRACT_ADDRESS,
          amount: actualAmount.toString(),
          chainId: txMeta.chainId,
          blockNumber: txMeta.blockNumber,
          status: "CONFIRMED",
        },
      });

      log("info", `Escrow ${onChainId} state updated: CREATED -> FUNDED`);
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      log("warn", `Duplicate transaction hash ${txMeta.txHash}, event already processed`);
      return;
    }
    log("error", `Failed to process EscrowFunded for escrow ${onChainId}`, { error: err.message });
  }
}

async function handleEscrowActivated(
  escrowId: bigint,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  const txMeta = getTransactionLog(event.transactionHash, event.blockNumber);
  log("info", `EscrowActivated received`, { onChainId, ...txMeta });

  try {
    await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({ where: { onChainId } });

      if (!escrow) {
        log("warn", `Escrow ${onChainId} not found in database, skipping EscrowActivated`);
        return;
      }

      if (escrow.state !== EscrowState.FUNDED) {
        log("warn", `Escrow ${onChainId} not in FUNDED state (current: ${escrow.state}), skipping`);
        return;
      }

      await tx.escrow.update({
        where: { onChainId },
        data: { state: EscrowState.ACTIVE },
      });

      log("info", `Escrow ${onChainId} state updated: FUNDED -> ACTIVE`);
    });
  } catch (err: any) {
    log("error", `Failed to process EscrowActivated for escrow ${onChainId}`, { error: err.message });
  }
}

async function handleMilestoneDelivered(
  escrowId: bigint,
  milestoneIndex: bigint,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  const msIdx = Number(milestoneIndex);
  const txMeta = getTransactionLog(event.transactionHash, event.blockNumber);
  log("info", `MilestoneDelivered received`, { onChainId, milestoneIndex: msIdx, ...txMeta });

  try {
    await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({
        where: { onChainId },
        include: { milestones: true },
      });

      if (!escrow) {
        log("warn", `Escrow ${onChainId} not found, skipping MilestoneDelivered`);
        return;
      }

      const milestone = escrow.milestones.find((m) => m.index === msIdx);
      if (!milestone) {
        log("warn", `Milestone ${msIdx} not found on escrow ${onChainId}, skipping`);
        return;
      }

      await tx.milestone.update({
        where: { id: milestone.id },
        data: { sellerDelivered: true },
      });

      log("info", `Milestone ${msIdx} on escrow ${onChainId} marked as delivered`);
    });
  } catch (err: any) {
    log("error", `Failed to process MilestoneDelivered`, { error: err.message, onChainId, msIdx });
  }
}

async function handleFundsReleased(
  escrowId: bigint,
  milestoneIndex: bigint,
  amount: bigint,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  const msIdx = Number(milestoneIndex);
  const txMeta = getTransactionLog(event.transactionHash, event.blockNumber);
  log("info", `FundsReleased received`, { onChainId, milestoneIndex: msIdx, amount: amount.toString(), ...txMeta });

  try {
    await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({
        where: { onChainId },
        include: { milestones: true },
      });

      if (!escrow) {
        log("warn", `Escrow ${onChainId} not found, skipping FundsReleased`);
        return;
      }

      const milestone = escrow.milestones.find((m) => m.index === msIdx);
      if (!milestone) {
        log("warn", `Milestone ${msIdx} not found on escrow ${onChainId}, skipping`);
        return;
      }

      await tx.milestone.update({
        where: { id: milestone.id },
        data: {
          released: true,
          buyerApproved: true,
          sellerDelivered: true,
          releasedAt: new Date(),
        },
      });

      const currentReleased = BigInt(escrow.releasedAmount);
      const newReleased = currentReleased + amount;

      await tx.escrow.update({
        where: { onChainId },
        data: { releasedAmount: newReleased.toString() },
      });

      await tx.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash: txMeta.txHash,
          type: "RELEASE",
          fromAddress: CONTRACT_ADDRESS,
          toAddress: escrow.sellerId,
          amount: amount.toString(),
          chainId: txMeta.chainId,
          blockNumber: txMeta.blockNumber,
          status: "CONFIRMED",
        },
      });

      log("info", `Milestone ${msIdx} on escrow ${onChainId} released, amount: ${amount.toString()}`);
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      log("warn", `Duplicate transaction hash ${txMeta.txHash}, event already processed`);
      return;
    }
    log("error", `Failed to process FundsReleased`, { error: err.message, onChainId, msIdx });
  }
}

async function handleDisputeInitiated(
  escrowId: bigint,
  milestoneIndex: bigint,
  initiator: string,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  const msIdx = Number(milestoneIndex);
  const txMeta = getTransactionLog(event.transactionHash, event.blockNumber);
  log("info", `DisputeInitiated received`, { onChainId, milestoneIndex: msIdx, initiator, ...txMeta });

  try {
    await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({
        where: { onChainId },
        include: { milestones: true },
      });

      if (!escrow) {
        log("warn", `Escrow ${onChainId} not found, skipping DisputeInitiated`);
        return;
      }

      const milestone = escrow.milestones.find((m) => m.index === msIdx);
      if (!milestone) {
        log("warn", `Milestone ${msIdx} not found on escrow ${onChainId}, skipping`);
        return;
      }

      await tx.milestone.update({
        where: { id: milestone.id },
        data: { disputed: true },
      });

      await tx.escrow.update({
        where: { onChainId },
        data: { state: EscrowState.DISPUTED },
      });

      const initiatorUser = await tx.user.findUnique({
        where: { walletAddress: initiator.toLowerCase() },
      });

      if (initiatorUser) {
        await tx.dispute.create({
          data: {
            escrowId: escrow.id,
            milestoneId: milestone.id,
            initiatorId: initiatorUser.id,
            reason: "Dispute initiated on-chain",
            outcome: "PENDING",
          },
        });
      }

      log("info", `Escrow ${onChainId} state updated: ACTIVE -> DISPUTED (milestone ${msIdx})`);
    });
  } catch (err: any) {
    log("error", `Failed to process DisputeInitiated`, { error: err.message, onChainId, msIdx });
  }
}

async function handleDisputeResolved(
  escrowId: bigint,
  milestoneIndex: bigint,
  buyerShare: bigint,
  sellerShare: bigint,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  const msIdx = Number(milestoneIndex);
  const txMeta = getTransactionLog(event.transactionHash, event.blockNumber);
  log("info", `DisputeResolved received`, {
    onChainId,
    milestoneIndex: msIdx,
    buyerShare: buyerShare.toString(),
    sellerShare: sellerShare.toString(),
    ...txMeta,
  });

  try {
    await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({
        where: { onChainId },
        include: { milestones: true, disputes: true },
      });

      if (!escrow) {
        log("warn", `Escrow ${onChainId} not found, skipping DisputeResolved`);
        return;
      }

      const milestone = escrow.milestones.find((m) => m.index === msIdx);
      if (!milestone) {
        log("warn", `Milestone ${msIdx} not found on escrow ${onChainId}, skipping`);
        return;
      }

      await tx.milestone.update({
        where: { id: milestone.id },
        data: {
          released: true,
          disputed: false,
          releasedAt: new Date(),
        },
      });

      const total = buyerShare + sellerShare;
      const buyerBps = total > 0n ? Number((buyerShare * 10000n) / total) : 0;
      const sellerBps = 10000 - buyerBps;

      let outcome: "BUYER_FAVORED" | "SELLER_FAVORED" | "SPLIT" = "SPLIT";
      if (buyerBps === 10000) outcome = "BUYER_FAVORED";
      else if (buyerBps === 0) outcome = "SELLER_FAVORED";

      const pendingDispute = escrow.disputes.find(
        (d) => d.milestoneId === milestone.id && d.outcome === "PENDING"
      );

      if (pendingDispute) {
        await tx.dispute.update({
          where: { id: pendingDispute.id },
          data: {
            outcome,
            buyerShareBps: buyerBps,
            sellerShareBps: sellerBps,
            resolvedAt: new Date(),
          },
        });
      }

      const allResolved = escrow.milestones.every(
        (m) => m.released || m.id === milestone.id
      );

      const released = BigInt(escrow.releasedAmount) + buyerShare + sellerShare;

      await tx.escrow.update({
        where: { onChainId },
        data: {
          state: allResolved ? EscrowState.COMPLETED : EscrowState.ACTIVE,
          releasedAmount: released.toString(),
          completedAt: allResolved ? new Date() : undefined,
        },
      });

      await tx.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash: txMeta.txHash,
          type: "DISPUTE_RESOLUTION",
          fromAddress: CONTRACT_ADDRESS,
          toAddress: escrow.buyerId,
          amount: (buyerShare + sellerShare).toString(),
          chainId: txMeta.chainId,
          blockNumber: txMeta.blockNumber,
          status: "CONFIRMED",
        },
      });

      log("info", `Dispute on escrow ${onChainId} milestone ${msIdx} resolved: ${outcome}`);
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      log("warn", `Duplicate transaction hash ${txMeta.txHash}, event already processed`);
      return;
    }
    log("error", `Failed to process DisputeResolved`, { error: err.message, onChainId, msIdx });
  }
}

async function handleEscrowRefunded(
  escrowId: bigint,
  amount: bigint,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  const txMeta = getTransactionLog(event.transactionHash, event.blockNumber);
  log("info", `EscrowRefunded received`, { onChainId, amount: amount.toString(), ...txMeta });

  try {
    await prisma.$transaction(async (tx) => {
      const escrow = await tx.escrow.findUnique({ where: { onChainId } });

      if (!escrow) {
        log("warn", `Escrow ${onChainId} not found, skipping EscrowRefunded`);
        return;
      }

      await tx.escrow.update({
        where: { onChainId },
        data: { state: EscrowState.REFUNDED },
      });

      await tx.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash: txMeta.txHash,
          type: "REFUND",
          fromAddress: CONTRACT_ADDRESS,
          toAddress: escrow.buyerId,
          amount: amount.toString(),
          chainId: txMeta.chainId,
          blockNumber: txMeta.blockNumber,
          status: "CONFIRMED",
        },
      });

      log("info", `Escrow ${onChainId} state updated to REFUNDED`);
    });
  } catch (err: any) {
    if (err.code === "P2002") {
      log("warn", `Duplicate transaction hash ${txMeta.txHash}, event already processed`);
      return;
    }
    log("error", `Failed to process EscrowRefunded`, { error: err.message, onChainId });
  }
}

async function handleEscrowCompleted(
  escrowId: bigint,
  event: ethers.EventLog
): Promise<void> {
  const onChainId = Number(escrowId);
  log("info", `EscrowCompleted received`, { onChainId, txHash: event.transactionHash });

  try {
    await prisma.escrow.update({
      where: { onChainId },
      data: {
        state: EscrowState.COMPLETED,
        completedAt: new Date(),
      },
    });

    log("info", `Escrow ${onChainId} state updated to COMPLETED`);
  } catch (err: any) {
    log("error", `Failed to process EscrowCompleted`, { error: err.message, onChainId });
  }
}

// ──────────────────────────────────────────────
//  CONNECTION MANAGEMENT
// ──────────────────────────────────────────────

function attachEventListeners(contractInstance: ethers.Contract): void {
  contractInstance.on("EscrowFunded", async (escrowId: bigint, actualAmount: bigint, event: ethers.EventLog) => {
    try {
      await handleEscrowFunded(escrowId, actualAmount, event);
    } catch (err: any) {
      log("error", "Unhandled error in EscrowFunded handler", { error: err.message });
    }
  });

  contractInstance.on("EscrowActivated", async (escrowId: bigint, event: ethers.EventLog) => {
    try {
      await handleEscrowActivated(escrowId, event);
    } catch (err: any) {
      log("error", "Unhandled error in EscrowActivated handler", { error: err.message });
    }
  });

  contractInstance.on("MilestoneDelivered", async (escrowId: bigint, milestoneIndex: bigint, event: ethers.EventLog) => {
    try {
      await handleMilestoneDelivered(escrowId, milestoneIndex, event);
    } catch (err: any) {
      log("error", "Unhandled error in MilestoneDelivered handler", { error: err.message });
    }
  });

  contractInstance.on("FundsReleased", async (escrowId: bigint, milestoneIndex: bigint, amount: bigint, event: ethers.EventLog) => {
    try {
      await handleFundsReleased(escrowId, milestoneIndex, amount, event);
    } catch (err: any) {
      log("error", "Unhandled error in FundsReleased handler", { error: err.message });
    }
  });

  contractInstance.on("DisputeInitiated", async (escrowId: bigint, milestoneIndex: bigint, initiator: string, event: ethers.EventLog) => {
    try {
      await handleDisputeInitiated(escrowId, milestoneIndex, initiator, event);
    } catch (err: any) {
      log("error", "Unhandled error in DisputeInitiated handler", { error: err.message });
    }
  });

  contractInstance.on("DisputeResolved", async (escrowId: bigint, milestoneIndex: bigint, buyerShare: bigint, sellerShare: bigint, event: ethers.EventLog) => {
    try {
      await handleDisputeResolved(escrowId, milestoneIndex, buyerShare, sellerShare, event);
    } catch (err: any) {
      log("error", "Unhandled error in DisputeResolved handler", { error: err.message });
    }
  });

  contractInstance.on("EscrowRefunded", async (escrowId: bigint, amount: bigint, event: ethers.EventLog) => {
    try {
      await handleEscrowRefunded(escrowId, amount, event);
    } catch (err: any) {
      log("error", "Unhandled error in EscrowRefunded handler", { error: err.message });
    }
  });

  contractInstance.on("EscrowCompleted", async (escrowId: bigint, event: ethers.EventLog) => {
    try {
      await handleEscrowCompleted(escrowId, event);
    } catch (err: any) {
      log("error", "Unhandled error in EscrowCompleted handler", { error: err.message });
    }
  });

  log("info", "All 8 event listeners attached");
}

async function connect(): Promise<void> {
  if (isShuttingDown) return;

  try {
    log("info", `Connecting to RPC: ${RPC_URL}`);

    provider = new ethers.JsonRpcProvider(RPC_URL);

    const network = await provider.getNetwork();
    log("info", `Connected to chain ${network.chainId.toString()}`);

    contract = new ethers.Contract(CONTRACT_ADDRESS, LISTENER_ABI, provider);

    attachEventListeners(contract);

    currentReconnectDelay = RECONNECT_DELAY_MS;

    provider.on("error", (err: Error) => {
      log("error", `Provider error: ${err.message}`);
      scheduleReconnect();
    });

    log("info", `Listening for SurveydealEscrow events on ${CONTRACT_ADDRESS}`);
  } catch (err: any) {
    log("error", `Connection failed: ${err.message}`);
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (isShuttingDown) return;

  if (contract) {
    try {
      contract.removeAllListeners();
    } catch (_) {}
  }
  if (provider) {
    try {
      provider.removeAllListeners();
      provider.destroy();
    } catch (_) {}
  }

  provider = null;
  contract = null;

  log("info", `Reconnecting in ${currentReconnectDelay / 1000}s...`);

  setTimeout(() => {
    connect().catch((err) => {
      log("error", `Reconnect attempt failed: ${err.message}`);
    });
  }, currentReconnectDelay);

  currentReconnectDelay = Math.min(currentReconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
}

// ──────────────────────────────────────────────
//  PUBLIC API
// ──────────────────────────────────────────────

export async function startBlockchainListener(): Promise<void> {
  isShuttingDown = false;
  log("info", "Starting blockchain event listener service");

  const isProduction = process.env.NODE_ENV === "production";
  const skipContractListener = isProduction && (!CONTRACT_ADDRESS || RPC_URL === "http://127.0.0.1:8545");

  if (skipContractListener) {
    log("info", "Production mode: skipping local contract event listener, deposit polling is active on all chains");
  } else {
    try {
      await connect();
    } catch (err: any) {
      log("warn", `Contract event listener failed to start: ${err.message}. Deposit polling will continue independently.`);
    }
  }

  startDepositPolling();
}

export async function stopBlockchainListener(): Promise<void> {
  isShuttingDown = true;
  log("info", "Shutting down blockchain event listener");

  stopDepositPolling();

  if (contract) {
    try {
      contract.removeAllListeners();
    } catch (_) {}
  }

  if (provider) {
    try {
      provider.removeAllListeners();
      provider.destroy();
    } catch (_) {}
  }

  for (const [, p] of providerCache) {
    try { p.destroy(); } catch (_) {}
  }
  providerCache.clear();

  provider = null;
  contract = null;

  await prisma.$disconnect();
  log("info", "Blockchain listener stopped");
}
