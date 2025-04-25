import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createMintToInstruction, getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createSignerFromKeypair } from "@metaplex-foundation/umi";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { getWalletPath, RPC_URL, EXPLORER_URL } from './config.js';
import fs from 'fs';
import chalk from 'chalk';

/**
 * Mint additional tokens to a token mint
 * @param {string} tokenMint - The mint address of the token
 * @param {string|number} amount - The amount to mint
 * @param {string} walletPath - Path to the wallet keypair file
 * @returns {Promise<Object>} Result of minting operation
 */
export async function mintTokens(tokenMint, amount, walletPath) {
  try {
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
    
    // Connect to Solana
    const connection = new Connection(RPC_URL);
    
    // Get mint information to determine the number of decimals
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(tokenMint));
    if (!mintInfo.value || !mintInfo.value.data) {
      throw new Error(`Failed to fetch mint information for ${tokenMint}`);
    }
    
    // Parse the data
    const parsedData = mintInfo.value.data;
    if (!('parsed' in parsedData)) {
      throw new Error(`Failed to parse mint data for ${tokenMint}`);
    }
    
    const decimals = parsedData.parsed.info.decimals;
    
    // Calculate the amount to mint with decimals
    const amountToMint = Number(amount) * (10 ** decimals);
    
    // Get the mint authority
    const mintAuthority = parsedData.parsed.info.mintAuthority;
    
    // Verify that this wallet is the mint authority
    if (mintAuthority !== userWallet.publicKey.toString()) {
      return {
        success: false,
        error: `The provided wallet is not the mint authority for this token. Only the mint authority can mint new tokens.`,
        details: `Expected: ${mintAuthority}, got: ${userWallet.publicKey}`
      };
    }
    
    // Get the user's associated token account for this mint
    const associatedTokenAddress = await getAssociatedTokenAddress(
      new PublicKey(tokenMint),
      userWallet.publicKey
    );
    
    // Create the mint transaction
    const transaction = new Transaction().add(
      createMintToInstruction(
        new PublicKey(tokenMint),
        associatedTokenAddress,
        userWallet.publicKey,
        BigInt(amountToMint),
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    // Set the recent blockhash and sign the transaction
    transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    transaction.feePayer = userWallet.publicKey;
    transaction.sign(userWallet);
    
    // Send the transaction
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    console.log(chalk.blue(`🔄 Waiting for transaction confirmation...`));
    await connection.confirmTransaction(signature);
    
    console.log(chalk.green(`✅ Successfully minted ${amount} tokens to ${tokenMint}`));
    
    return {
      success: true,
      signature,
      explorerUrl: `${EXPLORER_URL}/tx/${signature}`
    };
  } catch (error) {
    console.error(chalk.red(`\n❌ Error minting tokens: ${error.message}`));
    return {
      success: false,
      error: error.message
    };
  }
} 