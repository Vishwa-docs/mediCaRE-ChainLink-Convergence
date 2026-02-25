/**
 * ──────────────────────────────────────────────────────────────
 *  mediCaRE — CRE Workflow Configuration Helper
 * ──────────────────────────────────────────────────────────────
 *
 *  Reads deployed contract addresses and generates updated CRE
 *  workflow configuration files with the real on-chain addresses.
 *  Also prints the CLI commands needed to deploy each workflow.
 *
 *  Usage:
 *    npx hardhat run scripts/configure_cre.ts --network sepolia
 *
 *  Prerequisites:
 *    - Contracts deployed via  scripts/deploy.ts
 *    - Deployment addresses in  deployments/<network>.json
 *    - CRE CLI (`cre`) installed and authenticated
 * ──────────────────────────────────────────────────────────────
 */

import { network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Types ────────────────────────────────────────────────────

interface ContractAddresses {
  MockStablecoin: string;
  EHRStorage: string;
  InsurancePolicy: string;
  SupplyChain: string;
  CredentialRegistry: string;
  Governance: string;
}

interface CREWorkflowConfig {
  [key: string]: string | number;
}

// ── Helpers ──────────────────────────────────────────────────

function loadDeployment(): ContractAddresses {
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
  return data.contracts as ContractAddresses;
}

function writeConfig(workflowDir: string, config: CREWorkflowConfig): void {
  const configPath = path.join(workflowDir, "config.staging.json");
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`    ✅  Written: ${path.relative(process.cwd(), configPath)}`);
}

// ── Chain name mapping ───────────────────────────────────────

function getChainName(): string {
  const chainMap: Record<string, string> = {
    sepolia: "ethereum-testnet-sepolia",
    amoy: "polygon-testnet-amoy",
    hardhat: "ethereum-testnet-sepolia", // simulate as sepolia
  };
  return chainMap[network.name] || "ethereum-testnet-sepolia";
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const contracts = loadDeployment();
  const chainName = getChainName();
  const creRoot = path.resolve(__dirname, "../../cre-workflows");

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  mediCaRE — CRE Workflow Configuration");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Network   : ${network.name}`);
  console.log(`  Chain Name: ${chainName}`);
  console.log(`  CRE Root  : ${creRoot}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  // ────────────────────────────────────────────────────────────
  //  1.  Record Upload Workflow
  // ────────────────────────────────────────────────────────────
  console.log("📋  record-upload workflow:");
  writeConfig(path.join(creRoot, "record-upload"), {
    chainName,
    ehrStorageAddress: contracts.EHRStorage,
    ipfsGatewayUrl: "https://gateway.pinata.cloud/ipfs",
    aiSummarizerUrl: "https://api.medicare-ai.example.com/v1/summarize",
    authorizedEVMAddress: "",
    gasLimit: 500000,
  });

  // ────────────────────────────────────────────────────────────
  //  2.  Insurance Claim Workflow
  // ────────────────────────────────────────────────────────────
  console.log("\n🛡️   insurance-claim workflow:");
  writeConfig(path.join(creRoot, "insurance-claim"), {
    chainName,
    insurancePolicyAddress: contracts.InsurancePolicy,
    ehrStorageAddress: contracts.EHRStorage,
    riskScoringUrl: "https://api.medicare-ai.example.com/v1/risk-score",
    medicalDataUrl: "https://api.medicare-backend.example.com/v1/claim-data",
    gasLimit: 500000,
  });

  // ────────────────────────────────────────────────────────────
  //  3.  Supply Chain Monitoring Workflow
  // ────────────────────────────────────────────────────────────
  console.log("\n📦  supply-chain workflow:");
  writeConfig(path.join(creRoot, "supply-chain"), {
    chainName,
    supplyChainAddress: contracts.SupplyChain,
    iotOracleUrl: "https://api.medicare-iot.example.com/v1/sensor-data",
    cronSchedule: "0 */5 * * * *",
    temperatureMaxCelsius: 8,
    temperatureMinCelsius: 2,
    humidityMaxPercent: 65,
    humidityMinPercent: 35,
    gasLimit: 400000,
  });

  // ────────────────────────────────────────────────────────────
  //  4.  Consent Management Workflow
  // ────────────────────────────────────────────────────────────
  console.log("\n🔐  consent workflow:");
  writeConfig(path.join(creRoot, "consent"), {
    chainName,
    ehrStorageAddress: contracts.EHRStorage,
    credentialRegistryAddress: contracts.CredentialRegistry,
    ipfsGatewayUrl: "https://gateway.pinata.cloud/ipfs",
    authorizedEVMAddress: "",
    gasLimit: 300000,
  });

  // ────────────────────────────────────────────────────────────
  //  5.  Cross-Chain Settlement Workflow
  // ────────────────────────────────────────────────────────────
  console.log("\n🌉  crosschain workflow:");
  writeConfig(path.join(creRoot, "crosschain"), {
    sourceChainName: chainName,
    destinationChainName: "ethereum-testnet-sepolia-optimism-1",
    insurancePolicyAddress: contracts.InsurancePolicy,
    ccipRouterAddress: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
    stablecoinAddress: contracts.MockStablecoin,
    settlementConsumerAddress: "0x0000000000000000000000000000000000000006", // Deploy separately
    gasLimit: 600000,
  });

  // ────────────────────────────────────────────────────────────
  //  6.  World ID Verification Workflow
  // ────────────────────────────────────────────────────────────
  console.log("\n🌍  worldid workflow:");
  writeConfig(path.join(creRoot, "worldid"), {
    chainName,
    credentialRegistryAddress: contracts.CredentialRegistry,
    worldIdVerifierUrl: "https://developer.worldcoin.org/api/v2/verify",
    authorizedEVMAddress: "",
    gasLimit: 350000,
  });

  // ────────────────────────────────────────────────────────────
  //  CLI Commands Reference
  // ────────────────────────────────────────────────────────────
  console.log("\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  CRE CLI Deployment Commands");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Before deploying, ensure you have:");
  console.log("    1. CRE CLI installed:  npm i -g @chainlink/cre-cli");
  console.log("    2. Authenticated:      cre auth login");
  console.log("    3. Secrets uploaded:    cre secrets create secrets.yaml");
  console.log("");
  console.log("  ── Step 1: Upload Secrets ────────────────────────────");
  console.log("");
  console.log("  cd cre-workflows");
  console.log("  cre secrets create secrets.yaml \\");
  console.log("    --target ethereum-testnet-sepolia");
  console.log("");
  console.log("  ── Step 2: Simulate Workflows (dry-run) ─────────────");
  console.log("");

  const workflows = [
    "record-upload",
    "insurance-claim",
    "supply-chain",
    "consent",
    "crosschain",
    "worldid",
  ];

  for (const wf of workflows) {
    console.log(`  # ${wf}`);
    console.log(`  cre workflow simulate \\`);
    console.log(`    --workflow-dir ./${wf} \\`);
    console.log(`    --config-file ./${wf}/config.staging.json \\`);
    console.log(`    --secrets-file ./secrets.yaml`);
    console.log("");
  }

  console.log("  ── Step 3: Deploy Workflows (production) ─────────────");
  console.log("");

  for (const wf of workflows) {
    console.log(`  # ${wf}`);
    console.log(`  cre workflow deploy \\`);
    console.log(`    --workflow-dir ./${wf} \\`);
    console.log(`    --config-file ./${wf}/config.staging.json \\`);
    console.log(`    --secrets-file ./secrets.yaml \\`);
    console.log(`    --target ethereum-testnet-sepolia`);
    console.log("");
  }

  console.log("  ── Step 4: Verify Deployments ────────────────────────");
  console.log("");
  console.log("  cre workflow list");
  console.log("  cre workflow status --workflow-name medicare-<name>-staging");
  console.log("");
  console.log("═══════════════════════════════════════════════════════════");

  // ────────────────────────────────────────────────────────────
  //  Contract Address Reference
  // ────────────────────────────────────────────────────────────
  console.log("");
  console.log("  Deployed Contract Addresses (for reference):");
  console.log("  ─────────────────────────────────────────────");
  console.log(`  MockStablecoin     : ${contracts.MockStablecoin}`);
  console.log(`  EHRStorage         : ${contracts.EHRStorage}`);
  console.log(`  InsurancePolicy    : ${contracts.InsurancePolicy}`);
  console.log(`  SupplyChain        : ${contracts.SupplyChain}`);
  console.log(`  CredentialRegistry : ${contracts.CredentialRegistry}`);
  console.log(`  Governance         : ${contracts.Governance}`);
  console.log("");
  console.log("🎉  CRE configuration complete!\n");
}

// ── Entrypoint ───────────────────────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("\n❌  CRE configuration failed:", error.message);
    console.error(error);
    process.exit(1);
  });
