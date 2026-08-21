# Unique Deposit Attribution: Safe Implementation Specification

## Executive decision

A unique deposit address per escrow is safe only when the address is generated and controlled by a qualified custody/MPC provider, or when it is an on-chain contract-derived destination. A mnemonic stored by the application is not an acceptable production custody design.

For the recommended BNB v1, use the existing `SurveydealEscrow` contract and attribute payment by the on-chain `escrowId` emitted in `EscrowFunded`. This is safer than a unique custodial wallet because the buyer signs `fundEscrow(escrowId)` from their own wallet and the contract holds the funds.

If ordinary deposit addresses are a business requirement, implement the following provider-backed design.

## Data model

Add durable models equivalent to:

```prisma
model DepositAddress {
  id              String   @id @default(cuid())
  escrowId        String   @unique
  escrow          Escrow   @relation(fields: [escrowId], references: [id], onDelete: Cascade)
  provider        String
  network         String
  asset           String
  address         String
  providerRef     String   @unique
  status          DepositAddressStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deposits        IncomingDeposit[]

  @@unique([network, address])
  @@index([network, asset, status])
}

enum DepositAddressStatus { ACTIVE REVOKED }

model IncomingDeposit {
  id              String   @id @default(cuid())
  depositAddressId String
  depositAddress  DepositAddress @relation(fields: [depositAddressId], references: [id], onDelete: Cascade)
  network         String
  asset           String
  txHash          String
  eventIndex      Int?
  blockNumber     BigInt?
  amountBaseUnits String
  sender          String
  recipient       String
  confirmations   Int      @default(0)
  status          IncomingDepositStatus @default(RECEIVED)
  rawPayload      Json?
  observedAt      DateTime @default(now())
  confirmedAt     DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@unique([network, txHash, eventIndex])
  @@index([depositAddressId, status])
  @@index([network, recipient, status])
}

enum IncomingDepositStatus { RECEIVED CONFIRMED REJECTED UNMATCHED REORGED SWEPT }
```

The existing `Escrow` model should have a one-to-one `depositAddress` relation. Do not use `depositWalletKey` for the production implementation. Remove or permanently disable that field after migration if custody is not adopted.

## Allocation transaction

The backend must request a unique address from the custody provider inside a database transaction and never generate it locally:

```ts
export async function allocateDepositAddress(escrowId: string) {
  return prisma.$transaction(async (tx) => {
    const escrow = await tx.escrow.findUnique({ where: { id: escrowId }, include: { token: true } });
    if (!escrow) throw new Error("Escrow not found");
    if (escrow.depositAddress) return escrow.depositAddress;
    if (escrow.network !== "BNB_CHAIN" || escrow.token.symbol !== "USDT") {
      throw new Error("Only explicitly enabled BNB USDT custody is supported");
    }

    const providerAddress = await custodyProvider.createDepositAddress({
      externalReference: escrow.id,
      network: "BSC",
      asset: "USDT",
    });

    const address = await tx.depositAddress.create({
      data: {
        escrowId: escrow.id,
        provider: custodyProvider.name,
        providerRef: providerAddress.id,
        network: "BSC",
        asset: "USDT",
        address: providerAddress.address,
      },
    });
    return address;
  });
}
```

The provider must guarantee address uniqueness, retain the mapping durably, and expose a webhook or query API. The application must not accept an address supplied by the browser as the escrow’s deposit address.

## Webhook inbox

The webhook endpoint must authenticate the provider request, persist the raw event, and enqueue processing. It must not update escrow state directly:

```ts
router.post("/webhooks/custody/:provider", async (req, res) => {
  const signature = req.header("x-provider-signature");
  if (!signature || !verifyProviderSignature(req.rawBody, signature, process.env.CUSTODY_WEBHOOK_SECRET!)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const event = normalizeProviderEvent(req.body);
  await prisma.webhookInbox.upsert({
    where: { provider_eventId: { provider: event.provider, eventId: event.id } },
    create: { provider: event.provider, eventId: event.id, payload: req.body, status: "RECEIVED" },
    update: {},
  });
  await queue.publish("custody.deposit.received", event.id);
  res.status(202).json({ accepted: true });
});
```

The worker must fetch the transaction from the provider or chain, verify network, token contract, recipient address, amount, successful receipt, confirmation depth, and reorg status. Only then may it create or update `IncomingDeposit`.

## Attribution and state transition

The only automatic matching key is the active `DepositAddress.address` plus the exact configured `network` and `asset`. The matching query must be deterministic:

```ts
const target = await prisma.depositAddress.findUnique({
  where: { network_address: { network: event.network, address: event.recipient } },
  include: { escrow: true },
});

if (!target || target.asset !== event.asset) {
  await markUnmatched(event);
  return;
}

await prisma.$transaction(async (tx) => {
  const deposit = await tx.incomingDeposit.upsert({
    where: { network_txHash_eventIndex: { network: event.network, txHash: event.txHash, eventIndex: event.eventIndex ?? 0 } },
    create: { depositAddressId: target.id, network: event.network, asset: event.asset, txHash: event.txHash, eventIndex: event.eventIndex ?? 0, blockNumber: event.blockNumber, amountBaseUnits: event.amountBaseUnits, sender: event.sender, recipient: event.recipient, confirmations: event.confirmations, status: event.confirmations >= REQUIRED_CONFIRMATIONS ? "CONFIRMED" : "RECEIVED", rawPayload: event.raw },
    update: { confirmations: event.confirmations },
  });

  if (deposit.status !== "CONFIRMED") return;
  if (BigInt(deposit.amountBaseUnits) !== BigInt(target.escrow.totalAmountBaseUnits)) {
    await tx.incomingDeposit.update({ where: { id: deposit.id }, data: { status: "REJECTED" } });
    return;
  }

  // Critical rule: an incoming custodial transfer is not a contract funding event.
  // It must remain pending until the custody/reconciliation policy explicitly approves it.
  await tx.escrow.update({ where: { id: target.escrowId }, data: { fundingMethod: "DEPOSIT_TRANSFER" } });
});
```

Do **not** set `Escrow.state = FUNDED` in this worker unless the product has an audited custody policy that explicitly defines receipt as custody-backed escrow. The safer design is to sweep funds into the on-chain escrow contract and set `FUNDED` only after the contract emits `EscrowFunded` and the existing event indexer confirms it.

## Sweep-to-contract protection

For real escrow protection, the provider must sign a transaction that calls the deployed contract’s `fundEscrow(escrowId)` using the exact asset and amount. The sweep worker must enforce an allowlisted contract address, escrow ID, token address, amount, nonce/idempotency key, destination chain, and dual approval for exceptional actions. After the transaction confirms, the existing `ChainEvent` reducer is the sole component that moves the escrow to `FUNDED`.

A generic transfer to a shared BNB or TRON wallet is not escrow protection. It is only a payment received by the platform. The platform becomes responsible for custody, reconciliation, disputes, refunds, and recovery.

## Current repository status

Working now: public display of the supplied BNB/TRON/Solana addresses; protected admin editing; strict address-shape validation; explicit custody warnings; fail-closed legacy wallet-generation endpoint; BNB contract deployment scripts; BNB USDT seed entry; durable EVM contract-event indexer; immutable chain-event deduplication; read-only database lifecycle state endpoint; backend TypeScript check; frontend production build; and Solidity regression tests.

Not working or not complete: live custody-provider integration; unique deposit-address allocation; BNB/TRON/Solana webhook monitoring; per-deposit attribution for the supplied shared wallets; automatic sweep-to-contract; recovery and key management; on-chain create/fund wiring from the frontend; a verified deployed BNB escrow contract address; production database deployment; and independent contract/custody review.

Therefore the supplied addresses may be displayed for controlled testing, but they must not be described as escrow-protected deposit addresses. The only safe real-funds launch path is to complete the direct BNB contract flow or integrate and audit a qualified custody provider plus the sweep-to-contract process above.
