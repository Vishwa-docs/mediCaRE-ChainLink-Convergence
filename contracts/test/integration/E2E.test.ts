import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * End-to-end integration test covering the full mediCaRE lifecycle:
 *
 *   1. Deploy all contracts (EHR, Insurance, SupplyChain, Credentials, Governance)
 *   2. Create a patient health record
 *   3. Create an insurance policy
 *   4. Submit & process a claim, then pay it out
 *   5. Create a pharmaceutical supply-chain batch
 *   6. Issue a provider credential
 *   7. Create a governance proposal, vote, & execute
 *
 * This test intentionally uses the concrete contracts (not interfaces) and
 * a local Hardhat network — it validates the contracts compose correctly.
 */
describe("E2E Integration", function () {
  // Increase timeout for the full lifecycle test.
  this.timeout(120_000);

  it("should complete the full mediCaRE lifecycle", async function () {
    // ───────────────────────────────────────────────
    //  0. Accounts
    // ───────────────────────────────────────────────
    const [
      admin,
      provider,
      patient,
      claimsProcessor,
      manufacturer,
      distributor,
      pharmacy,
      issuer,
      voter1,
      voter2,
    ] = await ethers.getSigners();

    // ───────────────────────────────────────────────
    //  1. Deploy contracts
    // ───────────────────────────────────────────────

    // 1a – Mock stablecoin (used by Insurance + Governance)
    const MockStablecoinFactory = await ethers.getContractFactory("MockStablecoin");
    const stablecoin = await MockStablecoinFactory.deploy();
    await stablecoin.waitForDeployment();
    const stablecoinAddr = await stablecoin.getAddress();

    // 1b – EHRStorage
    const EHRFactory = await ethers.getContractFactory("EHRStorage");
    const ehrStorage = await EHRFactory.deploy(admin.address, ethers.ZeroAddress);
    await ehrStorage.waitForDeployment();

    // 1c – InsurancePolicy
    const InsuranceFactory = await ethers.getContractFactory("InsurancePolicy");
    const insurance = await InsuranceFactory.deploy(
      admin.address,
      stablecoinAddr,
      ethers.ZeroAddress,
    );
    await insurance.waitForDeployment();
    const insuranceAddr = await insurance.getAddress();

    // 1d – SupplyChain
    const SupplyFactory = await ethers.getContractFactory("SupplyChain");
    const supplyChain = await SupplyFactory.deploy(
      admin.address,
      "https://metadata.medicare.dao/{id}.json",
      ethers.ZeroAddress,
    );
    await supplyChain.waitForDeployment();

    // 1e – CredentialRegistry
    const CredFactory = await ethers.getContractFactory("CredentialRegistry");
    const credentialRegistry = await CredFactory.deploy(admin.address, ethers.ZeroAddress);
    await credentialRegistry.waitForDeployment();

    // 1f – Governance
    const proposalThreshold = ethers.parseUnits("100", 18);
    const quorumVotes = ethers.parseUnits("500", 18);
    const votingPeriod = 7 * 24 * 60 * 60; // 7 days
    const executionDelay = 2 * 24 * 60 * 60; // 2 days

    const GovFactory = await ethers.getContractFactory("Governance");
    const governance = await GovFactory.deploy(
      admin.address,
      stablecoinAddr,
      proposalThreshold,
      quorumVotes,
      votingPeriod,
      executionDelay,
    );
    await governance.waitForDeployment();

    // ───────────────────────────────────────────────
    //  1g. Role grants
    // ───────────────────────────────────────────────

    // EHR: register healthcare provider
    await ehrStorage.connect(admin).registerProvider(provider.address);

    // Insurance: register claims processor
    const CLAIMS_PROCESSOR_ROLE = await insurance.CLAIMS_PROCESSOR_ROLE();
    await insurance.connect(admin).grantRole(CLAIMS_PROCESSOR_ROLE, claimsProcessor.address);

    // SupplyChain: grant supply-chain roles
    const MFG_ROLE = await supplyChain.MANUFACTURER_ROLE();
    const DIST_ROLE = await supplyChain.DISTRIBUTOR_ROLE();
    const PHARM_ROLE = await supplyChain.PHARMACY_ROLE();
    await supplyChain.connect(admin).grantRole(MFG_ROLE, manufacturer.address);
    await supplyChain.connect(admin).grantRole(DIST_ROLE, distributor.address);
    await supplyChain.connect(admin).grantRole(PHARM_ROLE, pharmacy.address);

    // CredentialRegistry: register issuer
    await credentialRegistry.connect(admin).registerIssuer(issuer.address);

    // Governance: grant executor role to admin (already done in constructor, but let's be explicit)
    const EXECUTOR_ROLE = await governance.EXECUTOR_ROLE();
    await governance.connect(admin).grantRole(EXECUTOR_ROLE, admin.address);

    // Mint governance tokens to voters
    await stablecoin.mint(voter1.address, ethers.parseUnits("1000", 18));
    await stablecoin.mint(voter2.address, ethers.parseUnits("1000", 18));

    console.log("    ✓ All contracts deployed and roles configured");

    // ───────────────────────────────────────────────
    //  2. Create a patient health record
    // ───────────────────────────────────────────────

    // Patient grants provider access
    await ehrStorage.connect(patient).grantAccess(provider.address);
    expect(await ehrStorage.checkAccess(patient.address, provider.address)).to.be.true;

    // Provider adds a record
    const ipfsCidHash = ethers.keccak256(ethers.toUtf8Bytes("QmPatientRecord001"));
    const aiSummaryHash = ethers.keccak256(ethers.toUtf8Bytes("AISummary001"));

    const addTx = await ehrStorage
      .connect(provider)
      .addRecord(patient.address, ipfsCidHash, aiSummaryHash, "LAB");
    await addTx.wait();

    expect(await ehrStorage.totalRecords()).to.equal(1n);

    // Retrieve & verify the record
    const record = await ehrStorage.connect(patient).getRecord(0);
    expect(record.patient).to.equal(patient.address);
    expect(record.ipfsCidHash).to.equal(ipfsCidHash);
    expect(record.recordType).to.equal("LAB");
    expect(record.isActive).to.be.true;

    console.log("    ✓ Patient health record created and verified");

    // ───────────────────────────────────────────────
    //  3. Create an insurance policy
    // ───────────────────────────────────────────────

    const coverageAmount = ethers.parseUnits("10000", 18);
    const premiumAmount = ethers.parseUnits("100", 18);
    const durationDays = 365n;
    const riskScore = 3000n; // 30 %

    // Fund the patient (policyholder) with stablecoin
    await stablecoin.mint(patient.address, ethers.parseUnits("50000", 18));
    await stablecoin.connect(patient).approve(insuranceAddr, ethers.MaxUint256);

    // Fund the insurance contract for payouts
    await stablecoin.mint(insuranceAddr, ethers.parseUnits("100000", 18));

    const createPolicyTx = await insurance
      .connect(admin)
      .createPolicy(patient.address, coverageAmount, premiumAmount, durationDays, riskScore);
    await createPolicyTx.wait();

    expect(await insurance.totalPolicies()).to.equal(1n);

    const policy = await insurance.getPolicy(0);
    expect(policy.holder).to.equal(patient.address);
    expect(policy.coverageAmount).to.equal(coverageAmount);
    expect(policy.isActive).to.be.true;

    console.log("    ✓ Insurance policy created (NFT minted to patient)");

    // ───────────────────────────────────────────────
    //  4. Submit, process, and pay a claim
    // ───────────────────────────────────────────────

    const claimAmount = ethers.parseUnits("2500", 18);
    const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes("ClaimDescription001"));

    const submitTx = await insurance
      .connect(patient)
      .submitClaim(0, claimAmount, descriptionHash);
    await submitTx.wait();

    expect(await insurance.totalClaims()).to.equal(1n);

    // Claims processor approves
    await insurance.connect(claimsProcessor).processClaim(0, true);

    let claim = await insurance.getClaim(0);
    expect(claim.status).to.equal(1n); // Approved

    // Pay out the claim
    const balanceBefore = await stablecoin.balanceOf(patient.address);
    await insurance.connect(claimsProcessor).payoutClaim(0);
    const balanceAfter = await stablecoin.balanceOf(patient.address);

    expect(balanceAfter - balanceBefore).to.equal(claimAmount);

    claim = await insurance.getClaim(0);
    expect(claim.status).to.equal(3n); // Paid

    console.log("    ✓ Insurance claim submitted, approved, and paid out");

    // ───────────────────────────────────────────────
    //  5. Create a supply-chain batch
    // ───────────────────────────────────────────────

    const lotNumber = ethers.keccak256(ethers.toUtf8Bytes("LOT-E2E-001"));
    const drugNameHash = ethers.keccak256(ethers.toUtf8Bytes("Amoxicillin500mg"));
    const now = await time.latest();
    const mfgDate = BigInt(now);
    const expDate = BigInt(now + 365 * 24 * 60 * 60);
    const batchQty = 500n;

    await supplyChain
      .connect(manufacturer)
      .createBatch(lotNumber, mfgDate, expDate, batchQty, drugNameHash);

    expect(await supplyChain.totalBatches()).to.equal(1n);

    // Transfer from manufacturer → distributor
    await supplyChain
      .connect(manufacturer)
      .transferBatch(0, distributor.address, batchQty);

    let batch = await supplyChain.getBatch(0);
    expect(batch.status).to.equal(1n); // InTransit

    // Transfer from distributor → pharmacy
    await supplyChain
      .connect(distributor)
      .transferBatch(0, pharmacy.address, batchQty);

    batch = await supplyChain.getBatch(0);
    expect(batch.status).to.equal(2n); // Delivered

    // Log IoT conditions
    const tempHash = ethers.keccak256(ethers.toUtf8Bytes("temp:4.2C"));
    const humidHash = ethers.keccak256(ethers.toUtf8Bytes("humidity:55%"));
    const gpsHash = ethers.keccak256(ethers.toUtf8Bytes("gps:40.7128,-74.0060"));

    await supplyChain
      .connect(pharmacy)
      .updateConditions(0, tempHash, humidHash, gpsHash);

    const logs = await supplyChain.getConditionLogs(0);
    expect(logs.length).to.equal(1);
    expect(logs[0].temperatureHash).to.equal(tempHash);

    // Verify batch integrity
    const [valid, status, isExpired] = await supplyChain.verifyBatch(0);
    expect(valid).to.be.true;
    expect(isExpired).to.be.false;

    console.log("    ✓ Supply-chain batch created, transferred, and verified");

    // ───────────────────────────────────────────────
    //  6. Issue a provider credential
    // ───────────────────────────────────────────────

    const credHash = ethers.keccak256(ethers.toUtf8Bytes("MedLicense-E2E-001"));
    const issuanceDate = BigInt(now);
    const expiryDate = BigInt(now + 365 * 24 * 60 * 60);
    const LICENSE = 0; // CredentialType.LICENSE

    await credentialRegistry
      .connect(issuer)
      .issueCredential(credHash, provider.address, LICENSE, issuanceDate, expiryDate);

    expect(await credentialRegistry.totalCredentials()).to.equal(1n);

    const [credValid, credExpired, credential] = await credentialRegistry.verifyCredential(0);
    expect(credValid).to.be.true;
    expect(credExpired).to.be.false;
    expect(credential.subject).to.equal(provider.address);
    expect(credential.issuer).to.equal(issuer.address);

    // Look up by hash
    const [found, credId] = await credentialRegistry.getCredentialByHash(credHash);
    expect(found).to.be.true;
    expect(credId).to.equal(0n);

    console.log("    ✓ Provider credential issued and verified");

    // ───────────────────────────────────────────────
    //  7. Governance proposal: create, vote, execute
    // ───────────────────────────────────────────────

    // voter1 creates a signal proposal
    await governance
      .connect(voter1)
      .createProposal(
        "E2E: Update risk threshold to 4000 bps",
        1, // ProposalType.RISK_THRESHOLD
        ethers.ZeroAddress, // signal vote — no target
        "0x",
      );

    expect(await governance.totalProposals()).to.equal(1n);

    // Both voters vote in favour
    await governance.connect(voter1).vote(0, true);
    await governance.connect(voter2).vote(0, true);

    const proposal = await governance.getProposal(0);
    expect(proposal.forVotes).to.equal(ethers.parseUnits("2000", 18)); // 1000 + 1000

    // Fast-forward past voting period + execution delay
    await time.increase(votingPeriod + executionDelay + 1);

    // Check status is Succeeded
    const statusBefore = await governance.getProposalStatus(0);
    expect(statusBefore).to.equal(1n); // ProposalStatus.Succeeded

    // Execute (signal vote — no on-chain call)
    await governance.connect(admin).executeProposal(0);

    const statusAfter = await governance.getProposalStatus(0);
    expect(statusAfter).to.equal(3n); // ProposalStatus.Executed

    console.log("    ✓ Governance proposal created, voted on, and executed");

    // ───────────────────────────────────────────────
    //  Summary assertions
    // ───────────────────────────────────────────────
    expect(await ehrStorage.totalRecords()).to.equal(1n);
    expect(await insurance.totalPolicies()).to.equal(1n);
    expect(await insurance.totalClaims()).to.equal(1n);
    expect(await supplyChain.totalBatches()).to.equal(1n);
    expect(await credentialRegistry.totalCredentials()).to.equal(1n);
    expect(await governance.totalProposals()).to.equal(1n);

    console.log("\n    ══════════════════════════════════════");
    console.log("    ✓ Full mediCaRE E2E lifecycle passed!");
    console.log("    ══════════════════════════════════════\n");
  });
});
