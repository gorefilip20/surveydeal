import { ethers } from "ethers";
import { prisma } from "../lib/prisma";
import { CHAIN_RPC_URLS } from "../lib/chains";

const MIN_CONFIRMATIONS = Number(process.env.INDEXER_MIN_CONFIRMATIONS || 3);
const POLL_INTERVAL = Number(process.env.INDEXER_POLL_INTERVAL_MS || 15000);
const BLOCK_BATCH_SIZE = Number(process.env.INDEXER_BLOCK_BATCH_SIZE || 1000);
const ESCROW_ABI = [
  "event EscrowCreated(uint256 indexed escrowId,address indexed buyer,address indexed seller,address token,uint256 totalAmount,uint8 mode)",
  "event EscrowFunded(uint256 indexed escrowId,uint256 actualAmount)",
  "event EscrowActivated(uint256 indexed escrowId)",
  "event FundsReleased(uint256 indexed escrowId,uint256 milestoneIndex,uint256 amount)",
  "event DisputeInitiated(uint256 indexed escrowId,uint256 milestoneIndex,address initiator)",
  "event DisputeResolved(uint256 indexed escrowId,uint256 milestoneIndex,uint256 buyerShare,uint256 sellerShare)",
  "event EscrowRefunded(uint256 indexed escrowId,uint256 amount)",
  "event EscrowCompleted(uint256 indexed escrowId)",
];
const iface = new ethers.Interface(ESCROW_ABI);

let running = false;

function configuredContracts(): Array<{ chainId: number; address: string }> {
  const result: Array<{ chainId: number; address: string }> = [];
  const raw = process.env.ESCROW_CONTRACT_ADDRESSES;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      for (const [chain, address] of Object.entries(parsed)) {
        if (CHAIN_RPC_URLS[Number(chain)] && ethers.isAddress(address)) {
          result.push({ chainId: Number(chain), address: ethers.getAddress(address) });
        }
      }
    } catch {
      console.error("[INDEXER] ESCROW_CONTRACT_ADDRESSES must be valid JSON");
    }
  }
  if (result.length === 0 && process.env.CONTRACT_ADDRESS && process.env.INDEXER_CHAIN_ID) {
    const chainId = Number(process.env.INDEXER_CHAIN_ID);
    if (CHAIN_RPC_URLS[chainId] && ethers.isAddress(process.env.CONTRACT_ADDRESS)) {
      result.push({ chainId, address: ethers.getAddress(process.env.CONTRACT_ADDRESS) });
    }
  }
  return result;
}

function eventState(current: string, eventName: string): string | null {
  const transitions: Record<string, Record<string, string>> = {
    CREATED: { EscrowFunded: "FUNDED" },
    FUNDED: { EscrowActivated: "ACTIVE", EscrowRefunded: "REFUNDED" },
    ACTIVE: { DisputeInitiated: "DISPUTED", EscrowRefunded: "REFUNDED", EscrowCompleted: "COMPLETED" },
    DISPUTED: { DisputeResolved: "ACTIVE", EscrowRefunded: "REFUNDED", EscrowCompleted: "COMPLETED" },
  };
  if (eventName === "EscrowCreated" && current === "CREATED") return current;
  if (eventName === "FundsReleased" && current === "ACTIVE") return current;
  return transitions[current]?.[eventName] || null;
}

function jsonPayload(args: readonly unknown[]): unknown[] {
  return args.map((value) => typeof value === "bigint" ? value.toString() : value);
}

async function processLog(
  chainId: number,
  contractAddress: string,
  provider: ethers.JsonRpcProvider,
  log: ethers.Log,
): Promise<void> {
  let parsed: ethers.LogDescription | null;
  try {
    parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
  } catch {
    return;
  }
  if (!parsed) return;

  const block = await provider.getBlock(log.blockNumber);
  if (!block?.hash) return;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.chainEvent.findUnique({
      where: {
        chainId_contractAddress_txHash_logIndex: {
          chainId,
          contractAddress,
          txHash: log.transactionHash,
          logIndex: log.index,
        },
      },
    });
    if (existing) return;

    const escrowOnChainId = parsed!.args[0] !== undefined ? Number(parsed!.args[0]) : null;
    const escrow = escrowOnChainId === null ? null : await tx.escrow.findFirst({
      where: { chainId, onChainId: escrowOnChainId },
      select: { id: true, state: true },
    });

    await tx.chainEvent.create({
      data: {
        chainId,
        contractAddress,
        txHash: log.transactionHash,
        logIndex: log.index,
        blockNumber: log.blockNumber,
        blockHash: block.hash,
        eventName: parsed!.name,
        escrowOnChainId,
        escrowId: escrow?.id,
        payload: jsonPayload(parsed!.args as unknown[]) as any,
        status: "CONFIRMED",
      },
    });

    if (!escrow) return;
    const nextState = eventState(escrow.state, parsed!.name);
    if (!nextState || nextState === escrow.state) return;

    const update: Record<string, unknown> = { state: nextState };
    if (nextState === "FUNDED") update.fundedAt = new Date();
    if (nextState === "COMPLETED") update.completedAt = new Date();
    await tx.escrow.update({ where: { id: escrow.id }, data: update as any });

    const transactionType = parsed!.name === "EscrowFunded" ? "FUND" :
      parsed!.name === "EscrowRefunded" ? "REFUND" :
      parsed!.name === "DisputeResolved" ? "DISPUTE_RESOLUTION" : "RELEASE";
    const amount = parsed!.args[1] !== undefined && typeof parsed!.args[1] === "bigint"
      ? parsed!.args[1].toString() : "0";
    const txRecord = await tx.transaction.findUnique({ where: { txHash: log.transactionHash } });
    if (!txRecord && transactionType !== "RELEASE") {
      await tx.transaction.create({
        data: {
          escrowId: escrow.id,
          txHash: log.transactionHash,
          type: transactionType as any,
          fromAddress: "ON_CHAIN_EVENT",
          toAddress: contractAddress,
          amount,
          chainId,
          blockNumber: log.blockNumber,
          status: "CONFIRMED",
        },
      });
    }
  });
}

async function syncContract(chainId: number, contractAddress: string): Promise<void> {
  const rpc = CHAIN_RPC_URLS[chainId];
  if (!rpc) return;
  const provider = new ethers.JsonRpcProvider(rpc);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId) throw new Error(`RPC chain mismatch for ${chainId}`);
  const tip = await provider.getBlockNumber();
  const confirmedTip = tip - MIN_CONFIRMATIONS;
  if (confirmedTip < 0) return;

  const cursor = await prisma.indexerCursor.upsert({
    where: { chainId_contractAddress: { chainId, contractAddress } },
    create: { chainId, contractAddress, lastBlock: Math.max(0, confirmedTip - 1000) },
    update: {},
  });
  let fromBlock = cursor.lastBlock + 1;
  while (fromBlock <= confirmedTip && running) {
    const toBlock = Math.min(fromBlock + BLOCK_BATCH_SIZE - 1, confirmedTip);
    const logs = await provider.getLogs({ address: contractAddress, fromBlock, toBlock });
    for (const log of logs) await processLog(chainId, contractAddress, provider, log);
    await prisma.indexerCursor.update({
      where: { chainId_contractAddress: { chainId, contractAddress } },
      data: { lastBlock: toBlock },
    });
    fromBlock = toBlock + 1;
  }
}

async function loop(): Promise<void> {
  while (running) {
    for (const contract of configuredContracts()) {
      try {
        await syncContract(contract.chainId, contract.address);
      } catch (error: any) {
        console.error(`[INDEXER] Chain ${contract.chainId} failed:`, error?.message || error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
  }
}

export async function startEscrowEventIndexer(): Promise<void> {
  if (running) return;
  const contracts = configuredContracts();
  if (contracts.length === 0) {
    console.warn("[INDEXER] Disabled: configure ESCROW_CONTRACT_ADDRESSES or CONTRACT_ADDRESS + INDEXER_CHAIN_ID");
    return;
  }
  running = true;
  console.log(`[INDEXER] Monitoring ${contracts.length} escrow contract(s)`);
  void loop();
}

export async function stopEscrowEventIndexer(): Promise<void> {
  running = false;
}

export { eventState };
