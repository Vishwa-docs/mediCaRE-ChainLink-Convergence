/**
 * ──────────────────────────────────────────────────────────────
 *  mediCaRE — Test Data Seeding Script
 * ──────────────────────────────────────────────────────────────
 *
 *  Populates the deployed contracts with realistic sample data
 *  so the frontend and CRE workflows have something to render.
 *
 *  Usage:
 *    npx hardhat run scripts/seed_data.ts --network sepolia
 *    npx hardhat run scripts/seed_data.ts --network hardhat
 *
 *  Prerequisites:
 *    - Contracts deployed via  scripts/deploy.ts
 *    - Deployment addresses in  deployments/<network>.json
 *    - Deployer has PROVIDER, ADMIN, MANUFACTURER, ISSUER roles
 * ──────────────────────────────────────────────────────────────
 */

import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Helpers ──────────────────────────────────────────────────

/** Generate a deterministic bytes32 hash from a human-readable string. */
function toBytes32(value: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(value));
}

/** Load deployed addresses for the current network. */
function loadDeployment(): Record<string, string> {
  const filePath = path.resolve(
    __dirname,
    `../deployments/${network.name}.json`,
  );
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Deployment file not found: ${filePath}\nRun deploy.ts first.`,
    );
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return data.contracts as Record<string, string>;
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const contracts = loadDeployment();

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  mediCaRE — Seed Data");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Network : ${network.name}`);
  console.log(`  Deployer: ${deployerAddress}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ────────────────────────────────────────────────────────────
  //  Get Contract Instances
  // ────────────────────────────────────────────────────────────

  const ehr = await ethers.getContractAt("EHRStorage", contracts.EHRStorage);
  const ins = await ethers.getContractAt("InsurancePolicy", contracts.InsurancePolicy);
  const sc  = await ethers.getContractAt("SupplyChain", contracts.SupplyChain);
  const cr  = await ethers.getContractAt("CredentialRegistry", contracts.CredentialRegistry);
  const gov = await ethers.getContractAt("Governance", contracts.Governance);
  const stablecoin = await ethers.getContractAt("MockStablecoin", contracts.MockStablecoin);

  // ────────────────────────────────────────────────────────────
  //  1.  EHR Records  — Patient data stored on IPFS (hashes only)
  // ────────────────────────────────────────────────────────────
  console.log("📋  Seeding EHR records...\n");

  // Grant deployer access as patient so the provider-deployer can add records
  // The deployer is the "patient" in this mock scenario
  let tx = await ehr.grantAccess(deployerAddress);
  await tx.wait();
  console.log("    Granted self-access for deployer as patient");

  const ehrRecords = [
    {
      ipfsCid: "QmX7bFz7YpKg3R1234567890abcdef_blood_panel_2026",
      aiSummary: "Complete blood panel shows normal ranges. WBC 7.2, RBC 4.8, Hemoglobin 14.2 g/dL. No abnormalities detected.",
      recordType: "LAB",
    },
    {
      ipfsCid: "QmY9cGz8ZqLh4S2345678901bcdefg_chest_xray_2026",
      aiSummary: "Chest X-ray anterior-posterior view. Lungs clear bilaterally. Heart size normal. No acute cardiopulmonary process.",
      recordType: "IMAGING",
    },
    {
      ipfsCid: "QmZ1dHz9ArMi5T3456789012cdefgh_prescription_metformin",
      aiSummary: "Prescription: Metformin 500mg twice daily for Type 2 Diabetes management. 90-day supply with 3 refills.",
      recordType: "PRESCRIPTION",
    },
    {
      ipfsCid: "QmA2eIa0BsNj6U4567890123defghi_annual_physical_2026",
      aiSummary: "Annual physical exam. BMI 24.1, BP 118/76, HR 72. Patient in good overall health. Recommended annual flu vaccine.",
      recordType: "GENERAL",
    },
    {
      ipfsCid: "QmB3fJb1CtOk7V5678901234efghij_allergy_test_2026",
      aiSummary: "Allergy panel test results. Positive for dust mites (moderate), pollen (mild). Negative for food allergens. Recommend antihistamines PRN.",
      recordType: "LAB",
    },
  ];

  for (const record of ehrRecords) {
    const ipfsHash = toBytes32(record.ipfsCid);
    const aiHash = toBytes32(record.aiSummary);

    tx = await ehr.addRecord(
      deployerAddress,  // patient (deployer acts as patient)
      ipfsHash,
      aiHash,
      record.recordType,
    );
    await tx.wait();
    console.log(`    ✅  Record added: ${record.recordType} — ${record.ipfsCid.slice(0, 20)}...`);
  }

  console.log(`    → ${ehrRecords.length} EHR records seeded\n`);

  // ────────────────────────────────────────────────────────────
  //  2.  Insurance Policies
  // ────────────────────────────────────────────────────────────
  console.log("🛡️   Seeding insurance policies...\n");

  // Approve stablecoin spending for premium payments
  const maxApproval = ethers.parseUnits("100000", 18);
  tx = await stablecoin.approve(contracts.InsurancePolicy, maxApproval);
  await tx.wait();
  console.log("    Approved stablecoin spend for InsurancePolicy");

  const policies = [
    {
      coverageAmount: ethers.parseUnits("50000", 18),  // $50k coverage
      premiumAmount: ethers.parseUnits("250", 18),     // $250/period
      durationDays: 365,
      riskScore: 2500,  // 25% risk (basis points)
      label: "Comprehensive Health Plan",
    },
    {
      coverageAmount: ethers.parseUnits("25000", 18),  // $25k coverage
      premiumAmount: ethers.parseUnits("120", 18),     // $120/period
      durationDays: 180,
      riskScore: 1500,  // 15% risk
      label: "Basic Dental & Vision",
    },
    {
      coverageAmount: ethers.parseUnits("100000", 18), // $100k coverage
      premiumAmount: ethers.parseUnits("450", 18),     // $450/period
      durationDays: 365,
      riskScore: 3200,  // 32% risk
      label: "Premium Family Plan",
    },
  ];

  for (const policy of policies) {
    tx = await ins.createPolicy(
      deployerAddress,        // holder
      policy.coverageAmount,
      policy.premiumAmount,
      policy.durationDays,
      policy.riskScore,
    );
    await tx.wait();
    console.log(`    ✅  Policy created: ${policy.label}`);
  }

  // Submit a sample claim against the first policy
  const claimAmount = ethers.parseUnits("1500", 18); // $1,500 claim
  const claimDescHash = toBytes32("Emergency room visit 2026-02-15. Diagnosis: acute bronchitis. Treatment: antibiotics course.");
  tx = await ins.submitClaim(0, claimAmount, claimDescHash);
  await tx.wait();
  console.log("    ✅  Claim submitted against policy #0");

  // Approve the claim
  tx = await ins.processClaim(0, true);
  await tx.wait();
  console.log("    ✅  Claim #0 approved");

  console.log(`    → ${policies.length} policies + 1 claim seeded\n`);

  // ────────────────────────────────────────────────────────────
  //  3.  Supply Chain Batches
  // ────────────────────────────────────────────────────────────
  console.log("📦  Seeding supply chain batches...\n");

  const now = Math.floor(Date.now() / 1000);
  const oneYear = 365 * 24 * 60 * 60;

  const batches = [
    {
      lotNumber: "LOT-AMOX-2026-001",
      drugName: "Amoxicillin 500mg Capsules",
      quantity: 10000,
      shelfLifeDays: 730, // 2 years
    },
    {
      lotNumber: "LOT-METF-2026-042",
      drugName: "Metformin 850mg Tablets",
      quantity: 5000,
      shelfLifeDays: 1095, // 3 years
    },
    {
      lotNumber: "LOT-INSL-2026-007",
      drugName: "Insulin Glargine 100U/mL",
      quantity: 2000,
      shelfLifeDays: 365, // 1 year (refrigerated)
    },
    {
      lotNumber: "LOT-OMEP-2026-019",
      drugName: "Omeprazole 20mg Delayed-Release",
      quantity: 8000,
      shelfLifeDays: 1095,
    },
  ];

  for (const batch of batches) {
    const lotHash = toBytes32(batch.lotNumber);
    const drugHash = toBytes32(batch.drugName);
    const manufactureDate = now - (7 * 24 * 60 * 60); // 1 week ago
    const expiryDate = now + (batch.shelfLifeDays * 24 * 60 * 60);

    tx = await sc.createBatch(
      lotHash,
      manufactureDate,
      expiryDate,
      batch.quantity,
      drugHash,
    );
    await tx.wait();
    console.log(`    ✅  Batch created: ${batch.drugName} (${batch.quantity} units)`);
  }

  // Add IoT condition log to first batch
  tx = await sc.updateConditions(
    0, // batchId
    toBytes32("temp:4.2C"),       // temperature hash
    toBytes32("humidity:52%"),    // humidity hash
    toBytes32("gps:40.7128,-74.0060"), // GPS hash (NYC warehouse)
  );
  await tx.wait();
  console.log("    ✅  IoT conditions logged for batch #0");

  // Transfer first batch to "distributor" (deployer has all roles for demo)
  tx = await sc.transferBatch(0, deployerAddress, 5000);
  await tx.wait();
  console.log("    ✅  Batch #0 partially transferred (5000 units)");

  console.log(`    → ${batches.length} batches + conditions seeded\n`);

  // ────────────────────────────────────────────────────────────
  //  4.  Provider Credentials
  // ────────────────────────────────────────────────────────────
  console.log("🏥  Seeding provider credentials...\n");

  const credentials = [
    {
      docHash: "credential-doc-medical-license-dr-smith-2026",
      credentialType: 0, // LICENSE
      expiryYears: 5,
      label: "Medical License — Dr. Smith",
    },
    {
      docHash: "credential-doc-board-cert-cardiology-dr-smith-2026",
      credentialType: 1, // BOARD_CERT
      expiryYears: 10,
      label: "Board Certification — Cardiology",
    },
    {
      docHash: "credential-doc-dea-registration-dr-smith-2026",
      credentialType: 3, // DEA
      expiryYears: 3,
      label: "DEA Registration",
    },
    {
      docHash: "credential-doc-npi-dr-smith-2026",
      credentialType: 4, // NPI
      expiryYears: 0,    // permanent (no expiry)
      label: "National Provider Identifier (NPI)",
    },
    {
      docHash: "credential-doc-cme-credits-dr-smith-2026",
      credentialType: 5, // CME
      expiryYears: 2,
      label: "CME Credits — 2026 Cycle",
    },
  ];

  for (const cred of credentials) {
    const credHash = toBytes32(cred.docHash);
    const issuanceDate = now - (30 * 24 * 60 * 60); // issued 30 days ago
    const expiryDate = cred.expiryYears > 0
      ? now + (cred.expiryYears * oneYear)
      : 0; // 0 = no expiry

    tx = await cr.issueCredential(
      credHash,
      deployerAddress,   // subject (provider)
      cred.credentialType,
      issuanceDate,
      expiryDate,
    );
    await tx.wait();
    console.log(`    ✅  Credential issued: ${cred.label}`);
  }

  console.log(`    → ${credentials.length} credentials seeded\n`);

  // ────────────────────────────────────────────────────────────
  //  5.  Governance Proposals
  // ────────────────────────────────────────────────────────────
  console.log("🗳️   Seeding governance proposals...\n");

  const proposals = [
    {
      description: "Proposal #1: Reduce insurance claim processing time from 72h to 24h by implementing automated CRE-based claim adjudication for claims under $5,000.",
      proposalType: 0, // PARAMETER_CHANGE
      label: "Automated Small Claims Processing",
    },
    {
      description: "Proposal #2: Adjust the risk scoring threshold for premium adjustments from 7500 bps to 8000 bps, reducing false-positive premium increases for low-risk patients.",
      proposalType: 1, // RISK_THRESHOLD
      label: "Risk Threshold Adjustment",
    },
    {
      description: "Proposal #3: Enable cross-chain EHR data sharing with Optimism Sepolia via CCIP for partner hospital network integration.",
      proposalType: 2, // DATA_SHARING
      label: "Cross-Chain EHR Sharing",
    },
  ];

  for (const prop of proposals) {
    tx = await gov.createProposal(
      prop.description,
      prop.proposalType,
      ethers.ZeroAddress, // signal vote — no on-chain execution target
      "0x",               // no calldata
    );
    await tx.wait();
    console.log(`    ✅  Proposal created: ${prop.label}`);
  }

  // Cast a vote on the first proposal
  tx = await gov.vote(0, true); // vote FOR proposal #0
  await tx.wait();
  console.log("    ✅  Vote cast: FOR proposal #0");

  console.log(`    → ${proposals.length} proposals + 1 vote seeded\n`);

  // ────────────────────────────────────────────────────────────
  //  6.  Longitudinal Summary (EHRStorage — new feature)
  // ────────────────────────────────────────────────────────────
  console.log("🧬  Seeding longitudinal summaries...\n");

  const longitudinalSummaryHash = toBytes32(
    JSON.stringify({
      patient: "demo-patient",
      conditions: ["Type 2 Diabetes", "Hypertension"],
      medications: [
        { name: "Metformin", dosage: "500mg", frequency: "BID", since: "2024-03" },
        { name: "Lisinopril", dosage: "10mg", frequency: "QD", since: "2024-06" },
        { name: "Atorvastatin", dosage: "20mg", frequency: "QHS", since: "2024-06" },
      ],
      allergies: ["Penicillin", "Latex", "Sulfa drugs"],
      interactions: [
        { drugs: ["Metformin", "Lisinopril"], severity: "low", note: "Monitor renal function" },
      ],
      redFlags: ["HbA1c trending upward — 6.4 → 7.1 over 6 months"],
      generatedAt: new Date().toISOString(),
    }),
  );

  tx = await ehr.setLongitudinalSummary(deployerAddress, longitudinalSummaryHash);
  await tx.wait();
  console.log("    ✅  Longitudinal summary stored on-chain for demo patient\n");

  // ────────────────────────────────────────────────────────────
  //  7.  AI Explanation Hash (InsurancePolicy — new feature)
  // ────────────────────────────────────────────────────────────
  console.log("🤖  Seeding AI explanation hashes...\n");

  const explanationHash = toBytes32(
    JSON.stringify({
      model: "ClaimAdjudicator-BFT-v1",
      decisionType: "CLAIM_ADJUDICATION",
      confidence: 0.94,
      keyFactors: [
        { factor: "Medical coding validity", influence: 0.35, direction: "positive" },
        { factor: "Provider credentialing status", influence: 0.25, direction: "positive" },
        { factor: "Historical claim pattern", influence: 0.20, direction: "positive" },
        { factor: "Treatment-diagnosis alignment", influence: 0.15, direction: "positive" },
        { factor: "Claim amount percentile", influence: 0.05, direction: "neutral" },
      ],
      agentConsensus: {
        triageBot: { recommendation: "APPROVE", confidence: 0.92 },
        codingBot: { recommendation: "APPROVE", confidence: 0.96 },
        fraudDetectorBot: { recommendation: "APPROVE", confidence: 0.93 },
      },
      bftResult: "UNANIMOUS_APPROVE",
    }),
  );

  tx = await ins.setExplanationHash(0, explanationHash);
  await tx.wait();
  console.log("    ✅  Explanation hash set for claim #0\n");

  // ────────────────────────────────────────────────────────────
  //  8.  Research Proposals + IRB Scores (Governance — new)
  // ────────────────────────────────────────────────────────────
  console.log("🔬  Seeding research proposals & IRB scores...\n");

  const researchProposals = [
    {
      protocolHash: toBytes32("protocol-glp1-diabetes-2026-v2"),
      title: "Novel GLP-1 Agonist for Type 2 Diabetes Management",
      institution: "Stanford Medical Center",
      irbScore: 87,
    },
    {
      protocolHash: toBytes32("protocol-ai-hypertension-2026-v1"),
      title: "AI-Guided Hypertension Treatment Protocol",
      institution: "Mayo Clinic Research",
      irbScore: 92,
    },
  ];

  for (const rp of researchProposals) {
    tx = await gov.submitResearchProposal(
      rp.protocolHash,
      rp.title,
      rp.institution,
    );
    await tx.wait();
    console.log(`    ✅  Research proposal submitted: ${rp.title}`);
  }

  // Record IRB scores (deployer has EXECUTOR_ROLE)
  for (let i = 0; i < researchProposals.length; i++) {
    tx = await gov.recordIRBScore(i, researchProposals[i].irbScore);
    await tx.wait();
    console.log(`    ✅  IRB score recorded: ${researchProposals[i].irbScore}/100 for proposal #${i}`);
  }

  console.log(`    → ${researchProposals.length} research proposals seeded\n`);

  // ────────────────────────────────────────────────────────────
  //  9.  Research Consent (Governance — new)
  // ────────────────────────────────────────────────────────────
  console.log("✅  Seeding research consent...\n");

  tx = await gov.setResearchConsent(true);
  await tx.wait();
  console.log("    ✅  Research consent granted for deployer address\n");

  // ────────────────────────────────────────────────────────────
  //  Summary
  // ────────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  Seed Data Summary");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  EHR Records          : ${ehrRecords.length}`);
  console.log(`  Longitudinal Summary : 1`);
  console.log(`  Insurance Policies   : ${policies.length} (+1 claim)`);
  console.log(`  AI Explanations      : 1`);
  console.log(`  Supply Chain Batches : ${batches.length} (+conditions)`);
  console.log(`  Provider Credentials : ${credentials.length}`);
  console.log(`  Governance Proposals : ${proposals.length} (+1 vote)`);
  console.log(`  Research Proposals   : ${researchProposals.length} (+IRB scores)`);
  console.log(`  Research Consent     : 1`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n🎉  Seeding complete!\n");
}

// ── Entrypoint ───────────────────────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("\n❌  Seeding failed:", error.message);
    console.error(error);
    process.exit(1);
  });
