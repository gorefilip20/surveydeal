const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SurveydealEscrow", function () {
  async function fixture() {
    const [admin, buyer, seller, other] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("TestERC20");
    const token = await Token.deploy("Test USD", "TUSD", 18);
    await token.waitForDeployment();

    const Escrow = await ethers.getContractFactory("SurveydealEscrow");
    const escrow = await Escrow.deploy(admin.address, admin.address, 100, 0);
    await escrow.waitForDeployment();

    const amount = ethers.parseUnits("100", 18);
    await token.mint(buyer.address, amount);
    await token.connect(buyer).approve(await escrow.getAddress(), amount);

    const tx = await escrow.connect(buyer).createEscrow(
      seller.address,
      await token.getAddress(),
      amount,
      0,
      ethers.ZeroAddress,
      ethers.ZeroHash,
      0,
      ["Deliver work"],
      [amount]
    );
    await tx.wait();
    return { admin, buyer, seller, other, token, escrow, amount };
  }

  it("funds, activates, and releases a milestone with the configured fee", async function () {
    const { buyer, seller, token, escrow, amount } = await fixture();
    await escrow.connect(buyer).fundEscrow(0);
    await escrow.connect(seller).activateEscrow(0);
    await escrow.connect(seller).deliverMilestone(0, 0);
    await escrow.connect(buyer).approveMilestone(0, 0);
    await escrow.connect(buyer).releaseMilestone(0, 0);

    expect(await escrow.nextEscrowId()).to.equal(1);
    expect(await token.balanceOf(seller.address)).to.equal(ethers.parseUnits("99", 18));
    expect(await escrow.getEscrow(0).then((e) => e.state)).to.equal(3);
  });

  it("does not allow one counterparty to unilaterally resolve a dispute", async function () {
    const { buyer, seller, token, escrow, amount } = await fixture();
    await escrow.connect(buyer).fundEscrow(0);
    await escrow.connect(seller).activateEscrow(0);
    await escrow.connect(buyer).initiateDispute(0, 0);

    await expect(escrow.connect(buyer).resolveDisputeByConsensus(0, 0, 5000))
      .to.emit(escrow, "DisputeResolutionProposed");
    await expect(escrow.connect(buyer).resolveDisputeByConsensus(0, 0, 5000))
      .to.be.revertedWithCustomError(escrow, "ResolutionAlreadyProposed");
    await expect(escrow.connect(seller).resolveDisputeByConsensus(0, 0, 6000))
      .to.be.revertedWithCustomError(escrow, "ResolutionMustMatch");

    await escrow.connect(seller).resolveDisputeByConsensus(0, 0, 5000);
    expect(await token.balanceOf(buyer.address)).to.equal(ethers.parseUnits("49.5", 18));
    expect(await token.balanceOf(seller.address)).to.equal(ethers.parseUnits("49.5", 18));
  });

  it("does not allow a non-counterparty to propose consensus", async function () {
    const { other, escrow } = await fixture();
    await expect(escrow.connect(other).resolveDisputeByConsensus(0, 0, 0))
      .to.be.revertedWithCustomError(escrow, "InvalidState");
  });
});
