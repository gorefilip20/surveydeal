import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Surveydeal database...\n");

  // ──────────────────────────────────────────────
  //  ADMIN USER (Hardhat Account #0)
  // ──────────────────────────────────────────────
  const adminWallet = (process.env.ADMIN_WALLET || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266").toLowerCase();

  const admin = await prisma.user.upsert({
    where: { walletAddress: adminWallet },
    update: { isAdmin: true, isArbiter: true, role: "ADMIN" },
    create: {
      walletAddress: adminWallet,
      displayName: "Surveydeal Admin",
      role: "ADMIN",
      isAdmin: true,
      isArbiter: true,
    },
  });

  console.log(`  Admin user: ${admin.walletAddress} (id: ${admin.id})`);

  // ──────────────────────────────────────────────
  //  PROTOCOL CONFIG DEFAULTS
  // ──────────────────────────────────────────────
  const defaults = [
    { key: "feeBasisPoints", value: "100", description: "Protocol fee: 100 bps = 1%" },
    { key: "maxFeeAbsolute", value: "50000000", description: "Max fee cap in token base units (50 USDC)" },
    { key: "feeRecipient", value: adminWallet, description: "Wallet receiving protocol fees" },
    { key: "paused", value: "false", description: "Protocol pause state" },
  ];

  for (const d of defaults) {
    await prisma.protocolConfig.upsert({
      where: { key: d.key },
      update: {},
      create: { ...d, updatedBy: admin.id },
    });
    console.log(`  Config: ${d.key} = ${d.value}`);
  }

  // ──────────────────────────────────────────────
  //  SAMPLE TOKENS
  // ──────────────────────────────────────────────
  const tokens = [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", chainId: 1, symbol: "USDC", name: "USD Coin", decimals: 6, coingeckoId: "usd-coin" },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", chainId: 1, symbol: "USDT", name: "Tether USD", decimals: 6, coingeckoId: "tether" },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", chainId: 1, symbol: "DAI", name: "Dai Stablecoin", decimals: 18, coingeckoId: "dai" },
    { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", chainId: 1, symbol: "WETH", name: "Wrapped Ether", decimals: 18, coingeckoId: "weth" },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", chainId: 42161, symbol: "USDC", name: "USD Coin (Arbitrum)", decimals: 6, coingeckoId: "usd-coin" },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", chainId: 42161, symbol: "USDT", name: "Tether USD (Arbitrum)", decimals: 6, coingeckoId: "tether" },
  ];

  for (const t of tokens) {
    await prisma.token.upsert({
      where: { address_chainId: { address: t.address.toLowerCase(), chainId: t.chainId } },
      update: {},
      create: { ...t, address: t.address.toLowerCase(), addedBy: admin.id },
    });
    console.log(`  Token: ${t.symbol} (chain ${t.chainId})`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
