import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...\n");

  // ─── Create Users ──────────────────────────────────────────────────────

  const deployer = await prisma.user.upsert({
    where: { walletAddress: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266" },
    update: { isAdmin: true, role: "ADMIN", displayName: "Admin (Deployer)" },
    create: {
      walletAddress: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
      displayName: "Admin (Deployer)",
      email: "admin@surveydeal.io",
      role: "ADMIN",
      isAdmin: true,
    },
  });
  console.log("  Created/updated deployer:", deployer.walletAddress);

  const buyer = await prisma.user.upsert({
    where: { walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" },
    update: { displayName: "Test Buyer" },
    create: {
      walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
      displayName: "Test Buyer",
      email: "buyer@surveydeal.io",
      role: "BUYER",
    },
  });
  console.log("  Created/updated buyer:", buyer.walletAddress);

  const seller = await prisma.user.upsert({
    where: { walletAddress: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc" },
    update: { displayName: "Test Seller" },
    create: {
      walletAddress: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
      displayName: "Test Seller",
      email: "seller@surveydeal.io",
      role: "SELLER",
    },
  });
  console.log("  Created/updated seller:", seller.walletAddress);

  const arbiter = await prisma.user.upsert({
    where: { walletAddress: "0x90f79bf6eb2c4f870365e785982e1f101e93b906" },
    update: { displayName: "Test Arbiter", isArbiter: true },
    create: {
      walletAddress: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
      displayName: "Test Arbiter",
      email: "arbiter@surveydeal.io",
      role: "ARBITER",
      isArbiter: true,
    },
  });
  console.log("  Created/updated arbiter:", arbiter.walletAddress);

  // ─── Create Tokens ─────────────────────────────────────────────────────

  const usdc = await prisma.token.upsert({
    where: { address_chainId: { address: "0x5fbdb2315678afecb367f032d93f642f64180aa3", chainId: 31337 } },
    update: { symbol: "USDC", name: "USD Coin (Test)", decimals: 6, status: "FEATURED" },
    create: {
      address: "0x5fbdb2315678afecb367f032d93f642f64180aa3",
      chainId: 31337,
      symbol: "USDC",
      name: "USD Coin (Test)",
      decimals: 6,
      status: "FEATURED",
      coingeckoId: "usd-coin",
    },
  });

  const usdt = await prisma.token.upsert({
    where: { address_chainId: { address: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512", chainId: 31337 } },
    update: { symbol: "USDT", name: "Tether USD (Test)", decimals: 6, status: "FEATURED" },
    create: {
      address: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512",
      chainId: 31337,
      symbol: "USDT",
      name: "Tether USD (Test)",
      decimals: 6,
      status: "FEATURED",
      coingeckoId: "tether",
    },
  });

  const dai = await prisma.token.upsert({
    where: { address_chainId: { address: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0", chainId: 31337 } },
    update: { symbol: "DAI", name: "Dai (Test)", decimals: 18, status: "ACTIVE" },
    create: {
      address: "0x9fe46736679d2d9a65f0992f2272de9f3c7fa6e0",
      chainId: 31337,
      symbol: "DAI",
      name: "Dai (Test)",
      decimals: 18,
      status: "ACTIVE",
      coingeckoId: "dai",
    },
  });

  console.log("  Created/updated tokens: USDC, USDT, DAI\n");

  // ─── Create Escrows (matching on-chain) ────────────────────────────────

  const escrow0 = await prisma.escrow.upsert({
    where: { onChainId: 0 },
    update: {},
    create: {
      onChainId: 0,
      chainId: 31337,
      title: "Website Redesign",
      description: "Complete redesign of corporate website including responsive layouts and dark mode support.",
      buyerId: buyer.id,
      sellerId: seller.id,
      tokenId: usdc.id,
      totalAmount: "500000000",
      fundedAmount: "500000000",
      releasedAmount: "0",
      state: "FUNDED",
      mode: "LOCKED",
      fundingMethod: "WALLET_DIRECT",
      fundedAt: new Date(),
      deadline: new Date(Date.now() + 30 * 86400000),
      milestones: {
        create: [
          { index: 0, description: "Design mockups", amount: "200000000" },
          { index: 1, description: "Final delivery", amount: "300000000" },
        ],
      },
    },
  });

  const escrow1 = await prisma.escrow.upsert({
    where: { onChainId: 1 },
    update: {},
    create: {
      onChainId: 1,
      chainId: 31337,
      title: "Mobile App Development",
      description: "Full-stack mobile app with React Native frontend and Node.js backend. Includes push notifications and in-app purchases.",
      buyerId: buyer.id,
      sellerId: seller.id,
      arbiterId: arbiter.id,
      tokenId: usdt.id,
      totalAmount: "1000000000",
      fundedAmount: "1000000000",
      releasedAmount: "0",
      state: "FUNDED",
      mode: "ARBITER",
      fundingMethod: "WALLET_DIRECT",
      fundedAt: new Date(),
      deadline: new Date(Date.now() + 60 * 86400000),
      milestones: {
        create: [
          { index: 0, description: "UI/UX Design", amount: "300000000" },
          { index: 1, description: "Backend API", amount: "300000000" },
          { index: 2, description: "Testing & Launch", amount: "400000000" },
        ],
      },
    },
  });

  const escrow2 = await prisma.escrow.upsert({
    where: { onChainId: 2 },
    update: {},
    create: {
      onChainId: 2,
      chainId: 31337,
      title: "Logo Design",
      description: "Brand logo creation with 3 concept variations and final delivery in SVG + PNG formats.",
      buyerId: buyer.id,
      sellerId: seller.id,
      tokenId: dai.id,
      totalAmount: "100000000000000000000",
      releasedAmount: "0",
      state: "CREATED",
      mode: "LOCKED",
      deadline: new Date(Date.now() + 14 * 86400000),
      milestones: {
        create: [
          { index: 0, description: "Logo concepts delivered", amount: "100000000000000000000" },
        ],
      },
    },
  });

  console.log("  Created escrows: #0 (Website), #1 (Mobile App), #2 (Logo)\n");

  // ─── Create Transactions ───────────────────────────────────────────────

  await prisma.transaction.upsert({
    where: { txHash: "seed-fund-escrow-0" },
    update: {},
    create: {
      escrowId: escrow0.id,
      txHash: "seed-fund-escrow-0",
      type: "FUND",
      fromAddress: buyer.walletAddress,
      toAddress: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
      amount: "500000000",
      chainId: 31337,
      status: "CONFIRMED",
      blockNumber: 3,
    },
  });

  await prisma.transaction.upsert({
    where: { txHash: "seed-fund-escrow-1" },
    update: {},
    create: {
      escrowId: escrow1.id,
      txHash: "seed-fund-escrow-1",
      type: "FUND",
      fromAddress: buyer.walletAddress,
      toAddress: "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
      amount: "1000000000",
      chainId: 31337,
      status: "CONFIRMED",
      blockNumber: 5,
    },
  });

  console.log("  Created transactions for funded escrows\n");

  // ─── Create Admin Audit Logs ───────────────────────────────────────────

  await prisma.adminAuditLog.createMany({
    data: [
      {
        adminId: deployer.id,
        action: "SYSTEM_INIT",
        entityType: "System",
        entityId: "system",
        details: { message: "Surveydeal platform initialized" },
      },
      {
        adminId: deployer.id,
        action: "TOKEN_ADDED",
        entityType: "Token",
        entityId: usdc.id,
        details: { symbol: "USDC", address: usdc.address, chainId: 31337 },
      },
      {
        adminId: deployer.id,
        action: "TOKEN_ADDED",
        entityType: "Token",
        entityId: usdt.id,
        details: { symbol: "USDT", address: usdt.address, chainId: 31337 },
      },
      {
        adminId: deployer.id,
        action: "TOKEN_ADDED",
        entityType: "Token",
        entityId: dai.id,
        details: { symbol: "DAI", address: dai.address, chainId: 31337 },
      },
      {
        adminId: deployer.id,
        action: "ESCROW_REVIEWED",
        entityType: "Escrow",
        entityId: escrow0.id,
        details: { title: "Website Redesign", state: "FUNDED", amount: "500 USDC" },
      },
      {
        adminId: deployer.id,
        action: "ARBITER_ASSIGNED",
        entityType: "Escrow",
        entityId: escrow1.id,
        details: { arbiter: arbiter.walletAddress, title: "Mobile App Development" },
      },
    ],
    skipDuplicates: true,
  });

  console.log("  Created admin audit logs\n");

  // ─── Create Protocol Config ────────────────────────────────────────────

  const configs = [
    { key: "protocol_fee_bps", value: "100", description: "Protocol fee in basis points (100 = 1%)" },
    { key: "max_fee_absolute", value: "50000000", description: "Maximum protocol fee cap (in token smallest unit)" },
    { key: "fee_recipient", value: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266", description: "Address receiving protocol fees" },
    { key: "min_escrow_amount", value: "1000000", description: "Minimum escrow amount (1 USDC equivalent)" },
    { key: "max_milestones", value: "20", description: "Maximum milestones per escrow" },
    { key: "admin_approval_required", value: "true", description: "Whether admin must approve before funds release" },
  ];

  for (const c of configs) {
    await prisma.protocolConfig.upsert({
      where: { key: c.key },
      update: { value: c.value, description: c.description },
      create: c,
    });
  }

  console.log("  Created protocol config entries\n");

  // ─── Summary ───────────────────────────────────────────────────────────

  const userCount = await prisma.user.count();
  const tokenCount = await prisma.token.count();
  const escrowCount = await prisma.escrow.count();
  const txCount = await prisma.transaction.count();
  const auditCount = await prisma.adminAuditLog.count();

  console.log("══════════════════════════════════════════════");
  console.log("  DATABASE SEED COMPLETE");
  console.log("══════════════════════════════════════════════");
  console.log(`  Users        : ${userCount}`);
  console.log(`  Tokens       : ${tokenCount}`);
  console.log(`  Escrows      : ${escrowCount}`);
  console.log(`  Transactions : ${txCount}`);
  console.log(`  Audit Logs   : ${auditCount}`);
  console.log("══════════════════════════════════════════════");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error("Seed failed:", e);
    prisma.$disconnect();
    process.exit(1);
  });
