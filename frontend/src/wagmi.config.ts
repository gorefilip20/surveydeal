import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  phantomWallet,
  krakenWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { hardhat, mainnet, arbitrum, base, bsc, polygon, optimism } from "wagmi/chains";

const localHardhat = {
  ...hardhat,
  name: "Surveydeal Local",
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
};

export const CHAIN_CONFIG: Record<number, { name: string; contractAddress: string; explorerUrl: string; icon: string }> = {
  [localHardhat.id]: { name: "Local Hardhat", contractAddress: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0", explorerUrl: "", icon: "⟠" },
  [mainnet.id]: { name: "Ethereum", contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ETH || "", explorerUrl: "https://etherscan.io", icon: "⟠" },
  [bsc.id]: { name: "BNB Chain", contractAddress: process.env.NEXT_PUBLIC_CONTRACT_BSC || "", explorerUrl: "https://bscscan.com", icon: "◆" },
  [arbitrum.id]: { name: "Arbitrum", contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ARB || "", explorerUrl: "https://arbiscan.io", icon: "🔵" },
  [base.id]: { name: "Base", contractAddress: process.env.NEXT_PUBLIC_CONTRACT_BASE || "", explorerUrl: "https://basescan.org", icon: "🔷" },
  [polygon.id]: { name: "Polygon", contractAddress: process.env.NEXT_PUBLIC_CONTRACT_POLYGON || "", explorerUrl: "https://polygonscan.com", icon: "🟣" },
  [optimism.id]: { name: "Optimism", contractAddress: process.env.NEXT_PUBLIC_CONTRACT_OP || "", explorerUrl: "https://optimistic.etherscan.io", icon: "🔴" },
};

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "04b9e6e5c9184e0ab1ef6c1b6d4ecb29";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        phantomWallet,
        coinbaseWallet,
        rainbowWallet,
      ],
    },
    {
      groupName: "More Wallets",
      wallets: [
        krakenWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: "Surveydeal",
    projectId,
  }
);

const chains = [localHardhat, mainnet, bsc, arbitrum, base, polygon, optimism] as const;

export const config = createConfig({
  connectors,
  chains,
  transports: {
    [localHardhat.id]: http("http://127.0.0.1:8545"),
    [mainnet.id]: http(),
    [bsc.id]: http(),
    [arbitrum.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
  },
  ssr: true,
});
