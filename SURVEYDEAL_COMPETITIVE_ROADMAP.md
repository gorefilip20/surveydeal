# SurveyDeal Escrow — Competitive Product Roadmap

**Prepared for:** SurveyDeal Escrow  
**Author:** Manus AI  
**Date:** 26 August 2026

## Product direction

SurveyDeal should become the **trust and settlement layer for digital deals**, not only a wallet-to-wallet transfer screen. The strongest differentiation is a simple promise: every deal has clear terms, a visible funding state, evidence-backed milestones, and an understandable path to release or dispute.

Market expectations already include milestone payments, neutral dispute resolution, multi-chain coverage, stablecoin support, and transaction monitoring.[1] [2] SurveyDeal should compete by making those capabilities unusually transparent and easy to use rather than by claiming support for every chain before the technical adapters and operations are ready.

## The three requested changes

### 1. Brighter, more attractive frontend

The public homepage should use a light, high-contrast visual system with cyan, blue, and violet accents. The new structure emphasizes one clear action—creating an escrow—alongside a visual escrow workspace that explains the product faster than a list of generic features. The GitHub CTA has been removed from the public page so visitors are guided toward product actions rather than developer navigation.

The visual system should remain consistent across the create flow and dashboard. Use white cards, slate text, soft gradients, stronger spacing, and visible trust states. Do not use color alone to communicate transaction status; pair each state with a label such as `Funded`, `Awaiting delivery`, `Disputed`, or `Released`.

### 2. Clear payment and deposit experience

Users should see the correct payment instructions in context: coin, exact network, address, amount, memo/tag requirements where applicable, confirmation count, and explorer link. The UI must warn users that sending a token on the wrong network can permanently lose funds. A copied address should produce a visible confirmation, and the deposit screen should show `Awaiting transaction`, `Detecting payment`, `Confirming`, `Confirmed`, or `Needs review`.

The current implementation adds a public payment-wallet section driven by admin configuration. This is suitable for publishing official payment rails, but it must not be confused with automatic escrow funding. A public receiving wallet is a payment destination; a smart-contract escrow deposit is a separate custody and verification flow. Before launch, each route must clearly disclose which one the user is using.

### 3. Admin-editable payment wallets

The admin dashboard now has a **Payment Wallets** section. An administrator can add any coin/network combination, enter the address, add a label and instructions, toggle visibility, remove entries, and publish the list. The backend stores each wallet as a first-class `PaymentWallet` row with indexed network/address fields, exposes it through a protected admin endpoint, and exposes only active wallets through the public endpoint. The migration also backfills valid records from the former `ProtocolConfig` JSON representation.

The recommended operating policy is to require two-person approval for changing a production wallet, keep an immutable audit log, display the last-published timestamp, and require a confirmation phrase before replacing an address. Wallet addresses should be treated as public configuration, while private keys must never be stored in this feature or returned by any endpoint.

## Recommended feature set

| Priority | Feature | Competitive value | Product requirement |
|---|---|---|---|
| P0 | Testnet escrow simulator | Lets users understand the lifecycle without risking funds | Seed demo deal, simulated funding, milestone approval, dispute walkthrough |
| P0 | Verifiable transaction timeline | Turns backend status into visible proof | Explorer links, block confirmations, transaction hashes, failure explanations |
| P0 | Contract safety center | Builds confidence before users deposit | Contract addresses, chain IDs, verified source links, fee policy, audit status |
| P0 | Real contract test suite | Required before handling real value | Cover all state transitions, roles, refunds, fees, disputes, pause, and reentrancy |
| P1 | Payment-wallet manager | Gives operations control without code changes | Admin CRUD, active toggle, address confirmation, audit trail, two-person approval |
| P1 | Smart deposit matching | Reduces manual support work | Match chain, token, amount, escrow ID/memo, sender, confirmations, and timestamp |
| P1 | Evidence-based disputes | Makes arbitration fairer | Upload evidence, milestone comments, timestamps, immutable agreement hash |
| P1 | Notifications | Prevents stalled deals | Email, webhook, and in-app alerts for funding, delivery, approval, dispute, and expiry |
| P1 | Counterparty reputation | Helps users choose safer counterparties | Completed-deal count, dispute rate, response time, verified wallet history |
| P1 | Multi-asset fee engine | Makes pricing understandable | Fee preview before signing, fee cap, fee recipient disclosure, receipts |
| P2 | Team workspaces | Expands from individual trades to agencies and businesses | Roles, approvals, shared deals, billing, exportable reports |
| P2 | API and webhooks | Enables marketplaces and OTC desks to integrate SurveyDeal | Idempotency keys, signed webhooks, API keys, rate limits, event replay |
| P2 | Fiat on/off-ramp partners | Broadens adoption beyond crypto-native users | Quote, compliance handoff, settlement status, refund path |
| P2 | Analytics and reporting | Creates operational value | Volume, completion time, dispute rate, chain mix, fee revenue, cohort retention |

## Wallet and deposit rules

| Rule | Implementation guidance |
|---|---|
| Every wallet has a coin and network | Never display an address without both labels |
| One address can be reused only intentionally | Prefer unique per-escrow deposit wallets for automated matching |
| Network mismatch is a blocking warning | Show `USDC on Base` and `USDC on Ethereum` as different payment options |
| Native and token assets differ | Store token contract address and decimals for ERC-20-style assets |
| Solana and TRON need separate adapters | Do not expose them as fully operational merely because their names appear in a selector |
| Addresses are public; keys are secret | Never place private keys in PaymentWallet, ProtocolConfig, or public responses |
| Changes need an audit trail | Record who changed what, when, and the old/new address fingerprints |
| User payment is not proof of escrow funding | Confirm on-chain transfer and required confirmations before changing state |

## Trust and compliance roadmap

A credible escrow product needs more than attractive UI. Add risk disclosures, terms of service, privacy policy, support escalation, sanctions/KYT screening, suspicious-activity review, rate limits, and incident response. Transaction monitoring is commonly used to flag fraud, money-laundering, and sanctions risk in real time.[3] The exact compliance obligations depend on the operating jurisdiction and custody model, so obtain qualified legal advice before taking custody or serving restricted regions.

## Suggested launch sequence

**Phase 1 — Prove the loop.** Finish the bright public experience, wallet settings, demo escrow, and transaction timeline. Add contract tests and deploy only to a public testnet with verified source and a published contract address.

**Phase 2 — Operate safely.** Add unique deposit addresses, automatic matching, confirmation thresholds, alerts, audit logs, backups, RPC failover, rate limiting, and admin two-person approval. Run a closed beta with low limits and explicit testnet/mainnet labeling.

**Phase 3 — Earn trust.** Complete an independent contract audit, publish the result, add reputation and evidence-based disputes, launch team workspaces, and expose a stable API/webhook surface.

**Phase 4 — Expand distribution.** Integrate marketplaces, agencies, OTC desks, and payment partners. Use analytics to improve completion rate and reduce disputes rather than adding more chains indiscriminately.

## References

[1]: https://escrowly.com/milestone-transactions-escrow/ — Escrowly, milestone escrow and dispute-resolution positioning.

[2]: https://www.escrownia.com/ — Escrownia, multi-blockchain and crypto escrow product positioning.

[3]: https://www.trmlabs.com/glossary/transaction-monitoring — TRM Labs, transaction monitoring overview.
