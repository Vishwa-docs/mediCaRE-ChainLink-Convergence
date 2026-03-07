import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import path from "path";

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const AMOY_RPC_URL = process.env.AMOY_RPC_URL || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";
const TENDERLY_VIRTUAL_TESTNET_RPC = process.env.TENDERLY_VIRTUAL_TESTNET_RPC || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000001"
        ? [PRIVATE_KEY]
        : [],
      chainId: 11155111,
    },
    amoy: {
      url: AMOY_RPC_URL,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000001"
        ? [PRIVATE_KEY]
        : [],
      chainId: 80002,
    },
    tenderlyVNet: {
      url: TENDERLY_VIRTUAL_TESTNET_RPC,
      accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000001"
        ? [PRIVATE_KEY]
        : [],
      chainId: 99911155111,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      tenderlyVNet: process.env.TENDERLY_ACCESS_KEY || "dummy",
    },
    customChains: [
      {
        network: "tenderlyVNet",
        chainId: 99911155111,
        urls: {
          apiURL: `${TENDERLY_VIRTUAL_TESTNET_RPC}/verify/etherscan`,
          browserURL: process.env.TENDERLY_PUBLIC_RPC || TENDERLY_VIRTUAL_TESTNET_RPC,
        },
      },
    ],
  },
  paths: {
    sources: "./src",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
  },
};

export default config;
