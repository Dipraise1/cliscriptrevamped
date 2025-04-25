import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Network settings
export const NETWORK = process.env.SOLANA_NETWORK || 'devnet';
export const RPC_URL = process.env.SOLANA_RPC_URL || 
  (NETWORK === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 
   NETWORK === 'testnet' ? 'https://api.testnet.solana.com' : 
   'https://api.devnet.solana.com');

// Default settings
export const DEFAULT_DECIMALS = 9;
export const DEFAULT_INITIAL_SUPPLY = 1000000000;

// Explorer URLs
export const EXPLORER_URL = NETWORK === 'mainnet-beta' ? 
  'https://explorer.solana.com' : 
  `https://explorer.solana.com/?cluster=${NETWORK}`;

// Storage providers
export const IMGBB_API_KEY = process.env.IMGBB_API_KEY || '';
export const NFT_STORAGE_API_KEY = process.env.NFT_STORAGE_API_KEY || '';

// Utility function to get wallet path
export function getWalletPath(walletPath) {
  if (walletPath) {
    return path.resolve(walletPath);
  }
  
  // Check environment variable
  if (process.env.WALLET_PATH) {
    return path.resolve(process.env.WALLET_PATH);
  }
  
  // Check default locations
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const defaultWalletPath = path.join(homeDir, '.config', 'solana', 'id.json');
  
  if (fs.existsSync(defaultWalletPath)) {
    return defaultWalletPath;
  }
  
  throw new Error('Wallet keypair not found. Please provide a wallet path using --wallet option or WALLET_PATH environment variable.');
}

// Output paths
export const TOKEN_OUTPUT_DIR = path.resolve(__dirname, '..', 'token-outputs');
export const IMAGE_OUTPUT_DIR = path.resolve(__dirname, '..', 'image-uploads');

// Create directories if they don't exist
if (!fs.existsSync(TOKEN_OUTPUT_DIR)) {
  fs.mkdirSync(TOKEN_OUTPUT_DIR, { recursive: true });
}

if (!fs.existsSync(IMAGE_OUTPUT_DIR)) {
  fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });
} 