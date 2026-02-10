import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { Governance } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Governance", function () {
  // ─── Fixture ───────────────────────────────────────────────
  async function deployGovernanceFixture() {
    const [admin, executor, voter1, voter2, voter3, stranger] =
      await ethers.getSigners();

    // Deploy mock governance token (ERC-20)
    const MockTokenFactory = await ethers.getContractFactory("MockStablecoin");
    const govToken = await MockTokenFactory.deploy();
    await govToken.waitForDeployment();

    const proposalThreshold = ethers.parseUnits("100", 18);
    const quorumVotes = ethers.parseUnits("200", 18);
    const votingPeriod = 7 * 24 * 60 * 60; // 7 days in seconds
    const executionDelay = 2 * 24 * 60 * 60; // 2 days timelock

    const GovernanceFactory = await ethers.getContractFactory("Governance");
    const governance = await GovernanceFactory.deploy(
      admin.address,
      await govToken.getAddress(),
      proposalThreshold,
      quorumVotes,
      votingPeriod,
      executionDelay
    );
    await governance.waitForDeployment();

    // Grant EXECUTOR_ROLE to executor
    await governance.connect(admin).grantRole(
      await governance.EXECUTOR_ROLE(),
      executor.address
    );

    // Mint governance tokens to voters
    const voterAmount = ethers.parseUnits("1000", 18);
    await govToken.mint(voter1.address, voterAmount);
    await govToken.mint(voter2.address, voterAmount);
    await govToken.mint(voter3.address, ethers.parseUnits("50", 18)); // below threshold

    const ADMIN_ROLE = await governance.ADMIN_ROLE();
    const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();

    return {
      governance,
      govToken,
      admin,
      executor,
      voter1,
      voter2,
      voter3,
      stranger,
      ADMIN_ROLE,
      EXECUTOR_ROLE,
      proposalThreshold,
      quorumVotes,
      votingPeriod,
      executionDelay,
    };
  }

  // Helper: create a proposal
  async function fixtureWithProposal() {
    const fixture = await loadFixture(deployGovernanceFixture);
    const { governance, voter1 } = fixture;

    await governance
      .connect(voter1)
      .createProposal("Test Proposal", 0, ethers.ZeroAddress, "0x"); // PARAMETER_CHANGE, signal vote

    return { ...fixture, proposalId: 0n };
  }

  // Helper: create proposal + pass vote + end voting period
  async function fixtureWithPassedProposal() {
    const fixture = await fixtureWithProposal();
    const { governance, voter1, voter2, votingPeriod, proposalId } = fixture;

    // Both voters vote for
    await governance.connect(voter1).vote(proposalId, true);
    await governance.connect(voter2).vote(proposalId, true);

    // Fast forward past voting period
    await time.increase(votingPeriod + 1);

    return fixture;
  }

  // ─── Deployment ────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set admin roles", async function () {
      const { governance, admin, ADMIN_ROLE } = await loadFixture(deployGovernanceFixture);
      expect(await governance.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should set governance parameters", async function () {
      const { governance, proposalThreshold, quorumVotes, votingPeriod, executionDelay } =
        await loadFixture(deployGovernanceFixture);

      expect(await governance.proposalThreshold()).to.equal(proposalThreshold);
      expect(await governance.quorumVotes()).to.equal(quorumVotes);
      expect(await governance.votingPeriod()).to.equal(votingPeriod);
      expect(await governance.executionDelay()).to.equal(executionDelay);
    });

    it("should set governance token", async function () {
      const { governance, govToken } = await loadFixture(deployGovernanceFixture);
      expect(await governance.governanceToken()).to.equal(await govToken.getAddress());
    });

    it("reverts for zero admin address", async function () {
      const MockTokenFactory = await ethers.getContractFactory("MockStablecoin");
      const token = await MockTokenFactory.deploy();
      const Factory = await ethers.getContractFactory("Governance");
      await expect(
        Factory.deploy(ethers.ZeroAddress, await token.getAddress(), 100n, 200n, 86400, 86400)
      ).to.be.reverted;
    });

    it("reverts for zero token address", async function () {
      const [admin] = await ethers.getSigners();
      const Factory = await ethers.getContractFactory("Governance");
      await expect(
        Factory.deploy(admin.address, ethers.ZeroAddress, 100n, 200n, 86400, 86400)
      ).to.be.reverted;
    });

    it("reverts for zero voting period", async function () {
      const [admin] = await ethers.getSigners();
      const MockTokenFactory = await ethers.getContractFactory("MockStablecoin");
      const token = await MockTokenFactory.deploy();
      const Factory = await ethers.getContractFactory("Governance");
      await expect(
        Factory.deploy(admin.address, await token.getAddress(), 100n, 200n, 0, 86400)
      ).to.be.revertedWithCustomError(Factory, "InvalidVotingPeriod");
    });

    it("reverts for zero quorum", async function () {
      const [admin] = await ethers.getSigners();
      const MockTokenFactory = await ethers.getContractFactory("MockStablecoin");
      const token = await MockTokenFactory.deploy();
      const Factory = await ethers.getContractFactory("Governance");
      await expect(
        Factory.deploy(admin.address, await token.getAddress(), 100n, 0n, 86400, 86400)
      ).to.be.revertedWithCustomError(Factory, "InvalidQuorum");
    });

    it("starts with zero proposals", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      expect(await governance.totalProposals()).to.equal(0n);
    });
  });

  // ─── Proposal Creation ────────────────────────────────────
  describe("createProposal", function () {
    it("token holder above threshold can create a proposal", async function () {
      const { governance, voter1 } = await loadFixture(deployGovernanceFixture);

      await expect(
        governance.connect(voter1).createProposal("My Proposal", 0, ethers.ZeroAddress, "0x")
      )
        .to.emit(governance, "ProposalCreated")
        .withArgs(0n, voter1.address, "My Proposal", 0, () => true, () => true, ethers.ZeroAddress);

      expect(await governance.totalProposals()).to.equal(1n);
    });

    it("stores proposal data correctly", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.proposer).to.equal(voter1.address);
      expect(proposal.description).to.equal("Test Proposal");
      expect(proposal.forVotes).to.equal(0n);
      expect(proposal.againstVotes).to.equal(0n);
      expect(proposal.executed).to.be.false;
      expect(proposal.cancelled).to.be.false;
    });

    it("reverts if balance is below threshold", async function () {
      const { governance, voter3 } = await loadFixture(deployGovernanceFixture);

      await expect(
        governance.connect(voter3).createProposal("Low balance", 0, ethers.ZeroAddress, "0x")
      ).to.be.revertedWithCustomError(governance, "InsufficientTokenBalance");
    });

    it("reverts if balance is zero (stranger)", async function () {
      const { governance, stranger } = await loadFixture(deployGovernanceFixture);

      await expect(
        governance.connect(stranger).createProposal("No tokens", 0, ethers.ZeroAddress, "0x")
      ).to.be.revertedWithCustomError(governance, "InsufficientTokenBalance");
    });

    it("reverts for empty description", async function () {
      const { governance, voter1 } = await loadFixture(deployGovernanceFixture);

      await expect(
        governance.connect(voter1).createProposal("", 0, ethers.ZeroAddress, "0x")
      ).to.be.revertedWithCustomError(governance, "DescriptionEmpty");
    });

    it("creates proposals with different types", async function () {
      const { governance, voter1 } = await loadFixture(deployGovernanceFixture);

      // RISK_THRESHOLD = 1
      await governance.connect(voter1).createProposal("Risk update", 1, ethers.ZeroAddress, "0x");
      const p = await governance.getProposal(0n);
      expect(p.proposalType).to.equal(1n);
    });
  });

  // ─── Voting ───────────────────────────────────────────────
  describe("vote", function () {
    it("token holder can vote for", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      const weight = await fixture.govToken.balanceOf(voter1.address);

      await expect(governance.connect(voter1).vote(proposalId, true))
        .to.emit(governance, "VoteCast")
        .withArgs(proposalId, voter1.address, true, weight);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.forVotes).to.equal(weight);
    });

    it("token holder can vote against", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      await governance.connect(voter1).vote(proposalId, false);

      const proposal = await governance.getProposal(proposalId);
      const weight = await fixture.govToken.balanceOf(voter1.address);
      expect(proposal.againstVotes).to.equal(weight);
    });

    it("cannot vote twice", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      await governance.connect(voter1).vote(proposalId, true);

      await expect(
        governance.connect(voter1).vote(proposalId, false)
      ).to.be.revertedWithCustomError(governance, "AlreadyVoted");
    });

    it("cannot vote with zero balance", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, stranger, proposalId } = fixture;

      await expect(
        governance.connect(stranger).vote(proposalId, true)
      ).to.be.revertedWithCustomError(governance, "ZeroWeight");
    });

    it("cannot vote on non-existent proposal", async function () {
      const { governance, voter1 } = await loadFixture(deployGovernanceFixture);

      await expect(
        governance.connect(voter1).vote(999n, true)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });

    it("cannot vote after voting period ends", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, votingPeriod, proposalId } = fixture;

      await time.increase(votingPeriod + 1);

      await expect(
        governance.connect(voter1).vote(proposalId, true)
      ).to.be.revertedWithCustomError(governance, "VotingNotActive");
    });

    it("cannot vote on a cancelled proposal", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      await governance.connect(voter1).cancelProposal(proposalId);

      await expect(
        governance.connect(voter1).vote(proposalId, true)
      ).to.be.revertedWithCustomError(governance, "ProposalAlreadyCancelled");
    });

    it("getVoteInfo returns correct data", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId, govToken } = fixture;

      await governance.connect(voter1).vote(proposalId, true);

      const [voted, weight] = await governance.getVoteInfo(proposalId, voter1.address);
      expect(voted).to.be.true;
      expect(weight).to.equal(await govToken.balanceOf(voter1.address));
    });

    it("getVoteInfo returns false for non-voter", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, stranger, proposalId } = fixture;

      const [voted, weight] = await governance.getVoteInfo(proposalId, stranger.address);
      expect(voted).to.be.false;
      expect(weight).to.equal(0n);
    });
  });

  // ─── Proposal Status ──────────────────────────────────────
  describe("getProposalStatus", function () {
    it("returns Active during voting period", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, proposalId } = fixture;

      const status = await governance.getProposalStatus(proposalId);
      expect(status).to.equal(0n); // Active
    });

    it("returns Succeeded when quorum met and for > against", async function () {
      const fixture = await fixtureWithPassedProposal();
      const { governance, proposalId } = fixture;

      const status = await governance.getProposalStatus(proposalId);
      expect(status).to.equal(1n); // Succeeded
    });

    it("returns Defeated when quorum not met", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter3, votingPeriod, proposalId } = fixture;

      // voter3 has only 50 tokens, below quorum of 200
      await governance.connect(voter3).vote(proposalId, true);
      await time.increase(votingPeriod + 1);

      const status = await governance.getProposalStatus(proposalId);
      expect(status).to.equal(2n); // Defeated
    });

    it("returns Defeated when against >= for", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, voter2, votingPeriod, proposalId } = fixture;

      await governance.connect(voter1).vote(proposalId, true);
      await governance.connect(voter2).vote(proposalId, false);
      await time.increase(votingPeriod + 1);

      // Both have same balance, so forVotes == againstVotes → Defeated (needs >)
      const status = await governance.getProposalStatus(proposalId);
      expect(status).to.equal(2n); // Defeated
    });

    it("returns Cancelled for cancelled proposals", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      await governance.connect(voter1).cancelProposal(proposalId);

      const status = await governance.getProposalStatus(proposalId);
      expect(status).to.equal(4n); // Cancelled
    });

    it("reverts for non-existent proposal", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      await expect(
        governance.getProposalStatus(999n)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });
  });

  // ─── Proposal Execution ──────────────────────────────────
  describe("executeProposal", function () {
    it("executor can execute a passed proposal after timelock", async function () {
      const fixture = await fixtureWithPassedProposal();
      const { governance, executor, executionDelay, proposalId } = fixture;

      // Fast forward past timelock
      await time.increase(executionDelay + 1);

      await expect(governance.connect(executor).executeProposal(proposalId))
        .to.emit(governance, "ProposalExecuted")
        .withArgs(proposalId, executor.address);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.executed).to.be.true;
    });

    it("reverts if timelock not expired", async function () {
      const fixture = await fixtureWithPassedProposal();
      const { governance, executor, proposalId } = fixture;

      // Voting period already passed, but timelock hasn't
      await expect(
        governance.connect(executor).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "TimelockNotExpired");
    });

    it("reverts if proposal not succeeded", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, executor, votingPeriod, executionDelay, proposalId } = fixture;

      // No votes, fast forward past everything
      await time.increase(votingPeriod + executionDelay + 2);

      await expect(
        governance.connect(executor).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "ProposalNotSucceeded");
    });

    it("reverts if already executed", async function () {
      const fixture = await fixtureWithPassedProposal();
      const { governance, executor, executionDelay, proposalId } = fixture;

      await time.increase(executionDelay + 1);
      await governance.connect(executor).executeProposal(proposalId);

      await expect(
        governance.connect(executor).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "ProposalAlreadyExecuted");
    });

    it("reverts if cancelled", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, executor, votingPeriod, executionDelay, proposalId } = fixture;

      await governance.connect(voter1).cancelProposal(proposalId);
      await time.increase(votingPeriod + executionDelay + 2);

      await expect(
        governance.connect(executor).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "ProposalAlreadyCancelled");
    });

    it("reverts if voting is still active", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, executor, voter1, voter2, proposalId } = fixture;

      await governance.connect(voter1).vote(proposalId, true);
      await governance.connect(voter2).vote(proposalId, true);

      // Don't advance time - voting still active
      await expect(
        governance.connect(executor).executeProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "VotingNotActive");
    });

    it("non-executor cannot execute", async function () {
      const fixture = await fixtureWithPassedProposal();
      const { governance, stranger, executionDelay, proposalId } = fixture;

      await time.increase(executionDelay + 1);

      await expect(
        governance.connect(stranger).executeProposal(proposalId)
      ).to.be.reverted;
    });

    it("executes on-chain call when target is set", async function () {
      const fixture = await loadFixture(deployGovernanceFixture);
      const { governance, govToken, voter1, voter2, executor, admin, votingPeriod, executionDelay } = fixture;

      // Create a proposal that calls updateParameters on the governance contract itself
      const newVotingPeriod = 14 * 24 * 60 * 60; // 14 days
      const callData = governance.interface.encodeFunctionData("updateParameters", [
        ethers.parseUnits("50", 18), // new threshold
        ethers.parseUnits("100", 18), // new quorum
        newVotingPeriod,
        executionDelay,
      ]);

      // Grant ADMIN_ROLE to governance contract so it can call updateParameters on itself
      await governance.connect(admin).grantRole(
        await governance.ADMIN_ROLE(),
        await governance.getAddress()
      );

      await governance
        .connect(voter1)
        .createProposal("Update params", 0, await governance.getAddress(), callData);

      await governance.connect(voter1).vote(0n, true);
      await governance.connect(voter2).vote(0n, true);

      await time.increase(votingPeriod + executionDelay + 2);

      await governance.connect(executor).executeProposal(0n);

      // Verify the parameters were updated
      expect(await governance.votingPeriod()).to.equal(newVotingPeriod);
    });
  });

  // ─── Cancel Proposal ──────────────────────────────────────
  describe("cancelProposal", function () {
    it("proposer can cancel their proposal", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      await expect(governance.connect(voter1).cancelProposal(proposalId))
        .to.emit(governance, "ProposalCancelled")
        .withArgs(proposalId, voter1.address);

      const proposal = await governance.getProposal(proposalId);
      expect(proposal.cancelled).to.be.true;
    });

    it("admin can cancel any proposal", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, admin, proposalId } = fixture;

      await expect(governance.connect(admin).cancelProposal(proposalId))
        .to.emit(governance, "ProposalCancelled");
    });

    it("stranger cannot cancel", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, stranger, proposalId } = fixture;

      await expect(
        governance.connect(stranger).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "NotProposerOrAdmin");
    });

    it("cannot cancel an executed proposal", async function () {
      const fixture = await fixtureWithPassedProposal();
      const { governance, executor, voter1, executionDelay, proposalId } = fixture;

      await time.increase(executionDelay + 1);
      await governance.connect(executor).executeProposal(proposalId);

      await expect(
        governance.connect(voter1).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "ProposalAlreadyExecuted");
    });

    it("cannot cancel a cancelled proposal", async function () {
      const fixture = await fixtureWithProposal();
      const { governance, voter1, proposalId } = fixture;

      await governance.connect(voter1).cancelProposal(proposalId);

      await expect(
        governance.connect(voter1).cancelProposal(proposalId)
      ).to.be.revertedWithCustomError(governance, "ProposalAlreadyCancelled");
    });

    it("reverts for non-existent proposal", async function () {
      const { governance, admin } = await loadFixture(deployGovernanceFixture);
      await expect(
        governance.connect(admin).cancelProposal(999n)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });
  });

  // ─── Update Parameters ────────────────────────────────────
  describe("updateParameters", function () {
    it("admin can update governance parameters", async function () {
      const { governance, admin } = await loadFixture(deployGovernanceFixture);

      const newThreshold = ethers.parseUnits("50", 18);
      const newQuorum = ethers.parseUnits("100", 18);
      const newVotingPeriod = 14 * 24 * 60 * 60;
      const newDelay = 3 * 24 * 60 * 60;

      await expect(
        governance.connect(admin).updateParameters(newThreshold, newQuorum, newVotingPeriod, newDelay)
      )
        .to.emit(governance, "GovernanceParametersUpdated")
        .withArgs(newThreshold, newQuorum, newVotingPeriod, newDelay);

      expect(await governance.proposalThreshold()).to.equal(newThreshold);
      expect(await governance.quorumVotes()).to.equal(newQuorum);
      expect(await governance.votingPeriod()).to.equal(newVotingPeriod);
      expect(await governance.executionDelay()).to.equal(newDelay);
    });

    it("non-admin cannot update", async function () {
      const { governance, stranger } = await loadFixture(deployGovernanceFixture);
      await expect(
        governance.connect(stranger).updateParameters(1n, 1n, 86400, 86400)
      ).to.be.reverted;
    });

    it("reverts for zero voting period", async function () {
      const { governance, admin } = await loadFixture(deployGovernanceFixture);
      await expect(
        governance.connect(admin).updateParameters(1n, 1n, 0, 86400)
      ).to.be.revertedWithCustomError(governance, "InvalidVotingPeriod");
    });

    it("reverts for zero quorum", async function () {
      const { governance, admin } = await loadFixture(deployGovernanceFixture);
      await expect(
        governance.connect(admin).updateParameters(1n, 0n, 86400, 86400)
      ).to.be.revertedWithCustomError(governance, "InvalidQuorum");
    });
  });

  // ─── View Functions ───────────────────────────────────────
  describe("View Functions", function () {
    it("getProposal reverts for non-existent", async function () {
      const { governance } = await loadFixture(deployGovernanceFixture);
      await expect(
        governance.getProposal(999n)
      ).to.be.revertedWithCustomError(governance, "ProposalNotFound");
    });
  });
});
