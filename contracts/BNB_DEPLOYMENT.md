# BNB BEP-20 USDT Deployment Runbook

## Important distinction

SurveyDeal’s non-custodial deposit destination is the **deployed `SurveydealEscrow` contract address**, not a generic platform wallet. Users should only fund a specific escrow through the contract’s `fundEscrow(escrowId)` function after approving the exact token amount. Do not publish a treasury address as an escrow deposit address.

## 1. Prepare a deployment wallet

Use a dedicated deployment/admin wallet or multisig. Never use a seed phrase or private key committed to Git. Store `DEPLOYER_PRIVATE_KEY`, `ADMIN_ADDRESS`, and `FEE_RECIPIENT` only in a deployment secret manager.

For a first pilot, deploy to BNB testnet and use test tokens. Mainnet deployment should occur only after an independent smart-contract review and a successful testnet replay.

## 2. Configure environment

Copy `contracts/.env.example` to a private deployment environment and set:

```text
DEPLOYER_PRIVATE_KEY=<deployment key held by the secret manager>
ADMIN_ADDRESS=<multisig or dedicated admin address>
FEE_RECIPIENT=<fee recipient address>
FEE_BASIS_POINTS=100
MAX_FEE_ABSOLUTE=50
TOKEN_DECIMALS=18
BSCSCAN_API_KEY=<optional explorer verification key>
```

The configured BNB Smart Chain USDT token record is:

```text
Chain ID: 56
Token: USDT
Address: 0x55d398326f99059fF775485246999027B3197955
Decimals: 18
```

Verify this address independently against the official issuer and BscScan before seeding production data. Token addresses must never be accepted from an arbitrary user request.

## 3. Deploy to BNB testnet

From `contracts/`:

```bash
npm ci
npm run compile
npm run deploy:bsc-testnet
```

Record the printed contract address and deployment transaction hash. Verify constructor roles and fee configuration in the deployment output. Verify the source on the BNB testnet explorer using the matching compiler settings and constructor arguments.

## 4. Deploy to BNB mainnet

Only after testnet acceptance and independent review:

```bash
npm run deploy:bsc-mainnet
```

The deployment script refuses non-local deployment when the deployer key, admin address, fee recipient, fee rate, or fee cap is missing. It does not provide a fallback key or silently assign treasury authority to the deployer.

After deployment, verify the contract address and constructor parameters on BscScan. Grant operational roles only to approved addresses, and use a multisig for the default admin role where possible.

## 5. Configure the backend event indexer

Set the exact deployed address in the backend secret manager:

```text
ENABLE_ESCROW_EVENT_INDEXER=true
ENABLE_LEGACY_DEPOSIT_LISTENER=false
ESCROW_CONTRACT_ADDRESSES={"56":"<verified SurveydealEscrow address>"}
INDEXER_MIN_CONFIRMATIONS=3
INDEXER_POLL_INTERVAL_MS=15000
INDEXER_BLOCK_BATCH_SIZE=1000
```

The indexer stores immutable events keyed by chain, contract, transaction hash, and log index. It derives lifecycle state only from legal event transitions and never uses balance-only attribution for non-custodial escrow funds. Configure alerts for indexer lag, RPC failures, database errors, and event/state mismatches.

## 6. Configure the backend database

Run the Prisma migration against staging first, then production:

```bash
npx prisma migrate deploy
npx prisma db seed
```

The seed contains the BNB USDT record. Confirm the token address, decimals, and chain ID in the admin token view before opening the pilot. The production database must have backups and a tested restore procedure.

## 7. Configure the frontend

Set the frontend API URL and verified BNB contract address in the frontend deployment environment:

```text
NEXT_PUBLIC_API_URL=https://<api-domain>/api
NEXT_PUBLIC_CONTRACT_BSC=<verified SurveydealEscrow address>
```

Rebuild and deploy the frontend after the backend is configured. The address displayed to users must be the verified contract address for the selected network. The UI should instruct users to connect their wallet, select BNB Smart Chain, approve the exact BNB USDT amount, and call the escrow contract. It should not instruct users to send funds to an unassigned wallet.

## 8. Required acceptance test

Create a testnet escrow with one buyer, one seller, one milestone, and a small test amount. Confirm that the buyer can create the matching on-chain escrow, approve BNB USDT, call `fundEscrow`, and see `FUNDED` only after the configured confirmations. Confirm that a wrong token, wrong chain, wrong amount, duplicate transaction, RPC outage, and simulated reorg cannot produce a false funded state. Then test milestone release, dispute, refund, and terminal-state behavior.

A real mainnet contract address cannot be generated from this repository alone. It is created only by executing the deployment transaction from an authorized deployment wallet. Do not claim that a user deposit address is configured until the address is deployed, verified, placed in both backend and frontend secret/config stores, and validated by the acceptance test.
