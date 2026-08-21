import crypto from "crypto";
import { prisma } from "../lib/prisma";

export type NormalizedDepositEvent = {
  provider: string;
  id: string;
  network: string;
  asset: string;
  txHash: string;
  eventIndex?: number;
  blockNumber?: bigint;
  amountBaseUnits: string;
  sender: string;
  recipient: string;
  confirmations: number;
  raw: unknown;
};

export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined, secret: string | undefined): boolean {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const supplied = signature.replace(/^sha256=/, "").trim();
  if (supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function normalizeDepositEvent(provider: string, body: any): NormalizedDepositEvent {
  const event = body?.event || body?.data || body;
  const txHash = String(event.txHash || event.transactionHash || event.signature || "");
  const recipient = String(event.recipient || event.to || event.destination || "");
  const amountBaseUnits = String(event.amountBaseUnits || event.amount || "");
  const id = String(body?.id || body?.eventId || `${provider}:${txHash}:${event.logIndex ?? event.eventIndex ?? 0}`);
  if (!txHash || !recipient || !amountBaseUnits) throw new Error("Webhook event missing transaction, recipient, or amount");
  return {
    provider,
    id,
    network: String(event.network || event.chain || "").toUpperCase(),
    asset: String(event.asset || event.tokenSymbol || "").toUpperCase(),
    txHash,
    eventIndex: event.logIndex === undefined && event.eventIndex === undefined ? undefined : Number(event.logIndex ?? event.eventIndex),
    blockNumber: event.blockNumber === undefined ? undefined : BigInt(event.blockNumber),
    amountBaseUnits,
    sender: String(event.sender || event.from || "UNKNOWN"),
    recipient,
    confirmations: Number(event.confirmations || 0),
    raw: body,
  };
}

export async function persistIncomingDeposit(event: NormalizedDepositEvent): Promise<{ status: string; escrowId?: string }> {
  const address = await prisma.depositAddress.findFirst({
    where: { address: event.recipient, network: event.network, asset: event.asset, status: "ACTIVE" },
    select: { id: true, escrowId: true, escrow: { select: { id: true, totalAmount: true, state: true } } },
  });
  if (!address) return { status: "UNMATCHED" };
  const status = event.confirmations >= Number(process.env.INCOMING_DEPOSIT_CONFIRMATIONS || 3) ? "CONFIRMED" : "RECEIVED";
  const deposit = await prisma.incomingDeposit.upsert({
    where: { network_txHash_eventIndex: { network: event.network, txHash: event.txHash, eventIndex: event.eventIndex ?? 0 } },
    create: {
      depositAddressId: address.id,
      network: event.network,
      asset: event.asset,
      txHash: event.txHash,
      eventIndex: event.eventIndex,
      blockNumber: event.blockNumber,
      amountBaseUnits: event.amountBaseUnits,
      sender: event.sender,
      recipient: event.recipient,
      confirmations: event.confirmations,
      status,
      rawPayload: event.raw as any,
      confirmedAt: status === "CONFIRMED" ? new Date() : undefined,
    },
    update: { confirmations: event.confirmations, status, confirmedAt: status === "CONFIRMED" ? new Date() : undefined },
  });
  // Never set Escrow.state here: only verified escrow-contract events may advance financial state.
  return { status: deposit.status, escrowId: address.escrowId };
}
