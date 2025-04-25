import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { Connection, PublicKey } from '@solana/web3.js';
import { RPC_URL, TOKEN_OUTPUT_DIR, EXPLORER_URL } from './config.js';

/**
 * List all tokens created with this CLI
 * @param {boolean} verbose - Whether to show verbose details
 * @param {string} filter - Optional filter for token name/symbol
 * @returns {Promise<Array>} List of token details
 */
export async function listTokens(verbose = false, filter = '') {
  try {
    // Ensure output directory exists
    if (!fs.existsSync(TOKEN_OUTPUT_DIR)) {
      fs.mkdirSync(TOKEN_OUTPUT_DIR, { recursive: true });
    }
    
    // Get all token files
    const tokenFiles = fs.readdirSync(TOKEN_OUTPUT_DIR)
      .filter(file => file.endsWith('.json'));
    
    if (tokenFiles.length === 0) {
      console.log(chalk.yellow('No tokens found. Create a token first.'));
      return [];
    }
    
    // Load token details from files
    const tokens = [];
    
    for (const file of tokenFiles) {
      try {
        const tokenData = JSON.parse(fs.readFileSync(path.join(TOKEN_OUTPUT_DIR, file), 'utf8'));
        
        // Apply filter if specified
        if (filter && 
            !tokenData.name.toLowerCase().includes(filter.toLowerCase()) && 
            !tokenData.symbol.toLowerCase().includes(filter.toLowerCase())) {
          continue;
        }
        
        tokens.push(tokenData);
      } catch (error) {
        console.error(chalk.dim(`Error reading token file ${file}: ${error.message}`));
      }
    }
    
    // Sort tokens by creation date (newest first)
    tokens.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return dateB - dateA;
    });
    
    // Display tokens
    console.log(chalk.bold.white(`\nFound ${tokens.length} tokens:`));
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const tokenNumber = i + 1;
      
      console.log(chalk.white(`\n${tokenNumber}. ${chalk.cyan(token.name)} (${chalk.green(token.symbol)})`));
      console.log(chalk.white(`   Mint: ${chalk.yellow(token.mint)}`));
      
      if (verbose) {
        console.log(chalk.white(`   Decimals: ${token.decimals}`));
        console.log(chalk.white(`   Initial Supply: ${token.initialSupply}`));
        if (token.description) console.log(chalk.white(`   Description: ${token.description}`));
        if (token.imageUrl) console.log(chalk.white(`   Image URL: ${token.imageUrl}`));
        console.log(chalk.white(`   Created: ${new Date(token.createdAt).toLocaleString()}`));
        console.log(chalk.white(`   Explorer: ${token.explorerUrl || `${EXPLORER_URL}/address/${token.mint}`}`));
      }
    }
    
    console.log(''); // Empty line at the end
    
    return tokens;
  } catch (error) {
    console.error(chalk.red(`\n❌ Error listing tokens: ${error.message}`));
    return [];
  }
}

/**
 * Get detailed information about a token
 * @param {string} mintAddress - The token's mint address
 * @param {boolean} simulateOnly - Whether to only check local files without blockchain validation
 * @returns {Promise<Object>} Token details
 */
export async function getTokenDetails(mintAddress, simulateOnly = false) {
  try {
    // Try to find token in our records first
    const tokenFiles = fs.readdirSync(TOKEN_OUTPUT_DIR)
      .filter(file => file.endsWith('.json'));
    
    let localTokenInfo = null;
    
    for (const file of tokenFiles) {
      try {
        const tokenData = JSON.parse(fs.readFileSync(path.join(TOKEN_OUTPUT_DIR, file), 'utf8'));
        if (tokenData.mint === mintAddress) {
          localTokenInfo = tokenData;
          break;
        }
      } catch (error) {
        // Ignore errors reading individual files
      }
    }
    
    // If we found local token data and we're in simulate-only mode, return it
    if (localTokenInfo && simulateOnly) {
      console.log(chalk.yellow("⚠️ Note: This is a simulated token that does not exist on the blockchain."));
      return {
        mint: mintAddress,
        supply: localTokenInfo.initialSupply || 0,
        decimals: localTokenInfo.decimals || 9,
        ...localTokenInfo,
        isSimulated: true,
        explorerUrl: `${EXPLORER_URL}/address/${mintAddress}`
      };
    }
    
    // Connect to Solana network for blockchain data
    const connection = new Connection(RPC_URL);
    
    // Fetch token info from the blockchain
    let tokenInfo;
    try {
      tokenInfo = await connection.getTokenSupply(new PublicKey(mintAddress));
    } catch (error) {
      throw new Error(`Failed to fetch token info: ${error.message}`);
    }
    
    // Combine local and blockchain data
    return {
      mint: mintAddress,
      supply: tokenInfo.value.uiAmount,
      decimals: tokenInfo.value.decimals,
      ...localTokenInfo,
      explorerUrl: `${EXPLORER_URL}/address/${mintAddress}`
    };
  } catch (error) {
    console.error(chalk.red(`\n❌ Error getting token details: ${error.message}`));
    throw error;
  }
}

/**
 * Display detailed information about a token
 * @param {Object} tokenDetails - Token details to display
 */
export function displayTokenDetails(tokenDetails) {
  console.log(chalk.bold.white(`\n📋 Token Details for: ${chalk.cyan(tokenDetails.name || 'Unknown Token')}`));
  console.log(chalk.white(`Mint Address: ${chalk.yellow(tokenDetails.mint)}`));
  
  if (tokenDetails.symbol) {
    console.log(chalk.white(`Symbol: ${chalk.cyan(tokenDetails.symbol)}`));
  }
  
  console.log(chalk.white(`Decimals: ${tokenDetails.decimals}`));
  console.log(chalk.white(`Current Supply: ${tokenDetails.supply}`));
  
  if (tokenDetails.initialSupply) {
    console.log(chalk.white(`Initial Supply: ${tokenDetails.initialSupply}`));
  }
  
  if (tokenDetails.description) {
    console.log(chalk.white(`Description: ${tokenDetails.description}`));
  }
  
  if (tokenDetails.imageUrl) {
    console.log(chalk.white(`Image URL: ${tokenDetails.imageUrl}`));
  }
  
  if (tokenDetails.metadataAddress) {
    console.log(chalk.white(`Metadata Address: ${chalk.yellow(tokenDetails.metadataAddress)}`));
  }
  
  if (tokenDetails.createdAt) {
    console.log(chalk.white(`Created: ${new Date(tokenDetails.createdAt).toLocaleString()}`));
  }
  
  console.log(chalk.white(`Explorer URL: ${chalk.cyan(tokenDetails.explorerUrl)}`));
  
  console.log(''); // Empty line at the end
} 