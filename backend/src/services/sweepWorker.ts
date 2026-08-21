import { prisma } from "../lib/prisma";
import { custodyProvider } from "./custodyProvider";

let running = false;
let timer: NodeJS.Timeout | undefined;

function contractFor(chainId: number): string {
  let addresses: Record<string, string> = {};
  try { addresses = JSON.parse(process.env.ESCROW_CONTRACT_ADDRESSES || "{}"); } catch { throw new Error("Invalid ESCROW_CONTRACT_ADDRESSES JSON"); }
  const address = addresses[String(chainId)] || (chainId === Number(process.env.INDEXER_CHAIN_ID) ? process.env.CONTRACT_ADDRESS : undefined);
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) throw new Error(`No verified escrow contract configured for chain ${chainId}`);
  return address;
}

function assertAmount(amount: string): void {
  if (!/^\d+$/.test(amount) || BigInt(amount) <= 0n) throw new Error("Invalid sweep amount");
}

async function createOrLoadJob(deposit: any): Promise<any> {
  const escrow = deposit.depositAddress.escrow;
  const existing = await prisma.sweepJob.findUnique({ where: { incomingDepositId: deposit.id } });
  if (existing) return existing;
  assertAmount(deposit.amountBaseUnits);
  const destination = contractFor(escrow.chainId);
  return prisma.sweepJob.create({
    data: {
      incomingDepositId: deposit.id,
      escrowId: escrow.id,
      provider: process.env.CUSTODY_PROVIDER_NAME || "configured-mpc-provider",
      network: deposit.network,
      tokenAddress: escrow.token.address,
      amountBaseUnits: deposit.amountBaseUnits,
      destination,
      status: "PENDING_APPROVAL",
    },
  });
}

export async function approveSweepJob(jobId: string, adminId: string) {
  return prisma.sweepJob.updateMany({ where: { id: jobId, status: "PENDING_APPROVAL" }, data: { status: "APPROVED", approvedBy: adminId, approvedAt: new Date() } });
}

export async function runSweepCycle(): Promise<void> {
  if (process.env.CUSTODY_PROVIDER_ENABLED !== "true" || process.env.SWEEP_AUTOMATION_ENABLED !== "true") return;
  const provider = custodyProvider();
  const deposits = await prisma.incomingDeposit.findMany({
    where: { status: "CONFIRMED", sweepJob: { is: null } },
    include: { depositAddress: { include: { escrow: { include: { token: true } } } } },
    take: 25,
    orderBy: { createdAt: "asc" },
  });
  for (const deposit of deposits) {
    try { await createOrLoadJob(deposit); } catch (error: any) { console.error(`[SWEEP] Job creation failed for ${deposit.id}:`, error.message); }
  }
  const jobs = await prisma.sweepJob.findMany({ where: { status: "APPROVED" }, include: { incomingDeposit: true, escrow: { include: { token: true } } }, take: 25, orderBy: { createdAt: "asc" } });
  for (const job of jobs) {
    try {
      const response = await provider.submitSweep({ externalReference: job.id, network: job.network, asset: "USDT", tokenAddress: job.tokenAddress, amountBaseUnits: job.amountBaseUnits, sourceAddress: job.incomingDeposit.recipient, destination: job.destination });
      await prisma.sweepJob.update({ where: { id: job.id }, data: { status: response.status === "CONFIRMED" ? "CONFIRMED" : "SUBMITTED", providerJobId: response.id, txHash: response.txHash, submittedAt: new Date(), confirmedAt: response.status === "CONFIRMED" ? new Date() : undefined } });
      if (response.status === "CONFIRMED") await prisma.incomingDeposit.update({ where: { id: job.incomingDepositId }, data: { status: "SWEPT" } });
    } catch (error: any) {
      await prisma.sweepJob.update({ where: { id: job.id }, data: { status: "FAILED", lastError: error.message } });
    }
  }
}

export function startSweepWorker(): void {
  if (running) return;
  running = true;
  const interval = Number(process.env.SWEEP_POLL_INTERVAL_MS || 15000);
  const tick = async () => { if (!running) return; try { await runSweepCycle(); } catch (error: any) { console.error("[SWEEP] Cycle failed:", error.message); } timer = setTimeout(tick, interval); };
  void tick();
}

export function stopSweepWorker(): void { running = false; if (timer) clearTimeout(timer); timer = undefined; }
