import axios from "axios";
import FormData from "form-data";
import config from "../config";
import { encrypt, decrypt } from "../utils/crypto";
import { createLogger } from "../utils/logging";

const log = createLogger("service:ipfs");

const PINATA_PIN_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_JSON_URL = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
const PINATA_UNPIN_URL = "https://api.pinata.cloud/pinning/unpin";

/** Common headers for Pinata API requests. */
function pinataHeaders(): Record<string, string> {
  return {
    pinata_api_key: config.ipfs.pinataApiKey,
    pinata_secret_api_key: config.ipfs.pinataSecretKey,
  };
}

/**
 * Upload a buffer to IPFS via Pinata after encrypting it.
 *
 * @param data     - Raw file buffer.
 * @param fileName - Name to attach to the pinned file.
 * @param metadata - Optional JSON metadata to pin alongside.
 * @returns The IPFS CID (content identifier).
 */
export async function uploadToIPFS(
  data: Buffer,
  fileName: string,
  metadata?: Record<string, string>,
): Promise<string> {
  log.info("Uploading to IPFS", { fileName, size: data.length });

  const encrypted = encrypt(data);
  const encBuf = Buffer.from(encrypted, "utf-8");

  const form = new FormData();
  form.append("file", encBuf, { filename: fileName });

  const pinataMetadata = JSON.stringify({
    name: fileName,
    keyvalues: metadata ?? {},
  });
  form.append("pinataMetadata", pinataMetadata);

  const pinataOptions = JSON.stringify({ cidVersion: 1 });
  form.append("pinataOptions", pinataOptions);

  const response = await axios.post(PINATA_PIN_URL, form, {
    maxBodyLength: Infinity,
    headers: {
      ...form.getHeaders(),
      ...pinataHeaders(),
    },
    timeout: 120_000,
  });

  const cid: string = response.data.IpfsHash;
  log.info("IPFS upload complete", { cid, fileName });
  return cid;
}

/**
 * Upload a JSON object to IPFS via Pinata (unencrypted, for metadata).
 */
export async function uploadJSONToIPFS(
  json: Record<string, unknown>,
  name: string,
): Promise<string> {
  log.info("Uploading JSON to IPFS", { name });

  const response = await axios.post(
    PINATA_JSON_URL,
    {
      pinataContent: json,
      pinataMetadata: { name },
      pinataOptions: { cidVersion: 1 },
    },
    {
      headers: {
        "Content-Type": "application/json",
        ...pinataHeaders(),
      },
      timeout: 60_000,
    },
  );

  const cid: string = response.data.IpfsHash;
  log.info("IPFS JSON upload complete", { cid, name });
  return cid;
}

/**
 * Download a file from IPFS via the configured gateway and decrypt it.
 *
 * @param cid - The content identifier of the pinned file.
 * @returns Decrypted file buffer.
 */
export async function downloadFromIPFS(cid: string): Promise<Buffer> {
  log.info("Downloading from IPFS", { cid });

  const url = `${config.ipfs.gateway}/${cid}`;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });

  const encryptedPayload = Buffer.from(response.data).toString("utf-8");
  const decrypted = decrypt(encryptedPayload);

  log.info("IPFS download and decryption complete", {
    cid,
    size: decrypted.length,
  });
  return decrypted;
}

/**
 * Download raw (unencrypted) content from IPFS.
 */
export async function downloadRawFromIPFS(cid: string): Promise<Buffer> {
  log.info("Downloading raw from IPFS", { cid });

  const url = `${config.ipfs.gateway}/${cid}`;
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 120_000,
  });

  return Buffer.from(response.data);
}

/**
 * Unpin (remove) a file from Pinata.
 *
 * @param cid - The content identifier to unpin.
 */
export async function unpinFromIPFS(cid: string): Promise<void> {
  log.info("Unpinning from IPFS", { cid });

  await axios.delete(`${PINATA_UNPIN_URL}/${cid}`, {
    headers: pinataHeaders(),
    timeout: 30_000,
  });

  log.info("IPFS unpin complete", { cid });
}
