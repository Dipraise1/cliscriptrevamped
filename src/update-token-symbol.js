#!/usr/bin/env node

import { PublicKey } from '@solana/web3.js';
import { 
  createSignerFromKeypair,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { getWalletPath, RPC_URL, EXPLORER_URL } from './config.js';
import fs from 'fs';
import chalk from 'chalk';

// Import mpl-token-metadata as CommonJS module
import * as mplTokenMetadata from "@metaplex-foundation/mpl-token-metadata";
const { findMetadataPda, updateMetadataAccountV2 } = mplTokenMetadata;

/**
 * Update the symbol for a token
 * @param {string} mintAddress - The mint address of the token
 * @param {string} newSymbol - The new symbol for the token
 * @param {string} walletPath - Path to the wallet keypair file
 * @returns {Promise<Object>} Result of update operation
 */
export async function updateTokenSymbol(mintAddress, newSymbol, walletPath) {
  try {
    // Validate inputs
    if (!mintAddress) {
      throw new Error('Mint address is required');
    }
    
    if (!newSymbol) {
      throw new Error('New symbol is required');
    }
    
    // Parse mint address
    const mint = new PublicKey(mintAddress);
    
    // Get the wallet keypair
    const walletKeyPath = getWalletPath(walletPath);
    console.log(chalk.blue(`🔑 Using wallet at: ${walletKeyPath}`));
    
    // Load wallet keypair
    let userWalletRaw;
    try {
      userWalletRaw = JSON.parse(fs.readFileSync(walletKeyPath, 'utf8'));
    } catch (error) {
      throw new Error(`Failed to read wallet keypair file: ${error.message}`);
    }
    
    // Initialize UMI
    const umi = createUmi(RPC_URL);
    
    // Create a keypair from the loaded wallet
    const userWallet = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(userWalletRaw));
    const userWalletSigner = createSignerFromKeypair(umi, userWallet);
    
    // Set up UMI with the user's identity and metadata program
    umi.use(signerIdentity(userWalletSigner));
    
    // Register the Token Metadata program
    try {
      umi.use(mplTokenMetadata.mplTokenMetadata());
    } catch (err) {
      console.warn(chalk.yellow(`Warning: Could not register Token Metadata program: ${err.message}`));
      console.warn(chalk.yellow("Continuing in simulation mode..."));
    }
    
    // Find the metadata PDA
    const [metadataAddress] = findMetadataPda(umi, { mint });
    console.log(chalk.blue(`🔍 Found metadata address: ${metadataAddress}`));
    
    // Update the metadata
    console.log(chalk.blue(`🔄 Updating token symbol to: ${newSymbol}`));
    const updateResult = await updateMetadataAccountV2(umi, {
      metadata: metadataAddress,
      updateAuthority: userWalletSigner,
      symbol: newSymbol,
      isMutable: true,
    }).sendAndConfirm(umi);
    
    console.log(chalk.green(`✅ Successfully updated token symbol!`));
    console.log(chalk.white(`🔍 Transaction: ${chalk.cyan(`${EXPLORER_URL}/tx/${updateResult.signature}`)}`));
    
    return {
      success: true,
      signature: updateResult.signature,
      metadataAddress: metadataAddress,
      explorerUrl: `${EXPLORER_URL}/tx/${updateResult.signature}`
    };
  } catch (error) {
    console.error(chalk.red(`\n❌ Error updating token symbol: ${error.message}`));
    if (error.logs) {
      console.error(chalk.dim("\nTransaction logs:"));
      console.error(chalk.dim(error.logs.join('\n')));
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// If script is run directly, execute the update
if (process.argv[1].endsWith('update-token-symbol.js')) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error(chalk.red('Usage: node update-token-symbol.js <token_mint_address> <new_symbol> [wallet_path]'));
    process.exit(1);
  }
  
  const mintAddress = args[0];
  const newSymbol = args[1];
  const walletPath = args[2] || null;
  
  updateTokenSymbol(mintAddress, newSymbol, walletPath)
    .then(result => {
      if (!result.success) {
        process.exit(1);
      }
    })
    .catch(error => {
      console.error(chalk.red(`\n❌ Fatal error: ${error.message}`));
      process.exit(1);
    });
} 