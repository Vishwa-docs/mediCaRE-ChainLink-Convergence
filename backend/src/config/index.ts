import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(key: string): string {
  const value = process.env[key];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? "";
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function optionalInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const config = {
  /** Server */
  port: optionalInt("PORT", 3001),
  nodeEnv: optional("NODE_ENV", "development"),
  logLevel: optional("LOG_LEVEL", "debug"),

  /** JWT */
  jwt: {
    secret: required("JWT_SECRET"),
    expiresIn: optional("JWT_EXPIRES_IN", "24h"),
  },

  /** Blockchain */
  blockchain: {
    rpcUrl: required("RPC_URL"),
    privateKey: required("PRIVATE_KEY"),
    chainId: optionalInt("CHAIN_ID", 11155111),
  },

  /** Contract Addresses */
  contracts: {
    ehrStorage: required("EHR_STORAGE_ADDRESS"),
    insurancePolicy: required("INSURANCE_POLICY_ADDRESS"),
    supplyChain: required("SUPPLY_CHAIN_ADDRESS"),
    credentialRegistry: required("CREDENTIAL_REGISTRY_ADDRESS"),
    governance: required("GOVERNANCE_ADDRESS"),
  },

  /** Pinata / IPFS */
  ipfs: {
    pinataApiKey: required("PINATA_API_KEY"),
    pinataSecretKey: required("PINATA_SECRET_KEY"),
    gateway: optional("PINATA_GATEWAY", "https://gateway.pinata.cloud/ipfs"),
  },

  /** Azure OpenAI */
  azureOpenAI: {
    endpoint: required("AZURE_OPENAI_ENDPOINT"),
    apiKey: required("AZURE_OPENAI_API_KEY"),
    deployment: optional("AZURE_OPENAI_DEPLOYMENT", "gpt-4o"),
    apiVersion: optional("AZURE_OPENAI_API_VERSION", "2024-12-01-preview"),
    /** Fully constructed chat completions URL */
    get chatUrl(): string {
      return `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    },
  },

  /** FHIR */
  fhir: {
    baseUrl: optional("FHIR_BASE_URL", "https://hapi.fhir.org/baseR4"),
    authToken: optional("FHIR_AUTH_TOKEN", ""),
  },

  /** World ID */
  worldId: {
    appId: required("WORLDID_APP_ID"),
    action: optional("WORLDID_ACTION", "verify-human"),
    apiUrl: optional(
      "WORLDID_API_URL",
      "https://developer.worldcoin.org/api/v2/verify",
    ),
  },

  /** Encryption */
  encryption: {
    key: required("ENCRYPTION_KEY"),
    ivLength: optionalInt("ENCRYPTION_IV_LENGTH", 16),
  },

  /** Rate Limiting */
  rateLimit: {
    windowMs: optionalInt("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
    max: optionalInt("RATE_LIMIT_MAX", 100),
  },
} as const;

export default config;
