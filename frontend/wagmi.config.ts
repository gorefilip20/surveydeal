import { http, createConfig } from "wagmi";
import { mainnet, arbitrum, base, hardhat } from "wagmi/chains";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";

// ──────────────────────────────────────────────────────────
//  CHAIN CONFIGURATION
// ──────────────────────────────────────────────────────────

const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ?? "";
const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID ?? "";

const localAnvil = {
  ...hardhat,
  id: 31337,
  name: "Anvil (Local)",
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
} as const;

// ──────────────────────────────────────────────────────────
//  WAGMI + RAINBOWKIT CONFIG
// ──────────────────────────────────────────────────────────

export const config = getDefaultConfig({
  appName: "Surveydeal",
  projectId: WALLET_CONNECT_PROJECT_ID,
  chains: [mainnet, arbitrum, base, localAnvil],
  transports: {
    [mainnet.id]: http(
      ALCHEMY_API_KEY
        ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : undefined
    ),
    [arbitrum.id]: http(
      ALCHEMY_API_KEY
        ? `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : undefined
    ),
    [base.id]: http(
      ALCHEMY_API_KEY
        ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        : undefined
    ),
    [localAnvil.id]: http("http://127.0.0.1:8545"),
  },
  ssr: true,
});

// ──────────────────────────────────────────────────────────
//  CONTRACT ABI STUB (matches SurveydealEscrow.sol)
// ──────────────────────────────────────────────────────────

export const SURVEYDEAL_ESCROW_ABI = [
  {
    name: "createEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_seller", type: "address" },
      { name: "_token", type: "address" },
      { name: "_totalAmount", type: "uint256" },
      { name: "_mode", type: "uint8" },
      { name: "_arbiter", type: "address" },
      { name: "_agreementHash", type: "bytes32" },
      { name: "_deadline", type: "uint256" },
      { name: "_milestoneDescriptions", type: "string[]" },
      { name: "_milestoneAmounts", type: "uint256[]" },
    ],
    outputs: [{ name: "escrowId", type: "uint256" }],
  },
  {
    name: "fundEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "activateEscrow",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "deliverMilestone",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "approveMilestone",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "releaseMilestone",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "initiateDispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "resolveDisputeByConsensus",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
      { name: "buyerBasisPoints", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "resolveDisputeByArbiter",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
      { name: "buyerBasisPoints", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "releaseFunds",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "sellerInitiatedRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "getEscrow",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "buyer", type: "address" },
          { name: "seller", type: "address" },
          { name: "arbiter", type: "address" },
          { name: "token", type: "address" },
          { name: "totalAmount", type: "uint256" },
          { name: "fundedAmount", type: "uint256" },
          { name: "releasedAmount", type: "uint256" },
          { name: "protocolFeeCollected", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "mode", type: "uint8" },
          { name: "agreementHash", type: "bytes32" },
          { name: "createdAt", type: "uint256" },
          { name: "fundedAt", type: "uint256" },
          { name: "deadline", type: "uint256" },
          { name: "milestoneCount", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getMilestones",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "description", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "released", type: "bool" },
          { name: "disputed", type: "bool" },
          { name: "buyerApproved", type: "bool" },
          { name: "sellerDelivered", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "getMilestone",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "escrowId", type: "uint256" },
      { name: "milestoneIndex", type: "uint256" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "description", type: "string" },
          { name: "amount", type: "uint256" },
          { name: "released", type: "bool" },
          { name: "disputed", type: "bool" },
          { name: "buyerApproved", type: "bool" },
          { name: "sellerDelivered", type: "bool" },
        ],
      },
    ],
  },
  {
    name: "calculateProtocolFee",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getUnreleasedAmount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "nextEscrowId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "feeConfig",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "feeBasisPoints", type: "uint256" },
      { name: "maxFeeAbsolute", type: "uint256" },
      { name: "feeRecipient", type: "address" },
    ],
  },
  {
    name: "blacklistedTokens",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "featuredTokens",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "EscrowCreated",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "token", type: "address", indexed: false },
      { name: "totalAmount", type: "uint256", indexed: false },
      { name: "mode", type: "uint8", indexed: false },
    ],
  },
  {
    name: "EscrowFunded",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "actualAmount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "EscrowActivated",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
    ],
  },
  {
    name: "MilestoneDelivered",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "milestoneIndex", type: "uint256", indexed: false },
    ],
  },
  {
    name: "MilestoneApproved",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "milestoneIndex", type: "uint256", indexed: false },
    ],
  },
  {
    name: "FundsReleased",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "milestoneIndex", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "DisputeInitiated",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "milestoneIndex", type: "uint256", indexed: false },
      { name: "initiator", type: "address", indexed: false },
    ],
  },
  {
    name: "DisputeResolved",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "milestoneIndex", type: "uint256", indexed: false },
      { name: "buyerShare", type: "uint256", indexed: false },
      { name: "sellerShare", type: "uint256", indexed: false },
    ],
  },
  {
    name: "EscrowRefunded",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    name: "EscrowCompleted",
    type: "event",
    inputs: [
      { name: "escrowId", type: "uint256", indexed: true },
    ],
  },
] as const;
