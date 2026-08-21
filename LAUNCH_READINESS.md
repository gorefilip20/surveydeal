# SurveyDeal Launch Readiness and Administration

## Current status

The review branch now includes a durable EVM escrow event indexer, immutable chain-event records, cursor persistence, confirmation-depth processing, an explicit lifecycle transition reducer, a fail-closed arbitrary state endpoint, disabled custodial deposit-wallet generation, secure admin configuration without fallback credentials, and a public navigation boundary that does not expose the admin link.

Prisma validation passes, the backend TypeScript check passes, the frontend production build passes, and the Solidity regression suite passes 3/3. This is a **release candidate for staging and testnet**, not a declaration that real-money production is safe. A real-money launch still requires a deployed and independently reviewed contract, a real staging database, production secrets, operational monitoring, and a confirmed custody/compliance decision.

## How SurveyDeal works

A user connects an EVM wallet and authenticates with a signed message. The buyer creates an escrow agreement with a seller, token, amount, milestones, deadline, and either locked or arbiter mode. The backend stores the commercial metadata and the connected wallet performs the corresponding on-chain contract transaction. The contract is the source of truth for custody and lifecycle state.

The event indexer monitors only explicitly configured deployed escrow contracts. It waits for the configured confirmation depth, stores each event exactly once using `(chainId, contractAddress, transactionHash, logIndex)`, and advances the off-chain view only when the event is a legal transition from the current state. The database is therefore an indexed read model, not a wallet or a user-editable state machine.

Delivery evidence, buyer approvals, disputes, chat, and support records remain off-chain application data. They must not be mistaken for a release of funds. A release, refund, funding, or completion state is final only after the matching contract event is indexed.

For the recommended first launch, SurveyDeal should be **non-custodial**: users approve the allowlisted token and call the escrow contract directly from their own wallets. SurveyDeal should not receive a seed phrase, private key, or unrestricted USDT wallet credential. If a custodial flow is later required, it needs a dedicated KMS/HSM-backed custody design and independent security review.

## Administrator access

There is intentionally **no universal admin password** in the repository and no safe way to provide one from this environment. The first administrator is provisioned at deployment time with secret-manager values:

```text
ADMIN_EMAIL=<your-admin-email>
ADMIN_PASSWORD=<long unique password stored only in the secret manager>
ADMIN_WALLET=<checksummed admin wallet address>
JWT_SECRET=<random 32-byte or longer secret>
```

The backend refuses the simple-login flow when these values are missing. The login page is available at `/admin`, but the public navigation does not advertise it. After login, the admin dashboard provides overview analytics, users/assets, escrows, token controls, and dispute queues. Privileged API middleware rechecks the current database administrator and frozen status rather than trusting only the original JWT claims.

Do not use an example password, do not place a private key in `.env` committed to Git, and do not use `ADMIN_PRIVATE_KEY` for customer custody. Treasury signing should use a separate multisig or qualified custody system with dual approval.

## Production configuration

Configure the following only in the deployment secret manager:

```text
DATABASE_URL=...
JWT_SECRET=...
FRONTEND_URL=https://your-production-domain.example
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
ADMIN_WALLET=...
ESCROW_CONTRACT_ADDRESSES={"<chainId>":"<verified contract address>"}
INDEXER_MIN_CONFIRMATIONS=3
ENABLE_ESCROW_EVENT_INDEXER=true
ENABLE_LEGACY_DEPOSIT_LISTENER=false
```

Use one chain and one allowlisted stablecoin for the first pilot. `ESCROW_CONTRACT_ADDRESSES` must point to the exact verified deployed bytecode. Do not enable the legacy balance-based listener. Do not enable custodial deposit-wallet generation until that product is separately implemented and reviewed.

## Remaining launch gates

| Gate | Required evidence |
|---|---|
| Contract | Independent audit, deployed-address verification, pause/multisig procedure, fuzz and invariant tests, and a tested recovery runbook |
| Event indexer | Staging replay from a known block, duplicate/retry tests, RPC outage recovery, confirmation-depth test, and reorg test |
| Database | Production migration, unique constraints applied, backups/restores tested, and reconciliation dashboard/alerts |
| Frontend | Wallet transaction tests for create/fund/activate/release/refund/dispute, mobile testing, and correct network/token error handling |
| Admin | Secret-manager provisioning, MFA/dual approval for treasury actions, audit log review, and an admin access test using a non-production account |
| Custody | Either remove custodial deposits from v1 or complete KMS/HSM encryption, recovery drills, sweep controls, and legal/compliance review |
| Operations | RPC monitoring, indexer lag alert, failed transaction alert, incident owner, support SLA, and capped pilot limits |

## Deployment recommendation

Deploy the current branch to staging with testnet funds only. Run an invite-only pilot after the contract and indexer gates pass. The public site can be used for product demos and testnet testing now; it should not yet be presented as a production service for depositing valuable USDT or other crypto.
