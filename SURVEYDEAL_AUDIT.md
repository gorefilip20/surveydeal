# SurveyDeal Full-Stack and Escrow Audit

**Author:** Manus AI  
**Audit date:** 21 August 2026  
**Audited baseline:** `main` at `6aa8cc8`  
**Review branch:** `audit/founder-hardening` at `3915944`  
**Pull-request link:** [review the hardening branch](https://github.com/gorefilip20/surveydeal/pull/new/audit/founder-hardening)

> **Finance and security disclaimer:** I am an AI, not a licensed financial adviser, smart-contract auditor, lawyer, or compliance professional. This is engineering analysis, not a guarantee that funds, contracts, or the business are safe to launch. Obtain an independent Solidity security review and qualified legal/compliance advice before handling customer funds.

## Executive conclusion

SurveyDeal has a promising foundation: a Next.js frontend, Express/TypeScript API, PostgreSQL/Prisma data model, EVM escrow contract, deposit-wallet flow, milestone workflow, disputes, admin tooling, and multi-chain intent. The repository is **not yet production-safe for real customer funds**. The most important reason is that the off-chain funding path and database state can be trusted more than the chain, while the custodial deposit-wallet path does not safely retain recoverable private keys. In addition, the default `main` branch did not type-check, Prisma initially failed schema validation, and the admin release API references contract methods that are absent from the checked-in contract.

I created and pushed a separate hardening branch rather than changing `main`. That branch repairs the Prisma relation schema, fixes the listener startup typo, binds deposit verification to the expected token and exact amount, preserves the escrow chain ID in transaction records, invalidates frozen or demoted sessions on subsequent requests, removes insecure admin credential fallbacks, and changes dispute “consensus” into a two-party matching proposal flow. It also adds three Solidity regression tests.

The branch improves the situation, but it does **not** make the product launch-ready. The remaining P0/P1 items below should be treated as release blockers.

## Verification summary

| Area | Result | Evidence and interpretation |
|---|---:|---|
| Prisma schema validation after hardening | Pass | Missing reverse relations were added for `User`, `Escrow`, `ChatRoom`, and `AdminTransfer`. |
| Solidity compile | Pass | Hardhat compiled the escrow contract successfully. |
| Solidity regression tests | Pass: 3/3 | New tests cover funding/release, two-party dispute consensus, and non-counterparty rejection. The repository previously had no contract tests: `0 passing`. |
| Frontend compilation | Pass | Next.js reported `Compiled successfully`; the full optimized build stalled in a memory-constrained sandbox before completion, so a clean production-build certification is still outstanding. |
| Main backend TypeScript check | Fail | After Prisma client generation, 53 errors remained across admin, chat, escrow, DexScreener, and transfer controllers. The separate unmerged production-ready branch reduced this to one portable Prisma type annotation issue after its declared dependencies were installed. |
| Dependency audit | Fail | Installed dependency trees reported 5 backend vulnerabilities, including 4 high, and 29 frontend vulnerabilities, including 6 high and 1 critical. These need triage rather than blind `npm audit fix --force`. |
| Live database/API smoke test | Not certified | No production database credentials or deployed contract endpoint were provided, and the server requires a database connection at startup. |

## Critical escrow findings

| Priority | Finding | Impact | Status |
|---|---|---|---|
| **P0** | Deposit-wallet private keys are generated but discarded. EVM keys are returned by the generator and then not persisted by the escrow controller; Solana and TRON addresses are explicit placeholders. | Deposits may be unrecoverable, and non-EVM deposits cannot work as advertised. This is a direct custody and funds-loss risk. | **Open** |
| **P0** | Background funding is based on current deposit-address balance, not a unique verified transaction. | Pre-existing funds, multiple transfers, wrong-token transfers, or sweep timing can cause incorrect attribution and non-auditable funding records. | **Open** |
| **P0** | The generic `/escrows/:id/state` endpoints let a buyer or seller write `FUNDED`, `COMPLETED`, `REFUNDED`, or other states without proving the corresponding on-chain event. | A user can make the database say an escrow is funded, completed, or refunded even when the contract did not perform that transition. | **Open** |
| **P0** | Admin release endpoints call `adminApproveMilestone`, `adminForceRelease`, and `adminApproveAllMilestones`, but those functions are not present in the checked-in Solidity contract. | Admin release either fails at runtime or cannot be relied upon; any DB mutation after a presumed on-chain success risks divergence. | **Open** |
| **P1** | The original dispute consensus function allowed one participant to choose a split unilaterally. | A supposedly locked 2-of-2 dispute could be settled by one counterparty. | **Fixed on review branch** |
| **P1** | Original ERC-20 deposit verification accepted any `Transfer` log to the recipient and did not enforce exact amount. | A transaction involving the wrong token or a partial amount could be marked as a valid deposit. | **Fixed on review branch** |
| **P1** | Deposit confirmation wrote `chainId: 0` for every manually verified transaction. | Reporting, reconciliation, and explorer links could point to the wrong chain. | **Fixed on review branch** |
| **P1** | Fee configuration is mutable by a privileged role, and fee accounting is not mirrored in an immutable per-escrow snapshot. | A governance change can alter economics for later releases; users need explicit fee terms at creation time. | **Open design issue** |
| **P1** | The contract has no timeout path for an inactive seller after funding, other than buyer refund after the global deadline. | Milestone-specific abandonment can trap counterparties longer than intended. | **Open design issue** |
| **P1** | No independent Solidity audit, fuzzing, invariant suite, or adversarial test suite exists in the repository. | Compilation alone does not establish custody safety or state-machine correctness. | **Open** |

## Backend, authentication, and data findings

The original Prisma schema failed validation because four relations lacked opposite fields. This prevented reliable client generation and contributed to backend compile failures. The review branch repairs those relations, but the backend still requires a broader type-cleanup pass. The cleanest candidate is the repository’s separate `claude/survey-deal-deploy-be4k9q` branch, which adds validation, rate limiting, crypto helpers, release/refund services, and auth context; it still needs dependency and portability cleanup before merge.

The original user and admin middleware trusted JWT claims too much. The hardening branch now re-checks the current user, wallet, admin status, and freeze status in the database on each authenticated request. It also removes the development fallback admin email/password and hardcoded admin wallet from the simple-login path. The remaining admin model should use a real password-hash flow, mandatory MFA or hardware-backed signing for privileged actions, rate limiting, audit logs, and an explicit separation between operational support staff and treasury authority.

The escrow controller creates or upserts seller and token records from request data, accepts an `onChainId` supplied by the client, and exposes mutable state endpoints. A production design should create the off-chain escrow record only after validating a signed creation intent and should bind it to a specific chain, contract address, escrow ID, token address, amount, milestone hash, and agreement hash. Every state transition should be idempotent and derived from a verified transaction or contract event, with a reconciliation worker able to repair temporary database lag.

The database stores `depositWalletKey` as a field, but the current deposit-wallet controller does not populate it. If custodial deposits remain in scope, keys should be encrypted with a KMS/HSM-backed envelope key, access should be narrowly scoped, sweeping should be independently authorized, and every sweep should have a durable transaction and reconciliation record. If non-custodial operation is the intended model, remove the custodial deposit-wallet feature and require direct wallet-to-contract funding instead.

## Contract-state recommendations before launch

The contract should become the sole source of truth for escrow balances and lifecycle state. The API should index events rather than inventing synthetic transaction hashes such as `deposit-confirmed-*`. Funding should be linked to a transaction hash, block number, log index, token address, recipient, exact amount, and sufficient confirmation depth. Reorg handling is necessary: a transaction should remain provisional until the configured finality threshold is met, then be promoted to confirmed.

The contract should use an explicit per-escrow fee snapshot, a maximum milestone count, bounded string lengths, and a clear policy for fee-on-transfer or rebasing tokens. The current proportional recalculation for short-received transfers is not appropriate for a normal escrow without a product decision: it silently changes the agreed milestone amounts. Prefer rejecting short funding and supporting only allowlisted, non-fee-on-transfer tokens until a deliberately designed alternative is audited.

Admin force-release should not be added casually. If business operations require arbitration, implement a separately audited role model with timelocks, transparent evidence, dual approval, explicit dispute deadlines, and an on-chain event that the indexer can reconcile. Do not keep an ABI for methods absent from the deployed bytecode.

## Product opportunities

SurveyDeal can become more than a single escrow form by focusing on trust infrastructure for crypto-native work and commerce. The strongest next features are not a large number of superficial integrations; they are features that reduce disputes, improve recoverability, and create a defensible transaction history.

| Opportunity | User value | Suggested first version |
|---|---|---|
| **Escrow templates** | Faster, safer deal creation | Templates for freelance work, OTC trades, grants, influencer campaigns, and milestone-based software delivery. |
| **Evidence and acceptance center** | Fewer ambiguous disputes | Versioned deliverables, timestamps, hashes, structured acceptance criteria, and a formal review window per milestone. |
| **Reputation graph** | Better counterparty selection | Wallet-linked completion rate, dispute rate, response time, verified work history, and privacy-preserving attestations. |
| **Arbitration marketplace** | Scalable dispute handling | Approved arbiters with transparent fees, service levels, specialization, conflict disclosures, and two-person review for large claims. |
| **Payment links and API** | Distribution beyond the dashboard | Shareable escrow links, embeddable checkout, webhooks, and merchant APIs with idempotency keys. |
| **Treasury and reconciliation console** | Operational safety | Per-chain balances, pending/confirmed/reorged deposits, sweep queues, reconciliation exceptions, and role-based approvals. |
| **Stablecoin risk controls** | Better capital protection | Token allowlist, liquidity/peg warnings, token metadata verification, decimals protection, and pause policies. |
| **Privacy-preserving agreements** | Stronger commercial trust | Store agreement hashes on-chain while keeping sensitive text encrypted off-chain with explicit participant access. |
| **Automated reminders and SLAs** | Fewer inactive escrows | Deadline reminders, grace periods, auto-escalation, and milestone-specific timeout actions. |
| **Institutional controls** | Higher-value customers | Multi-approval treasury, spend limits, exportable audit trails, segregated roles, and compliance-ready case files. |

## Recommended delivery sequence

**Release gate 1: custody and truth.** Choose either direct non-custodial contract funding or a properly engineered custodial system. Remove generic client-controlled state transitions, implement event-based indexing with reorg/finality handling, reconcile every deposit, and resolve the missing admin contract methods.

**Release gate 2: correctness and reliability.** Merge or reimplement the validation/rate-limiting work from the unmerged production branch, make the backend type-check cleanly, complete the frontend production build, add API integration tests, add contract fuzz/invariant tests, and run dependency remediation with lockfile review.

**Release gate 3: controlled beta.** Start with one EVM chain and one allowlisted stablecoin. Cap escrow size, use a monitored multisig for protocol administration, publish supported-token and fee policies, provide an emergency pause and recovery runbook, and run a small invite-only beta with synthetic funds before enabling real value.

**Release gate 4: expansion.** Only after reconciliation and dispute operations are proven should SurveyDeal add more chains, custodial deposit wallets, non-EVM support, swaps, or an arbitration marketplace.

## Founder questions requiring decisions

1. **Custody model:** Do you want SurveyDeal to be non-custodial, where users fund the audited contract directly, or custodial, where SurveyDeal controls deposit wallets and sweeps funds? This decision changes the architecture, security budget, compliance posture, and launch timeline.

2. **Arbitration authority:** In locked mode, should disputes require strict buyer-and-seller agreement, or should a neutral arbiter always be able to decide after a timeout? Who appoints, pays, and removes arbiters?

3. **Launch scope:** Which single chain and token should be the first real-money launch? My recommendation is one EVM chain and one established stablecoin rather than launching the advertised multi-chain surface immediately.

4. **Admin power:** Should administrators ever be able to force-release customer funds, or should admins only pause new activity and manage disputes through a transparent arbiter process?

5. **Commercial model:** Is the protocol fee charged to the escrow amount, split between buyer and seller, capped per deal, or paid separately? Should the fee be immutable at deal creation?

6. **Operational responsibility:** Who will monitor deposits, reorgs, failed sweeps, stuck milestones, disputes, and key-access alerts, and what is the target response time for each incident class?

7. **Compliance and geography:** Which countries and customer types are in scope, and will SurveyDeal serve consumers, businesses, or crypto-native professionals first? This should be decided before expanding payment rails or custodial functionality.

## References

[1]: https://github.com/gorefilip20/surveydeal "SurveyDeal repository"
[2]: https://github.com/gorefilip20/surveydeal/blob/main/contracts/contracts/SurveydealEscrow.sol "Surveydeal escrow smart contract"
[3]: https://github.com/gorefilip20/surveydeal/blob/main/backend/src/services/blockchainListener.ts "Surveydeal blockchain listener"
[4]: https://github.com/gorefilip20/surveydeal/blob/main/backend/src/services/walletGenerator.ts "Surveydeal wallet generator"
[5]: https://github.com/gorefilip20/surveydeal/blob/main/backend/src/controllers/escrowController.ts "Surveydeal escrow controller"
[6]: https://github.com/gorefilip20/surveydeal/blob/main/backend/src/controllers/adminController.ts "Surveydeal admin controller"
[7]: https://github.com/gorefilip20/surveydeal/tree/claude/survey-deal-deploy-be4k9q "Surveydeal unmerged production-ready branch"
[8]: https://github.com/gorefilip20/surveydeal/tree/audit/founder-hardening "Surveydeal audit hardening branch"
