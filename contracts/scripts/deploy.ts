/**
 * ──────────────────────────────────────────────────────────────
 *  mediCaRE — Full Contract Deployment Script
 * ──────────────────────────────────────────────────────────────
 *
 *  Usage:
 *    npx hardhat run scripts/deploy.ts --network tenderlyVNet  (Tenderly Virtual TestNet)
 *    npx hardhat run scripts/deploy.ts --network sepolia
 *    npx hardhat run scripts/deploy.ts --network amoy
 *    npx hardhat run scripts/deploy.ts --network hardhat   (local)
 *
 *  Deployment order:
 *    1. MockStablecoin   (testnet / local only)
 *    2. EHRStorage
 *    3. InsurancePolicy
 *    4. SupplyChain
 *    5. CredentialRegistry
 *    6. Governance
 *
 *  After deployment the script:
 *    - Grants initial roles  (PROVIDER, CLAIMS_PROCESSOR, MANUFACTURER, ISSUER, EXECUTOR)
 *    - Mints test stablecoin tokens to the deployer
 *    - Persists addresses to  contracts/deployments/<network>.json
 *    - Optionally verifies contracts on Etherscan
 * ──────────────────────────────────────────────────────────────
 */

import { ethers, network, run } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// ── Types ────────────────────────────────────────────────────

interface DeploymentAddresses {
  network: string;
  chainId: number;
  deployer: string;
  deployedAt: string;
  contracts: {
    MockStablecoin: string;
    EHRStorage: string;
    InsurancePolicy: string;
    SupplyChain: string;
    CredentialRegistry: string;
    Governance: string;
  };
}

// ── Helpers ──────────────────────────────────────────────────

/**
 * Wait for a contract deployment transaction to be confirmed,
 * then optionally verify on Etherscan.
 */
async function deployAndLog(
  name: string,
  factory: Awaited<ReturnType<typeof ethers.getContractFactory>>,
  args: unknown[],
): Promise<string> {
  console.log(`\n🔨  Deploying ${name}...`);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`    ✅  ${name} deployed to: ${address}`);
  return address;
}

/**
 * Attempt Etherscan verification.  Swallows errors gracefully so the
 * rest of the deployment is not blocked by verification failures.
 */
async function verifyContract(
  address: string,
  constructorArguments: unknown[],
): Promise<void> {
  if (!process.env.ETHERSCAN_API_KEY) return;
  if (network.name === "hardhat" || network.name === "localhost") return;

  console.log(`    🔍  Verifying on Etherscan...`);
  try {
    await run("verify:verify", { address, constructorArguments });
    console.log(`    ✅  Verified!`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Already Verified") || message.includes("already verified")) {
      console.log(`    ℹ️   Already verified.`);
    } else {
      console.warn(`    ⚠️   Verification failed: ${message}`);
    }
  }
}

/**
 * Save deployed addresses to a JSON file so other scripts (seed, CRE
 * configuration, frontend) can reference them.
 */
function saveDeployment(data: DeploymentAddresses): void {
  const dir = path.resolve(__dirname, "../deployments");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const filePath = path.join(dir, `${data.network}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`\n💾  Deployment addresses saved to ${filePath}`);
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const networkName = network.name;

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  mediCaRE — Contract Deployment");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Network :  ${networkName} (chainId ${chainId})`);
  console.log(`  Deployer:  ${deployerAddress}`);
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log(`  Balance :  ${ethers.formatEther(balance)} ETH`);
  console.log("═══════════════════════════════════════════════════════════");

  // World ID verifier: address(0) on testnets / local (opt-in later)
  const worldIdVerifier = ethers.ZeroAddress;

  // ────────────────────────────────────────────────────────────
  //  1.  MockStablecoin  (testnet / local only)
  // ────────────────────────────────────────────────────────────
  let stablecoinAddress: string;

  const isTestnet = ["hardhat", "localhost", "sepolia", "amoy", "tenderlyVNet"].includes(networkName);

  if (isTestnet) {
    const MockStablecoin = await ethers.getContractFactory("MockStablecoin");
    stablecoinAddress = await deployAndLog("MockStablecoin", MockStablecoin, []);
    await verifyContract(stablecoinAddress, []);

    // Mint 1 000 000 mUSDC to deployer for testing (18 decimals)
    const stablecoin = await ethers.getContractAt("MockStablecoin", stablecoinAddress);
    const mintAmount = ethers.parseUnits("1000000", 18);
    const mintTx = await stablecoin.mint(deployerAddress, mintAmount);
    await mintTx.wait();
    console.log(`    💰  Minted ${ethers.formatUnits(mintAmount, 18)} mUSDC to deployer`);
  } else {
    // On mainnet, use the real stablecoin address from env
    stablecoinAddress = process.env.STABLECOIN_ADDRESS || "";
    if (!stablecoinAddress) {
      throw new Error("STABLECOIN_ADDRESS env var required for mainnet deployment");
    }
    console.log(`\n📌  Using existing stablecoin at: ${stablecoinAddress}`);
  }

  // ────────────────────────────────────────────────────────────
  //  2.  EHRStorage
  // ────────────────────────────────────────────────────────────
  const EHRStorage = await ethers.getContractFactory("EHRStorage");
  const ehrArgs: [string, string] = [deployerAddress, worldIdVerifier];
  const ehrAddress = await deployAndLog("EHRStorage", EHRStorage, ehrArgs);
  await verifyContract(ehrAddress, ehrArgs);

  // ────────────────────────────────────────────────────────────
  //  3.  InsurancePolicy
  // ────────────────────────────────────────────────────────────
  const InsurancePolicy = await ethers.getContractFactory("InsurancePolicy");
  const insArgs: [string, string, string] = [deployerAddress, stablecoinAddress, worldIdVerifier];
  const insAddress = await deployAndLog("InsurancePolicy", InsurancePolicy, insArgs);
  await verifyContract(insAddress, insArgs);

  // ────────────────────────────────────────────────────────────
  //  4.  SupplyChain
  // ────────────────────────────────────────────────────────────
  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const metadataURI = "https://api.medicare-dapp.example.com/metadata/{id}.json";
  const scArgs: [string, string, string] = [deployerAddress, metadataURI, worldIdVerifier];
  const scAddress = await deployAndLog("SupplyChain", SupplyChain, scArgs);
  await verifyContract(scAddress, scArgs);

  // ────────────────────────────────────────────────────────────
  //  5.  CredentialRegistry
  // ────────────────────────────────────────────────────────────
  const CredentialRegistry = await ethers.getContractFactory("CredentialRegistry");
  const crArgs: [string, string] = [deployerAddress, worldIdVerifier];
  const crAddress = await deployAndLog("CredentialRegistry", CredentialRegistry, crArgs);
  await verifyContract(crAddress, crArgs);

  // ────────────────────────────────────────────────────────────
  //  6.  Governance
  // ────────────────────────────────────────────────────────────
  //  Uses the MockStablecoin as governance token for testnet.
  //  On mainnet, replace with the real governance token address.
  const govTokenAddress = isTestnet
    ? stablecoinAddress
    : (process.env.GOVERNANCE_TOKEN_ADDRESS || stablecoinAddress);

  const proposalThreshold = ethers.parseUnits("100", 18);   // 100 tokens to propose
  const quorumVotes       = ethers.parseUnits("1000", 18);   // 1 000 tokens quorum
  const votingPeriod      = 3 * 24 * 60 * 60;                // 3 days in seconds
  const executionDelay    = 1 * 24 * 60 * 60;                // 1 day timelock

  const Governance = await ethers.getContractFactory("Governance");
  const govArgs: [string, string, bigint, bigint, number, number] = [
    deployerAddress,
    govTokenAddress,
    proposalThreshold,
    quorumVotes,
    votingPeriod,
    executionDelay,
  ];
  const govAddress = await deployAndLog("Governance", Governance, govArgs);
  await verifyContract(govAddress, govArgs);

  // ────────────────────────────────────────────────────────────
  //  Role Setup
  // ────────────────────────────────────────────────────────────
  console.log("\n🔑  Setting up initial roles...");

  // EHRStorage: grant deployer PROVIDER_ROLE for seeding
  const ehr = await ethers.getContractAt("EHRStorage", ehrAddress);
  const PROVIDER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("PROVIDER_ROLE"));
  let tx = await ehr.grantRole(PROVIDER_ROLE, deployerAddress);
  await tx.wait();
  console.log("    ✅  EHRStorage — deployer granted PROVIDER_ROLE");

  // InsurancePolicy: grant deployer CLAIMS_PROCESSOR_ROLE for seeding
  const ins = await ethers.getContractAt("InsurancePolicy", insAddress);
  const CLAIMS_PROCESSOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes("CLAIMS_PROCESSOR_ROLE"));
  tx = await ins.grantRole(CLAIMS_PROCESSOR_ROLE, deployerAddress);
  await tx.wait();
  console.log("    ✅  InsurancePolicy — deployer granted CLAIMS_PROCESSOR_ROLE");

  // SupplyChain: grant deployer MANUFACTURER_ROLE, DISTRIBUTOR_ROLE, PHARMACY_ROLE
  const sc = await ethers.getContractAt("SupplyChain", scAddress);
  const MANUFACTURER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MANUFACTURER_ROLE"));
  const DISTRIBUTOR_ROLE  = ethers.keccak256(ethers.toUtf8Bytes("DISTRIBUTOR_ROLE"));
  const PHARMACY_ROLE     = ethers.keccak256(ethers.toUtf8Bytes("PHARMACY_ROLE"));
  tx = await sc.grantRole(MANUFACTURER_ROLE, deployerAddress);
  await tx.wait();
  tx = await sc.grantRole(DISTRIBUTOR_ROLE, deployerAddress);
  await tx.wait();
  tx = await sc.grantRole(PHARMACY_ROLE, deployerAddress);
  await tx.wait();
  console.log("    ✅  SupplyChain — deployer granted MANUFACTURER / DISTRIBUTOR / PHARMACY roles");

  // CredentialRegistry: grant deployer ISSUER_ROLE
  const cr = await ethers.getContractAt("CredentialRegistry", crAddress);
  const ISSUER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ISSUER_ROLE"));
  tx = await cr.grantRole(ISSUER_ROLE, deployerAddress);
  await tx.wait();
  console.log("    ✅  CredentialRegistry — deployer granted ISSUER_ROLE");

  // Governance: EXECUTOR_ROLE already granted to admin in constructor
  console.log("    ✅  Governance — EXECUTOR_ROLE already set in constructor");

  // ────────────────────────────────────────────────────────────
  //  Persist Deployment
  // ────────────────────────────────────────────────────────────
  const deployment: DeploymentAddresses = {
    network: networkName,
    chainId,
    deployer: deployerAddress,
    deployedAt: new Date().toISOString(),
    contracts: {
      MockStablecoin: stablecoinAddress,
      EHRStorage: ehrAddress,
      InsurancePolicy: insAddress,
      SupplyChain: scAddress,
      CredentialRegistry: crAddress,
      Governance: govAddress,
    },
  };

  saveDeployment(deployment);

  // ────────────────────────────────────────────────────────────
  //  Summary
  // ────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Deployment Summary");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  MockStablecoin     : ${stablecoinAddress}`);
  console.log(`  EHRStorage         : ${ehrAddress}`);
  console.log(`  InsurancePolicy    : ${insAddress}`);
  console.log(`  SupplyChain        : ${scAddress}`);
  console.log(`  CredentialRegistry : ${crAddress}`);
  console.log(`  Governance         : ${govAddress}`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n🎉  Deployment complete!\n");
}

// ── Entrypoint ───────────────────────────────────────────────

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error("\n❌  Deployment failed:", error.message);
    console.error(error);
    process.exit(1);
  });
