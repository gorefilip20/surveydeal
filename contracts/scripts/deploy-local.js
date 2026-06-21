const hre = require("hardhat");

async function main() {
  console.log("══════════════════════════════════════════════");
  console.log("  SURVEYDEAL — LOCAL DEPLOYMENT + TEST TOKENS");
  console.log("══════════════════════════════════════════════\n");

  const [deployer, buyer, seller, arbiter] = await hre.ethers.getSigners();
  const deployerAddr = await deployer.getAddress();
  const buyerAddr = await buyer.getAddress();
  const sellerAddr = await seller.getAddress();
  const arbiterAddr = await arbiter.getAddress();

  console.log("Accounts:");
  console.log("  Deployer (Account #0):", deployerAddr);
  console.log("  Buyer    (Account #1):", buyerAddr);
  console.log("  Seller   (Account #2):", sellerAddr);
  console.log("  Arbiter  (Account #3):", arbiterAddr);
  console.log("");

  // ─── Deploy Test ERC-20 Tokens ─────────────────────────────────────────

  console.log("Deploying test ERC-20 tokens...\n");

  const TestToken = await hre.ethers.getContractFactory("TestERC20");

  const usdc = await TestToken.deploy("USD Coin", "USDC", 6);
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("  USDC deployed to:", usdcAddr);

  const usdt = await TestToken.deploy("Tether USD", "USDT", 6);
  await usdt.waitForDeployment();
  const usdtAddr = await usdt.getAddress();
  console.log("  USDT deployed to:", usdtAddr);

  const dai = await TestToken.deploy("Dai Stablecoin", "DAI", 18);
  await dai.waitForDeployment();
  const daiAddr = await dai.getAddress();
  console.log("  DAI  deployed to:", daiAddr);

  // Mint tokens to buyer and seller
  const MILLION_USDC = hre.ethers.parseUnits("1000000", 6);
  const MILLION_USDT = hre.ethers.parseUnits("1000000", 6);
  const MILLION_DAI = hre.ethers.parseUnits("1000000", 18);

  await usdc.mint(buyerAddr, MILLION_USDC);
  await usdc.mint(sellerAddr, MILLION_USDC);
  await usdc.mint(deployerAddr, MILLION_USDC);

  await usdt.mint(buyerAddr, MILLION_USDT);
  await usdt.mint(sellerAddr, MILLION_USDT);
  await usdt.mint(deployerAddr, MILLION_USDT);

  await dai.mint(buyerAddr, MILLION_DAI);
  await dai.mint(sellerAddr, MILLION_DAI);
  await dai.mint(deployerAddr, MILLION_DAI);

  console.log("  Minted 1,000,000 of each token to buyer, seller, and deployer.\n");

  // ─── Deploy Escrow Contract ────────────────────────────────────────────

  console.log("Deploying SurveydealEscrow...");

  const FEE_BPS = 100; // 1%
  const MAX_FEE = hre.ethers.parseUnits("50", 6);

  const SurveydealEscrow = await hre.ethers.getContractFactory("SurveydealEscrow");
  const escrow = await SurveydealEscrow.deploy(
    deployerAddr,
    deployerAddr,
    FEE_BPS,
    MAX_FEE
  );
  await escrow.waitForDeployment();
  const escrowAddr = await escrow.getAddress();
  console.log("  SurveydealEscrow deployed to:", escrowAddr);

  // Grant arbiter role
  const ARBITER_ROLE = await escrow.ARBITER_ROLE();
  await escrow.grantRole(ARBITER_ROLE, arbiterAddr);
  console.log("  Arbiter role granted to:", arbiterAddr);
  console.log("");

  // ─── Create Sample Escrows ─────────────────────────────────────────────

  console.log("Creating sample escrows...\n");

  // Escrow #0: Buyer pays 500 USDC to Seller, Locked mode, 2 milestones
  const escrow0Amount = hre.ethers.parseUnits("500", 6);
  const m0_1 = hre.ethers.parseUnits("200", 6);
  const m0_2 = hre.ethers.parseUnits("300", 6);
  const deadline0 = Math.floor(Date.now() / 1000) + 86400 * 30; // 30 days

  // Buyer approves and creates escrow
  await usdc.connect(buyer).approve(escrowAddr, escrow0Amount);
  const tx0 = await escrow.connect(buyer).createEscrow(
    sellerAddr,
    usdcAddr,
    escrow0Amount,
    0, // Locked
    hre.ethers.ZeroAddress,
    hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Website redesign contract")),
    deadline0,
    ["Design mockups", "Final delivery"],
    [m0_1, m0_2]
  );
  await tx0.wait();
  console.log("  Escrow #0 created: 500 USDC, Locked mode, 2 milestones");

  // Fund escrow #0
  const tx0f = await escrow.connect(buyer).fundEscrow(0);
  await tx0f.wait();
  console.log("  Escrow #0 funded by buyer");

  // Escrow #1: Buyer pays 1000 USDT to Seller, Arbiter mode, 3 milestones
  const escrow1Amount = hre.ethers.parseUnits("1000", 6);
  const m1_1 = hre.ethers.parseUnits("300", 6);
  const m1_2 = hre.ethers.parseUnits("300", 6);
  const m1_3 = hre.ethers.parseUnits("400", 6);
  const deadline1 = Math.floor(Date.now() / 1000) + 86400 * 60; // 60 days

  await usdt.connect(buyer).approve(escrowAddr, escrow1Amount);
  const tx1 = await escrow.connect(buyer).createEscrow(
    sellerAddr,
    usdtAddr,
    escrow1Amount,
    1, // Arbiter
    arbiterAddr,
    hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Mobile app development")),
    deadline1,
    ["UI/UX Design", "Backend API", "Testing & Launch"],
    [m1_1, m1_2, m1_3]
  );
  await tx1.wait();
  console.log("  Escrow #1 created: 1000 USDT, Arbiter mode, 3 milestones");

  // Fund escrow #1
  const tx1f = await escrow.connect(buyer).fundEscrow(1);
  await tx1f.wait();
  console.log("  Escrow #1 funded by buyer");

  // Escrow #2: Small 100 DAI deal, Created but NOT funded (for testing)
  const escrow2Amount = hre.ethers.parseUnits("100", 18);
  const deadline2 = Math.floor(Date.now() / 1000) + 86400 * 14;

  await dai.connect(buyer).approve(escrowAddr, escrow2Amount);
  const tx2 = await escrow.connect(buyer).createEscrow(
    sellerAddr,
    daiAddr,
    escrow2Amount,
    0, // Locked
    hre.ethers.ZeroAddress,
    hre.ethers.keccak256(hre.ethers.toUtf8Bytes("Logo design")),
    deadline2,
    ["Logo concepts delivered"],
    [escrow2Amount]
  );
  await tx2.wait();
  console.log("  Escrow #2 created: 100 DAI, Locked mode, 1 milestone (NOT funded)");
  console.log("");

  // ─── Summary ───────────────────────────────────────────────────────────

  console.log("══════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE — LOCAL ENVIRONMENT");
  console.log("══════════════════════════════════════════════");
  console.log("");
  console.log("  Contract Addresses:");
  console.log("    SurveydealEscrow :", escrowAddr);
  console.log("    USDC (Test)      :", usdcAddr);
  console.log("    USDT (Test)      :", usdtAddr);
  console.log("    DAI  (Test)      :", daiAddr);
  console.log("");
  console.log("  Sample Escrows:");
  console.log("    #0 — 500 USDC  | Locked  | FUNDED   | 2 milestones");
  console.log("    #1 — 1000 USDT | Arbiter | FUNDED   | 3 milestones");
  console.log("    #2 — 100 DAI   | Locked  | CREATED  | 1 milestone");
  console.log("");
  console.log("  Hardhat Test Accounts (use in MetaMask):");
  console.log("  ─────────────────────────────────────────");
  console.log("  Account #0 (Deployer/Admin):");
  console.log("    Address : 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  console.log("    Key     : 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
  console.log("");
  console.log("  Account #1 (Buyer):");
  console.log("    Address : 0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
  console.log("    Key     : 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  console.log("");
  console.log("  Account #2 (Seller):");
  console.log("    Address : 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC");
  console.log("    Key     : 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
  console.log("");
  console.log("  Account #3 (Arbiter):");
  console.log("    Address : 0x90F79bf6EB2c4f870365E785982E1f101E93b906");
  console.log("    Key     : 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6");
  console.log("");
  console.log("  MetaMask Network Config:");
  console.log("    Network Name : Surveydeal Local");
  console.log("    RPC URL      : http://127.0.0.1:8545");
  console.log("    Chain ID     : 31337");
  console.log("    Currency     : ETH");
  console.log("");
  console.log("  Frontend .env.local updates needed:");
  console.log(`    NEXT_PUBLIC_ESCROW_CONTRACT=${escrowAddr}`);
  console.log("");
  console.log("══════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed:", error);
    process.exit(1);
  });
