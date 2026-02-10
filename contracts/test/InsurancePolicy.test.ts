import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { InsurancePolicy } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// Minimal ERC-20 mock for stablecoin
const ERC20_MOCK_ABI = `
  // SPDX-License-Identifier: MIT
  pragma solidity ^0.8.24;
  import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
  contract MockStablecoin is ERC20 {
      constructor() ERC20("Mock USDC", "mUSDC") {}
      function mint(address to, uint256 amount) external { _mint(to, amount); }
  }
`;

describe("InsurancePolicy", function () {
  // ─── Fixture ───────────────────────────────────────────────
  async function deployInsurancePolicyFixture() {
    const [admin, claimsProcessor, holder1, holder2, stranger] =
      await ethers.getSigners();

    // Deploy mock stablecoin
    const MockStablecoinFactory = await ethers.getContractFactory("MockStablecoin");
    const stablecoin = await MockStablecoinFactory.deploy();
    await stablecoin.waitForDeployment();

    // Deploy InsurancePolicy
    const InsurancePolicyFactory = await ethers.getContractFactory("InsurancePolicy");
    const insurance = await InsurancePolicyFactory.deploy(
      admin.address,
      await stablecoin.getAddress(),
      ethers.ZeroAddress // no World ID
    );
    await insurance.waitForDeployment();

    // Grant CLAIMS_PROCESSOR_ROLE
    await insurance.connect(admin).grantRole(
      await insurance.CLAIMS_PROCESSOR_ROLE(),
      claimsProcessor.address
    );

    // Mint stablecoin to holders and approve insurance contract
    const mintAmount = ethers.parseUnits("100000", 18);
    const insuranceAddr = await insurance.getAddress();

    await stablecoin.mint(holder1.address, mintAmount);
    await stablecoin.mint(holder2.address, mintAmount);
    await stablecoin.mint(insuranceAddr, mintAmount); // fund contract for payouts

    await stablecoin.connect(holder1).approve(insuranceAddr, ethers.MaxUint256);
    await stablecoin.connect(holder2).approve(insuranceAddr, ethers.MaxUint256);

    const ADMIN_ROLE = await insurance.ADMIN_ROLE();
    const CLAIMS_PROCESSOR_ROLE = await insurance.CLAIMS_PROCESSOR_ROLE();

    const coverageAmount = ethers.parseUnits("10000", 18);
    const premiumAmount = ethers.parseUnits("100", 18);
    const durationDays = 365n;
    const riskScore = 5000n; // 50%

    return {
      insurance,
      stablecoin,
      admin,
      claimsProcessor,
      holder1,
      holder2,
      stranger,
      ADMIN_ROLE,
      CLAIMS_PROCESSOR_ROLE,
      coverageAmount,
      premiumAmount,
      durationDays,
      riskScore,
    };
  }

  // Helper: deploy + create one policy for holder1
  async function fixtureWithPolicy() {
    const fixture = await loadFixture(deployInsurancePolicyFixture);
    const { insurance, admin, holder1, coverageAmount, premiumAmount, durationDays, riskScore } = fixture;

    await insurance
      .connect(admin)
      .createPolicy(holder1.address, coverageAmount, premiumAmount, durationDays, riskScore);

    return { ...fixture, policyId: 0n };
  }

  // ─── Deployment ────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set admin roles", async function () {
      const { insurance, admin, ADMIN_ROLE } = await loadFixture(deployInsurancePolicyFixture);
      expect(await insurance.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should set stablecoin reference", async function () {
      const { insurance, stablecoin } = await loadFixture(deployInsurancePolicyFixture);
      expect(await insurance.stablecoin()).to.equal(await stablecoin.getAddress());
    });

    it("should have correct ERC-721 name and symbol", async function () {
      const { insurance } = await loadFixture(deployInsurancePolicyFixture);
      expect(await insurance.name()).to.equal("mediCaRE Insurance Policy");
      expect(await insurance.symbol()).to.equal("mINS");
    });

    it("should revert if admin is zero address", async function () {
      const MockStablecoinFactory = await ethers.getContractFactory("MockStablecoin");
      const sc = await MockStablecoinFactory.deploy();
      const Factory = await ethers.getContractFactory("InsurancePolicy");
      await expect(
        Factory.deploy(ethers.ZeroAddress, await sc.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Factory, "InvalidAddress");
    });

    it("should revert if stablecoin is zero address", async function () {
      const [admin] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("InsurancePolicy");
      await expect(
        Factory.deploy(admin.address, ethers.ZeroAddress, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(Factory, "InvalidAddress");
    });

    it("should start with zero policies and claims", async function () {
      const { insurance } = await loadFixture(deployInsurancePolicyFixture);
      expect(await insurance.totalPolicies()).to.equal(0n);
      expect(await insurance.totalClaims()).to.equal(0n);
    });
  });

  // ─── Policy Creation ──────────────────────────────────────
  describe("createPolicy", function () {
    it("admin can create a policy and mint NFT", async function () {
      const { insurance, admin, holder1, coverageAmount, premiumAmount, durationDays, riskScore } =
        await loadFixture(deployInsurancePolicyFixture);

      await expect(
        insurance.connect(admin).createPolicy(holder1.address, coverageAmount, premiumAmount, durationDays, riskScore)
      ).to.emit(insurance, "PolicyCreated");

      expect(await insurance.totalPolicies()).to.equal(1n);
      // NFT should be owned by holder
      expect(await insurance.ownerOf(0n)).to.equal(holder1.address);
    });

    it("collects premium from holder on creation", async function () {
      const { insurance, stablecoin, admin, holder1, coverageAmount, premiumAmount, durationDays, riskScore } =
        await loadFixture(deployInsurancePolicyFixture);

      const balBefore = await stablecoin.balanceOf(holder1.address);
      await insurance.connect(admin).createPolicy(holder1.address, coverageAmount, premiumAmount, durationDays, riskScore);
      const balAfter = await stablecoin.balanceOf(holder1.address);

      expect(balBefore - balAfter).to.equal(premiumAmount);
    });

    it("reverts if caller is not admin", async function () {
      const { insurance, stranger, holder1, coverageAmount, premiumAmount, durationDays, riskScore } =
        await loadFixture(deployInsurancePolicyFixture);

      await expect(
        insurance.connect(stranger).createPolicy(holder1.address, coverageAmount, premiumAmount, durationDays, riskScore)
      ).to.be.reverted;
    });

    it("reverts for zero holder address", async function () {
      const { insurance, admin, coverageAmount, premiumAmount, durationDays, riskScore } =
        await loadFixture(deployInsurancePolicyFixture);

      await expect(
        insurance.connect(admin).createPolicy(ethers.ZeroAddress, coverageAmount, premiumAmount, durationDays, riskScore)
      ).to.be.revertedWithCustomError(insurance, "InvalidAddress");
    });

    it("reverts for zero coverage", async function () {
      const { insurance, admin, holder1, premiumAmount, durationDays, riskScore } =
        await loadFixture(deployInsurancePolicyFixture);

      await expect(
        insurance.connect(admin).createPolicy(holder1.address, 0n, premiumAmount, durationDays, riskScore)
      ).to.be.revertedWithCustomError(insurance, "InvalidAmount");
    });

    it("reverts for zero premium", async function () {
      const { insurance, admin, holder1, coverageAmount, durationDays, riskScore } =
        await loadFixture(deployInsurancePolicyFixture);

      await expect(
        insurance.connect(admin).createPolicy(holder1.address, coverageAmount, 0n, durationDays, riskScore)
      ).to.be.revertedWithCustomError(insurance, "InvalidAmount");
    });

    it("reverts for risk score above 10000", async function () {
      const { insurance, admin, holder1, coverageAmount, premiumAmount, durationDays } =
        await loadFixture(deployInsurancePolicyFixture);

      await expect(
        insurance.connect(admin).createPolicy(holder1.address, coverageAmount, premiumAmount, durationDays, 10001n)
      ).to.be.revertedWithCustomError(insurance, "InvalidRiskScore");
    });

    it("stores policy data correctly", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, holder1, coverageAmount, premiumAmount, riskScore, policyId } = fixture;

      const policy = await insurance.getPolicy(policyId);
      expect(policy.holder).to.equal(holder1.address);
      expect(policy.coverageAmount).to.equal(coverageAmount);
      expect(policy.premiumAmount).to.equal(premiumAmount);
      expect(policy.isActive).to.be.true;
      expect(policy.riskScore).to.equal(riskScore);
    });
  });

  // ─── Policy Renewal ───────────────────────────────────────
  describe("renewPolicy", function () {
    it("holder can renew their policy", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, holder1, policyId } = fixture;

      await expect(insurance.connect(holder1).renewPolicy(policyId, 30n))
        .to.emit(insurance, "PolicyRenewed");
    });

    it("non-holder cannot renew", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, stranger, policyId } = fixture;

      await expect(
        insurance.connect(stranger).renewPolicy(policyId, 30n)
      ).to.be.revertedWithCustomError(insurance, "NotPolicyholder");
    });

    it("reverts for non-existent policy", async function () {
      const { insurance, holder1 } = await loadFixture(deployInsurancePolicyFixture);
      await expect(
        insurance.connect(holder1).renewPolicy(999n, 30n)
      ).to.be.revertedWithCustomError(insurance, "PolicyNotFound");
    });
  });

  // ─── Policy Deactivation ──────────────────────────────────
  describe("deactivatePolicy", function () {
    it("admin can deactivate a policy", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, admin, policyId } = fixture;

      await expect(insurance.connect(admin).deactivatePolicy(policyId))
        .to.emit(insurance, "PolicyDeactivated");

      const policy = await insurance.getPolicy(policyId);
      expect(policy.isActive).to.be.false;
    });

    it("non-admin cannot deactivate", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, stranger, policyId } = fixture;

      await expect(
        insurance.connect(stranger).deactivatePolicy(policyId)
      ).to.be.reverted;
    });

    it("reverts for non-existent policy", async function () {
      const { insurance, admin } = await loadFixture(deployInsurancePolicyFixture);
      await expect(
        insurance.connect(admin).deactivatePolicy(999n)
      ).to.be.revertedWithCustomError(insurance, "PolicyNotFound");
    });
  });

  // ─── Premium Adjustment ───────────────────────────────────
  describe("adjustPremium", function () {
    it("admin can adjust premium and risk score", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, admin, policyId, premiumAmount } = fixture;

      const newPremium = ethers.parseUnits("150", 18);
      const newRisk = 7500n;

      await expect(insurance.connect(admin).adjustPremium(policyId, newPremium, newRisk))
        .to.emit(insurance, "PremiumAdjusted")
        .withArgs(policyId, premiumAmount, newPremium, newRisk);

      const policy = await insurance.getPolicy(policyId);
      expect(policy.premiumAmount).to.equal(newPremium);
      expect(policy.riskScore).to.equal(newRisk);
    });

    it("reverts for zero premium", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, admin, policyId } = fixture;

      await expect(
        insurance.connect(admin).adjustPremium(policyId, 0n, 5000n)
      ).to.be.revertedWithCustomError(insurance, "InvalidAmount");
    });

    it("reverts for invalid risk score", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, admin, policyId, premiumAmount } = fixture;

      await expect(
        insurance.connect(admin).adjustPremium(policyId, premiumAmount, 10001n)
      ).to.be.revertedWithCustomError(insurance, "InvalidRiskScore");
    });

    it("non-admin cannot adjust", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, stranger, policyId, premiumAmount } = fixture;

      await expect(
        insurance.connect(stranger).adjustPremium(policyId, premiumAmount, 5000n)
      ).to.be.reverted;
    });
  });

  // ─── Claims Lifecycle ─────────────────────────────────────
  describe("Claims Lifecycle", function () {
    async function fixtureWithClaim() {
      const fixture = await fixtureWithPolicy();
      const { insurance, holder1, policyId, coverageAmount } = fixture;

      const claimAmount = ethers.parseUnits("500", 18);
      const descHash = ethers.keccak256(ethers.toUtf8Bytes("ClaimDescription"));

      await insurance.connect(holder1).submitClaim(policyId, claimAmount, descHash);

      return { ...fixture, claimId: 0n, claimAmount, descHash };
    }

    describe("submitClaim", function () {
      it("holder can submit a claim", async function () {
        const fixture = await fixtureWithPolicy();
        const { insurance, holder1, policyId } = fixture;
        const claimAmount = ethers.parseUnits("500", 18);
        const descHash = ethers.keccak256(ethers.toUtf8Bytes("Desc"));

        await expect(insurance.connect(holder1).submitClaim(policyId, claimAmount, descHash))
          .to.emit(insurance, "ClaimSubmitted")
          .withArgs(0n, policyId, holder1.address, claimAmount, descHash);

        expect(await insurance.totalClaims()).to.equal(1n);
      });

      it("non-holder cannot submit a claim", async function () {
        const fixture = await fixtureWithPolicy();
        const { insurance, stranger, policyId } = fixture;

        await expect(
          insurance.connect(stranger).submitClaim(policyId, 100n, ethers.ZeroHash)
        ).to.be.revertedWithCustomError(insurance, "NotPolicyholder");
      });

      it("reverts if policy is inactive", async function () {
        const fixture = await fixtureWithPolicy();
        const { insurance, admin, holder1, policyId } = fixture;

        await insurance.connect(admin).deactivatePolicy(policyId);
        await expect(
          insurance.connect(holder1).submitClaim(policyId, 100n, ethers.ZeroHash)
        ).to.be.revertedWithCustomError(insurance, "PolicyNotActive");
      });

      it("reverts if policy is expired", async function () {
        const fixture = await fixtureWithPolicy();
        const { insurance, holder1, policyId } = fixture;

        // Fast forward past expiry
        await time.increase(366 * 24 * 60 * 60);

        await expect(
          insurance.connect(holder1).submitClaim(policyId, 100n, ethers.ZeroHash)
        ).to.be.revertedWithCustomError(insurance, "PolicyExpired");
      });

      it("reverts if amount exceeds coverage", async function () {
        const fixture = await fixtureWithPolicy();
        const { insurance, holder1, policyId, coverageAmount } = fixture;

        await expect(
          insurance.connect(holder1).submitClaim(policyId, coverageAmount + 1n, ethers.ZeroHash)
        ).to.be.revertedWithCustomError(insurance, "ClaimExceedsCoverage");
      });

      it("reverts if amount is zero", async function () {
        const fixture = await fixtureWithPolicy();
        const { insurance, holder1, policyId } = fixture;

        await expect(
          insurance.connect(holder1).submitClaim(policyId, 0n, ethers.ZeroHash)
        ).to.be.revertedWithCustomError(insurance, "InvalidAmount");
      });
    });

    describe("processClaim", function () {
      it("claims processor can approve a claim", async function () {
        const { insurance, claimsProcessor, claimId } = await fixtureWithClaim();

        await expect(insurance.connect(claimsProcessor).processClaim(claimId, true))
          .to.emit(insurance, "ClaimProcessed")
          .withArgs(claimId, 1n, claimsProcessor.address); // 1 = Approved

        const claim = await insurance.getClaim(claimId);
        expect(claim.status).to.equal(1n); // Approved
      });

      it("claims processor can reject a claim", async function () {
        const { insurance, claimsProcessor, claimId } = await fixtureWithClaim();

        await expect(insurance.connect(claimsProcessor).processClaim(claimId, false))
          .to.emit(insurance, "ClaimProcessed")
          .withArgs(claimId, 2n, claimsProcessor.address); // 2 = Rejected
      });

      it("non-processor cannot process a claim", async function () {
        const { insurance, stranger, claimId } = await fixtureWithClaim();
        await expect(
          insurance.connect(stranger).processClaim(claimId, true)
        ).to.be.reverted;
      });

      it("reverts for non-existent claim", async function () {
        const { insurance, claimsProcessor } = await loadFixture(deployInsurancePolicyFixture);
        await expect(
          insurance.connect(claimsProcessor).processClaim(999n, true)
        ).to.be.revertedWithCustomError(insurance, "ClaimNotFound");
      });

      it("reverts if claim is not pending", async function () {
        const { insurance, claimsProcessor, claimId } = await fixtureWithClaim();
        // Approve first
        await insurance.connect(claimsProcessor).processClaim(claimId, true);
        // Try processing again
        await expect(
          insurance.connect(claimsProcessor).processClaim(claimId, true)
        ).to.be.revertedWithCustomError(insurance, "InvalidClaimStatus");
      });
    });

    describe("payoutClaim", function () {
      it("pays out an approved claim", async function () {
        const { insurance, stablecoin, claimsProcessor, holder1, claimId, claimAmount } =
          await fixtureWithClaim();

        await insurance.connect(claimsProcessor).processClaim(claimId, true);

        const balBefore = await stablecoin.balanceOf(holder1.address);
        await expect(insurance.connect(claimsProcessor).payoutClaim(claimId))
          .to.emit(insurance, "ClaimPaid");

        const balAfter = await stablecoin.balanceOf(holder1.address);
        expect(balAfter - balBefore).to.equal(claimAmount);

        const claim = await insurance.getClaim(claimId);
        expect(claim.status).to.equal(3n); // Paid
      });

      it("reverts if claim is not approved", async function () {
        const { insurance, claimsProcessor, claimId } = await fixtureWithClaim();
        // Claim is still pending
        await expect(
          insurance.connect(claimsProcessor).payoutClaim(claimId)
        ).to.be.revertedWithCustomError(insurance, "InvalidClaimStatus");
      });

      it("non-processor cannot payout", async function () {
        const { insurance, claimsProcessor, stranger, claimId } = await fixtureWithClaim();
        await insurance.connect(claimsProcessor).processClaim(claimId, true);
        await expect(
          insurance.connect(stranger).payoutClaim(claimId)
        ).to.be.reverted;
      });
    });
  });

  // ─── Withdraw Funds ───────────────────────────────────────
  describe("withdrawFunds", function () {
    it("admin can withdraw funds", async function () {
      const { insurance, stablecoin, admin, stranger } = await loadFixture(deployInsurancePolicyFixture);
      const contractBal = await stablecoin.balanceOf(await insurance.getAddress());
      if (contractBal > 0n) {
        await expect(
          insurance.connect(admin).withdrawFunds(stranger.address, contractBal)
        ).to.not.be.reverted;
      }
    });

    it("non-admin cannot withdraw", async function () {
      const { insurance, stranger } = await loadFixture(deployInsurancePolicyFixture);
      await expect(
        insurance.connect(stranger).withdrawFunds(stranger.address, 1n)
      ).to.be.reverted;
    });

    it("reverts for zero address recipient", async function () {
      const { insurance, admin } = await loadFixture(deployInsurancePolicyFixture);
      await expect(
        insurance.connect(admin).withdrawFunds(ethers.ZeroAddress, 1n)
      ).to.be.revertedWithCustomError(insurance, "InvalidAddress");
    });
  });

  // ─── View Functions ───────────────────────────────────────
  describe("View Functions", function () {
    it("getHolderPolicies returns correct IDs", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, holder1 } = fixture;
      const ids = await insurance.getHolderPolicies(holder1.address);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(0n);
    });

    it("getPolicyClaims returns claim IDs", async function () {
      const fixture = await fixtureWithPolicy();
      const { insurance, holder1, policyId } = fixture;

      const descHash = ethers.keccak256(ethers.toUtf8Bytes("Test"));
      await insurance.connect(holder1).submitClaim(policyId, 100n, descHash);

      const claimIds = await insurance.getPolicyClaims(policyId);
      expect(claimIds.length).to.equal(1);
    });

    it("getPolicy reverts for non-existent", async function () {
      const { insurance } = await loadFixture(deployInsurancePolicyFixture);
      await expect(insurance.getPolicy(999n)).to.be.revertedWithCustomError(insurance, "PolicyNotFound");
    });

    it("getClaim reverts for non-existent", async function () {
      const { insurance } = await loadFixture(deployInsurancePolicyFixture);
      await expect(insurance.getClaim(999n)).to.be.revertedWithCustomError(insurance, "ClaimNotFound");
    });
  });

  // ─── ERC-165 ──────────────────────────────────────────────
  describe("supportsInterface", function () {
    it("supports ERC-721 interface", async function () {
      const { insurance } = await loadFixture(deployInsurancePolicyFixture);
      // ERC-721 interface ID: 0x80ac58cd
      expect(await insurance.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("supports AccessControl interface", async function () {
      const { insurance } = await loadFixture(deployInsurancePolicyFixture);
      // IAccessControl interface ID: 0x7965db0b
      expect(await insurance.supportsInterface("0x7965db0b")).to.be.true;
    });
  });
});
