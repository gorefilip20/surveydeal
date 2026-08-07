export interface ChainInfo {
  id: string;
  name: string;
  chainId: number;
  type: "evm";
  nativeCurrency: string;
  blockExplorer: string;
}

export const SUPPORTED_CHAINS: ChainInfo[] = [
  { id: "ETHEREUM", name: "Ethereum", chainId: 1, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://etherscan.io" },
  { id: "BNB_CHAIN", name: "BNB Chain", chainId: 56, type: "evm", nativeCurrency: "BNB", blockExplorer: "https://bscscan.com" },
  { id: "POLYGON", name: "Polygon", chainId: 137, type: "evm", nativeCurrency: "MATIC", blockExplorer: "https://polygonscan.com" },
  { id: "ARBITRUM", name: "Arbitrum One", chainId: 42161, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://arbiscan.io" },
  { id: "BASE", name: "Base", chainId: 8453, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://basescan.org" },
  { id: "AVALANCHE", name: "Avalanche C-Chain", chainId: 43114, type: "evm", nativeCurrency: "AVAX", blockExplorer: "https://snowtrace.io" },
  { id: "OPTIMISM", name: "Optimism", chainId: 10, type: "evm", nativeCurrency: "ETH", blockExplorer: "https://optimistic.etherscan.io" },
  { id: "FANTOM", name: "Fantom", chainId: 250, type: "evm", nativeCurrency: "FTM", blockExplorer: "https://ftmscan.com" },
];

export const EVM_CHAIN_IDS = SUPPORTED_CHAINS.map((c) => c.chainId);

export const CHAIN_RPC_URLS: Record<number, string> = {
  1: process.env.ETH_RPC_URL || "https://eth.llamarpc.com",
  56: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
  137: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
  42161: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
  8453: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  43114: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
  10: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
  250: process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools",
};

export const NETWORK_ABBR: Record<string, string> = {
  ETHEREUM: "ETH",
  BNB_CHAIN: "BNB",
  POLYGON: "POL",
  ARBITRUM: "ARB",
  BASE: "BASE",
  AVALANCHE: "AVAX",
  OPTIMISM: "OP",
  FANTOM: "FTM",
};
