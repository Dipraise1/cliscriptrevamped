import * as web3 from "@solana/web3.js";
import * as fs from "fs";

/**
 * Create a Keypair from a file
 * @param {string} filePath - Path to the keypair file
 * @returns {web3.Keypair} The keypair created from the file
 */
export function createKeypairFromFile(filePath) {
  const secretKeyString = fs.readFileSync(filePath, { encoding: "utf8" });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return web3.Keypair.fromSecretKey(secretKey);
} 