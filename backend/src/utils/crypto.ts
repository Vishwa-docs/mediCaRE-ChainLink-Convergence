import crypto from "crypto";
import config from "../config";
import { createLogger } from "./logging";

const log = createLogger("crypto");

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt a buffer with AES-256-GCM (authenticated encryption).
 * Returns `iv:authTag:ciphertext` all hex-encoded and colon-separated.
 */
export function encrypt(data: Buffer): string {
  const iv = crypto.randomBytes(config.encryption.ivLength);
  const key = normaliseKey(config.encryption.key);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  }) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  log.debug("Encrypted payload (GCM)", { size: data.length });
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an `iv:authTag:ciphertext` hex string back to a Buffer.
 * Also supports legacy `iv:ciphertext` CBC format for backwards compatibility.
 */
export function decrypt(payload: string): Buffer {
  const parts = payload.split(":");

  if (parts.length === 3) {
    // GCM format: iv:authTag:ciphertext
    const [ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) {
      throw new Error("Invalid GCM payload format — expected iv:authTag:ciphertext");
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const key = normaliseKey(config.encryption.key);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH,
    }) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    log.debug("Decrypted payload (GCM)", { size: decrypted.length });
    return decrypted;
  } else if (parts.length === 2) {
    // Legacy CBC format: iv:ciphertext (backwards compatibility)
    const [ivHex, encryptedHex] = parts;
    if (!ivHex || !encryptedHex) {
      throw new Error("Invalid payload format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");
    const key = normaliseKey(config.encryption.key);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    log.debug("Decrypted legacy CBC payload", { size: decrypted.length });
    return decrypted;
  }

  throw new Error("Invalid encrypted payload format — expected iv:authTag:ciphertext or iv:ciphertext");
}

/**
 * Produce a SHA-256 hex digest of arbitrary data.
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Produce a keccak-256 hex digest (Ethereum-compatible).
 */
export function keccak256(data: string | Buffer): string {
  const { ethers } = require("ethers") as typeof import("ethers");
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return ethers.keccak256(bytes);
}

/**
 * Normalise the user-provided key to exactly 32 bytes.
 * If the key is hex-encoded (64 chars) it's decoded; otherwise the first 32
 * bytes of its UTF-8 representation are used, zero-padded if shorter.
 */
function normaliseKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.alloc(32, 0);
  Buffer.from(raw, "utf-8").copy(buf, 0, 0, 32);
  return buf;
}
