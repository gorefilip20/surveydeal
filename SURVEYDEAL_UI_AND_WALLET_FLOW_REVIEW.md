# SurveyDeal Escrow — UI and Dynamic Wallet Flow Review

**Date:** 26 August 2026  
**Latest commit:** `d074931`

## Bright palette breakdown

| Role | Value | Usage |
|---|---|---|
| Page background | `#F7FBFF` | Main public canvas; keeps the page bright and spacious |
| Surface white | `#FFFFFF` | Navigation, cards, forms, and high-priority content panels |
| Primary text | `#0F172A` | Headlines, navigation emphasis, and high-contrast calls to action |
| Secondary text | Slate family, approximately `#475569`–`#64748B` | Body copy, supporting descriptions, labels, and metadata |
| Cyan accent | `#0891B2` / `#06B6D4` | Primary brand accent, trust indicators, links, and primary actions |
| Blue accent | `#2563EB` / `#3B82F6` | Primary action gradient, interactive states, and progress visualization |
| Violet accent | `#7C3AED` / `#8B5CF6` | Secondary gradient endpoint and visual differentiation |
| Success | Emerald family, approximately `#10B981` | Funded, completed, active, or verified states |
| Attention | Amber family, approximately `#F59E0B` | In-progress and needs-attention states |
| Dark trust panel | `#020617`–`#172554` | Deliberate contrast block for payment rails and protected-value visualization, not the page background |

The design uses a light canvas with dark text and white surfaces, then reserves the dark navy panel for the payment-rails section. This preserves visual contrast and makes the payment area feel secure without returning to an entirely dark website.

## Wallet flow implemented

The flow now has three linked layers:

1. **Admin configuration:** `/admin` → **Payment Wallets**. The administrator can add a coin symbol, network, wallet address, label, instructions, and active/inactive state, then publish the list.

2. **Public configuration API:** `GET /api/payment-wallets` returns only active wallets. The protected admin routes are `GET /api/admin/payment-wallets` and `PUT /api/admin/payment-wallets`.

3. **User-facing payment display:** The public homepage displays active wallets in **Payment Rails**. The escrow detail/payment view also fetches the same public list and displays **Official payment wallets** with copy controls alongside the escrow-specific deposit address.

The escrow-specific deposit address remains separate from the administrator’s public receiving wallets. This distinction is intentional: an official payment wallet is a published payment destination, while an escrow deposit wallet is the address monitored for a particular escrow. They should not be silently treated as interchangeable.

## Verification results

| Check | Result |
|---|---:|
| Frontend TypeScript check | Pass |
| Frontend production build | Pass |
| Backend Prisma generation | Pass |
| Backend TypeScript check | Pass |
| Backend production build | Pass |
| Dynamic-wallet references present in admin, public homepage, and escrow payment view | Pass |
| Admin route remains separate at `/admin` | Pass |
| Live admin publish → database → checkout display | Not executable in this sandbox |

The live publish-to-checkout test requires a configured `DATABASE_URL`, `JWT_SECRET`, valid admin credentials, and a running backend connected to the same database as the frontend. The code path is wired and type-checked, but this environment does not contain production credentials or a usable database connection, so I did not claim a live transaction-level pass.

## Recommended acceptance test in the deployed environment

Create a wallet in `/admin`, for example `USDC` on `Base`, save address `0x...`, and publish it. Open the public homepage and confirm the wallet appears under **Available payment wallets**. Open an existing escrow payment view and confirm the same address appears under **Official payment wallets**. Change the address in `/admin`, publish again, refresh both public screens, and confirm only the new address appears. Finally, deactivate the wallet and confirm it disappears from both public views while remaining visible in the admin editor.

Before accepting real deposits, add address-format validation per network, a two-person approval process for production wallet changes, a wallet-change audit history, explorer links, confirmation thresholds, and a warning that payment-wallet deposits are not automatically considered escrow-funded until on-chain verification succeeds.
