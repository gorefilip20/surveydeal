import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  coinbaseWallet,
  krakenWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { hardhat, mainnet, arbitrum, base, bsc, polygon, optimism, avalanche, fantom } from "wagmi/chains";

const localHardhat = {
  ...hardhat,
  name: "Surveydeal Local",
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8545"] },
  },
};

export const CHAIN_CONFIG: Record<number, { name: string; explorerUrl: string; icon: string }> = {
  [localHardhat.id]: { name: "Local Hardhat", explorerUrl: "", icon: "⟠" },
  [mainnet.id]: { name: "Ethereum", explorerUrl: "https://etherscan.io", icon: "⟠" },
  [bsc.id]: { name: "BNB Chain", explorerUrl: "https://bscscan.com", icon: "◆" },
  [arbitrum.id]: { name: "Arbitrum", explorerUrl: "https://arbiscan.io", icon: "🔵" },
  [base.id]: { name: "Base", explorerUrl: "https://basescan.org", icon: "🔷" },
  [polygon.id]: { name: "Polygon", explorerUrl: "https://polygonscan.com", icon: "🟣" },
  [optimism.id]: { name: "Optimism", explorerUrl: "https://optimistic.etherscan.io", icon: "🔴" },
  [avalanche.id]: { name: "Avalanche", explorerUrl: "https://snowtrace.io", icon: "🔺" },
  [fantom.id]: { name: "Fantom", explorerUrl: "https://ftmscan.com", icon: "👻" },
};

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_ID || "04b9e6e5c9184e0ab1ef6c1b6d4ecb29";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
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

const chains = [localHardhat, mainnet, bsc, arbitrum, base, polygon, optimism, avalanche, fantom] as const;

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
    [avalanche.id]: http(),
    [fantom.id]: http(),
  },
  ssr: true,
});
