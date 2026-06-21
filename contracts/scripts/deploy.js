const hre = require("hardhat");

async function main() {
  console.log("──────────────────────────────────────────────");
  console.log("  SURVEYDEAL ESCROW — DEPLOYMENT SCRIPT");
  console.log("──────────────────────────────────────────────\n");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await hre.ethers.provider.getBalance(deployerAddress);

  console.log("Deployer address :", deployerAddress);
  console.log("Deployer balance :", hre.ethers.formatEther(balance), "ETH");
  console.log("Network          :", hre.network.name);
  console.log("Chain ID         :", (await hre.ethers.provider.getNetwork()).chainId.toString());
  console.log("");

  // ──────────────────────────────────────────────
  //  DEPLOYMENT PARAMETERS
  // ──────────────────────────────────────────────

  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS || deployerAddress;
  const FEE_RECIPIENT = process.env.FEE_RECIPIENT || deployerAddress;
  const FEE_BASIS_POINTS = parseInt(process.env.FEE_BASIS_POINTS || "100", 10);
  const MAX_FEE_ABSOLUTE = hre.ethers.parseUnits(
    process.env.MAX_FEE_ABSOLUTE || "50",
    6
  );

  console.log("Configuration:");
  console.log("  Admin          :", ADMIN_ADDRESS);
  console.log("  Fee recipient  :", FEE_RECIPIENT);
  console.log("  Fee rate       :", FEE_BASIS_POINTS, "bps (", (FEE_BASIS_POINTS / 100).toFixed(2) + "% )");
  console.log("  Max fee cap    :", hre.ethers.formatUnits(MAX_FEE_ABSOLUTE, 6), "(token units, 6 decimals)");
  console.log("");

  // ──────────────────────────────────────────────
  //  DEPLOY CONTRACT
  // ──────────────────────────────────────────────

  console.log("Deploying SurveydealEscrow...");

  const SurveydealEscrow = await hre.ethers.getContractFactory("SurveydealEscrow");
  const escrow = await SurveydealEscrow.deploy(
    ADMIN_ADDRESS,
    FEE_RECIPIENT,
    FEE_BASIS_POINTS,
    MAX_FEE_ABSOLUTE
  );

  await escrow.waitForDeployment();
  const contractAddress = await escrow.getAddress();

  console.log("SurveydealEscrow deployed to:", contractAddress);
  console.log("");

  // ──────────────────────────────────────────────
  //  VERIFY ROLES
  // ──────────────────────────────────────────────

  console.log("Verifying role assignments...");

  const DEFAULT_ADMIN_ROLE = await escrow.DEFAULT_ADMIN_ROLE();
  const ARBITER_ROLE = await escrow.ARBITER_ROLE();
  const FEE_MANAGER_ROLE = await escrow.FEE_MANAGER_ROLE();

  const hasAdmin = await escrow.hasRole(DEFAULT_ADMIN_ROLE, ADMIN_ADDRESS);
  const hasArbiter = await escrow.hasRole(ARBITER_ROLE, ADMIN_ADDRESS);
  const hasFeeManager = await escrow.hasRole(FEE_MANAGER_ROLE, ADMIN_ADDRESS);

  console.log("  DEFAULT_ADMIN_ROLE :", hasAdmin ? "GRANTED" : "MISSING");
  console.log("  ARBITER_ROLE       :", hasArbiter ? "GRANTED" : "MISSING");
  console.log("  FEE_MANAGER_ROLE   :", hasFeeManager ? "GRANTED" : "MISSING");

  if (!hasAdmin || !hasArbiter || !hasFeeManager) {
    console.error("\n  ERROR: Role assignment failed. Check constructor logic.");
    process.exit(1);
  }

  console.log("  All roles verified.\n");

  // ──────────────────────────────────────────────
  //  VERIFY FEE CONFIG
  // ──────────────────────────────────────────────

  console.log("Verifying fee configuration...");

  const feeConfig = await escrow.feeConfig();
  console.log("  feeBasisPoints :", feeConfig.feeBasisPoints.toString());
  console.log("  maxFeeAbsolute :", feeConfig.maxFeeAbsolute.toString());
  console.log("  feeRecipient   :", feeConfig.feeRecipient);

  const feeMatch =
    feeConfig.feeBasisPoints.toString() === String(FEE_BASIS_POINTS) &&
    feeConfig.maxFeeAbsolute.toString() === MAX_FEE_ABSOLUTE.toString() &&
    feeConfig.feeRecipient.toLowerCase() === FEE_RECIPIENT.toLowerCase();

  if (!feeMatch) {
    console.error("\n  ERROR: Fee config mismatch.");
    process.exit(1);
  }

  console.log("  Fee config verified.\n");

  // ──────────────────────────────────────────────
  //  REGISTER ADDITIONAL ARBITERS (optional)
  // ──────────────────────────────────────────────

  const additionalArbiters = (process.env.ADDITIONAL_ARBITERS || "")
    .split(",")
    .map((a) => a.trim())
    .filter((a) => a.length === 42 && a.startsWith("0x"));

  if (additionalArbiters.length > 0) {
    console.log(`Registering ${additionalArbiters.length} additional arbiter(s)...`);
    for (const arbiterAddr of additionalArbiters) {
      const tx = await escrow.addArbiter(arbiterAddr);
      await tx.wait();
      const confirmed = await escrow.hasRole(ARBITER_ROLE, arbiterAddr);
      console.log(`  ${arbiterAddr} : ${confirmed ? "GRANTED" : "FAILED"}`);
    }
    console.log("");
  }

  // ──────────────────────────────────────────────
  //  VERIFY CONTRACT ON BLOCK EXPLORER (non-local)
  // ──────────────────────────────────────────────

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("Waiting 30s for block explorer indexing...");
    await new Promise((r) => setTimeout(r, 30000));

    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [
          ADMIN_ADDRESS,
          FEE_RECIPIENT,
          FEE_BASIS_POINTS,
          MAX_FEE_ABSOLUTE,
        ],
      });
      console.log("Contract verified on block explorer.\n");
    } catch (err) {
      if (err.message.includes("Already Verified")) {
        console.log("Contract already verified.\n");
      } else {
        console.warn("Verification failed:", err.message);
        console.warn("You can verify manually later.\n");
      }
    }
  }

  // ──────────────────────────────────────────────
  //  DEPLOYMENT SUMMARY
  // ──────────────────────────────────────────────

  console.log("══════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("══════════════════════════════════════════════");
  console.log("");
  console.log("  Contract Address  :", contractAddress);
  console.log("  Network           :", hre.network.name);
  console.log("  Admin             :", ADMIN_ADDRESS);
  console.log("  Fee Recipient     :", FEE_RECIPIENT);
  console.log("  Fee Rate          :", FEE_BASIS_POINTS, "bps");
  console.log("  Max Fee Cap       :", MAX_FEE_ABSOLUTE.toString());
  if (additionalArbiters.length > 0) {
    console.log("  Extra Arbiters    :", additionalArbiters.join(", "));
  }
  console.log("");
  console.log("  Add to your .env files:");
  console.log(`    NEXT_PUBLIC_ESCROW_CONTRACT=${contractAddress}`);
  console.log(`    CONTRACT_ADDRESS=${contractAddress}`);
  console.log("");
  console.log("══════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nDeployment failed:", error);
    process.exit(1);
  });
