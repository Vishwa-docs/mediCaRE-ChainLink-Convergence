import crypto from "crypto";
import config from "../config";
import { createLogger } from "./logging";

const log = createLogger("crypto");

const ALGORITHM = "aes-256-cbc";

/**
 * Encrypt a buffer with AES-256-CBC.
 * Returns `iv:ciphertext` both hex-encoded and concatenated with a colon.
 */
export function encrypt(data: Buffer): string {
  const iv = crypto.randomBytes(config.encryption.ivLength);
  const key = normaliseKey(config.encryption.key);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  log.debug("Encrypted payload", { size: data.length });
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypt an `iv:ciphertext` hex string back to a Buffer.
 */
export function decrypt(payload: string): Buffer {
  const [ivHex, encryptedHex] = payload.split(":");
  if (!ivHex || !encryptedHex) {
    throw new Error("Invalid encrypted payload format — expected iv:ciphertext");
  }
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const key = normaliseKey(config.encryption.key);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  log.debug("Decrypted payload", { size: decrypted.length });
  return decrypted;
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
