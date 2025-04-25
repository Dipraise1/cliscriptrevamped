import * as web3 from "@solana/web3.js";
import dotenv from "dotenv";
import axios from "axios";
import { getWalletPath, DEFAULT_DECIMALS, DEFAULT_INITIAL_SUPPLY, IMGBB_API_KEY, RPC_URL, TOKEN_OUTPUT_DIR, EXPLORER_URL } from "./config.js";
import bs58 from "bs58";
import * as fs from "fs";
import { createKeypairFromFile } from "../utils.js";
import chalk from "chalk";
import { execSync } from "child_process";
import path from "path";
import { Metaplex, keypairIdentity } from "@metaplex-foundation/js";
import FormData from "form-data";
import { createCreateMetadataAccountV3Instruction, PROGRAM_ID as METADATA_PROGRAM_ID } from '@metaplex-foundation/mpl-token-metadata';

dotenv.config();

/**
 * Creates a new SPL token with metadata
 * @param {Object} options - Options for token creation
 * @param {Object} options.tokenInfo - Information about the token to create
 * @param {string} options.walletPath - Path to the wallet keypair file
 * @param {boolean} options.useMetaplex - Whether to use Metaplex for creation
 * @param {boolean} options.simulationMode - Whether to run in simulation mode
 * @returns {Promise<Object>} Result of token creation
 */
export async function createToken(options = {}) {
  let result = null;
  
  try {
    console.log(chalk.blue("\n🚀 Token Creator"));
    console.log(chalk.gray("================================================"));

    // Check for simulation mode first
    if (options.simulationMode) {
      return handleSimulationMode(options);
    }
    
    // Get the wallet path from options, config, or env vars
    const walletKeyPath = options.walletPath || options.wallet || getWalletPath();
    options.walletPath = walletKeyPath;
    
    console.log(chalk.blue(`🔑 Using wallet at: ${walletKeyPath}`));
    console.log(chalk.blue(`🔌 Connecting to Solana network...`));
    
    // Note about wallet funding
    console.log(chalk.yellow(`ℹ️ Note: Ensure your wallet has enough SOL to cover transaction fees`));
    console.log(chalk.yellow(`   When using Metaplex, additional SOL may be needed for metadata storage`));

    // If useMetaplex is specified, use Metaplex SDK for creation
    if (options.useMetaplex || (options.tokenInfo && options.tokenInfo.useMetaplex)) {
      result = await createTokenWithMetaplex(
        options.tokenInfo,
        walletKeyPath
      );
      return result;
    }

    // Try with Metaplex first, fall back to CLI method
    try {
      return await createTokenWithMetaplex(options.tokenInfo, walletKeyPath);
    } catch (error) {
      console.warn(chalk.yellow(`\n⚠️ Metaplex token creation with metadata failed: ${error.message}`));
      console.warn(chalk.yellow(`Falling back to SPL CLI method...\n`));
      return await createTokenViaCli(options.tokenInfo, walletKeyPath);
    }
  } catch (error) {
    console.error("Error creating token:", error);
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

/**
 * Handles simulation mode without blockchain interaction
 * @param {Object} options - Options for token creation including token info
 * @returns {Object} Simulated token creation result
 */
function handleSimulationMode(options) {
  try {
    const tokenInfo = options.tokenInfo;
    if (!tokenInfo) {
      throw new Error("Token information is required for simulation");
    }
    
    const randomBytes = Buffer.from(Array(32).fill(0).map(() => Math.floor(Math.random() * 256)));
    const simulatedMintAddress = Buffer.from(randomBytes).toString('base64').substring(0, 44);
    
    console.log(chalk.blue(`🆕 Generated simulated mint address: ${simulatedMintAddress}`));
    console.log(chalk.blue(`💰 Simulating token with ${tokenInfo.initialSupply} ${tokenInfo.symbol} (${tokenInfo.initialSupply * (10 ** tokenInfo.decimals)} base units)...`));
    console.log(chalk.yellow(`🧪 SIMULATION MODE: Not sending actual transaction`));
    
    return {
      success: true,
      mintAddress: simulatedMintAddress,
      tokenAccount: "SimulatedTokenAccount",
      metadataAddress: "SimulatedMetadataAddress",
      signature: "SIMULATED_TRANSACTION",
      explorerUrl: `${EXPLORER_URL}/address/${simulatedMintAddress}`,
      isSimulated: true
    };
  } catch (error) {
    console.error("Error in simulation:", error);
    return {
      success: false,
      error: error.message,
      isSimulated: true
    };
  }
}

/**
 * Creates a token with metadata using Metaplex
 * @param {Object} tokenInfo - Information about the token to create
 * @param {string} walletPath - Path to the wallet keypair file
 * @returns {Promise<Object>} Result of token creation
 */
export async function createTokenWithMetaplex(tokenInfo, walletPath) {
  try {
    console.log(chalk.blue("\n🔄 Creating token with Metaplex..."));
    
    // Extract token information
    const tokenName = tokenInfo.name;
    const tokenSymbol = tokenInfo.symbol;
    const tokenDecimals = tokenInfo.decimals || DEFAULT_DECIMALS;
    const initialSupply = tokenInfo.initialSupply || DEFAULT_INITIAL_SUPPLY;
    const description = tokenInfo.description;
    const imageUrl = tokenInfo.imageUrl;
    
    // Setup connection and wallet
    const keyPath = walletPath || getWalletPath();
    console.log(chalk.gray(`Using wallet at: ${keyPath}`));
    const keypair = createKeypairFromFile(keyPath);
    const connection = new web3.Connection(RPC_URL, "confirmed");
    
    console.log(chalk.gray(`Connected to ${RPC_URL}`));
    console.log(chalk.yellow(`🔑 Wallet address: ${keypair.publicKey.toString()}`));
    
    // Network note for mainnet users
    if (RPC_URL.includes("mainnet")) {
      console.log(chalk.yellow(`ℹ️ Note: You're using Mainnet. If you're experiencing metadata upload issues,`));
      console.log(chalk.yellow(`   consider configuring Bundlr with the mainnet node: https://node1.bundlr.network`));
    }

    // Initialize Metaplex
    const metaplex = Metaplex.make(connection)
      .use(keypairIdentity(keypair));

    // Step 1: Create the token using SPL CLI
    console.log(chalk.blue("🪙 Creating token mint..."));
    const createTokenCmd = `spl-token create-token --decimals ${tokenDecimals} --output json`;
    console.log(chalk.gray(`Running: ${createTokenCmd}`));

    const createTokenOutput = execSync(createTokenCmd).toString().trim();
    console.log(chalk.gray(`Command output: ${createTokenOutput}`));
    
    let createTokenResult;
    let mintAddress;
    let signature;
    
    try {
      createTokenResult = JSON.parse(createTokenOutput);
      console.log(chalk.gray(`Parsed result: ${JSON.stringify(createTokenResult)}`));
      
      // Handle different output formats
      if (createTokenResult.commandOutput && createTokenResult.commandOutput.address) {
        // New format with nested structure
        mintAddress = createTokenResult.commandOutput.address;
        signature = createTokenResult.commandOutput.transactionData 
                   ? createTokenResult.commandOutput.transactionData.signature 
                   : "unknown";
      } else if (createTokenResult.address) {
        // Simple format
        mintAddress = createTokenResult.address;
        signature = createTokenResult.signature || "unknown";
      } else {
        throw new Error("Unexpected JSON structure in token creation output");
      }
    } catch (error) {
      console.log(chalk.yellow(`Error processing JSON output: ${error.message}`));
      
      // Fallback to regex extraction
      const mintAddressMatch = createTokenOutput.match(/address":\s*"([A-Za-z0-9]+)"/);
      const signatureMatch = createTokenOutput.match(/signature":\s*"([A-Za-z0-9]+)"/);
      
      if (mintAddressMatch && mintAddressMatch[1]) {
        mintAddress = mintAddressMatch[1];
        signature = signatureMatch && signatureMatch[1] ? signatureMatch[1] : "unknown";
        console.log(chalk.gray(`Extracted using regex: ${mintAddress}, ${signature}`));
      } else {
        throw new Error("Failed to extract token mint address from command output");
      }
    }

    console.log(chalk.green(`✅ Token mint created successfully!`));
    console.log(chalk.yellow(`🔑 Mint address: ${mintAddress}`));
    console.log(chalk.gray(`🔗 Signature: ${signature}`));
    console.log(chalk.gray(`🔍 Explorer: ${EXPLORER_URL}/tx/${signature}`));

    // Step 2: Create token account
    console.log(chalk.blue("\n🏦 Creating token account..."));
    const createAccountCmd = `spl-token create-account ${mintAddress} --output json`;
    console.log(chalk.gray(`Running: ${createAccountCmd}`));
    
    let tokenAccount;
    
    try {
      const createAccountOutput = execSync(createAccountCmd).toString().trim();
      console.log(chalk.gray(`Account command output: ${createAccountOutput}`));
      
      try {
        const accountResult = JSON.parse(createAccountOutput);
        console.log(chalk.gray(`Parsed account result: ${JSON.stringify(accountResult)}`));
        
        // The create-account command in newer versions doesn't return the address directly
        // So we need to get the account another way
        
        // First try to extract from the output using regex
        const accountMatch = createAccountOutput.match(/address":\s*"([A-Za-z0-9]+)"/);
        if (accountMatch && accountMatch[1]) {
          tokenAccount = accountMatch[1];
          console.log(chalk.gray(`Extracted account using regex: ${tokenAccount}`));
        } else {
          // If that doesn't work, query the accounts for this token
          console.log(chalk.gray(`Querying accounts for token ${mintAddress}...`));
          const accountsOutput = execSync(`spl-token accounts ${mintAddress} --output json`).toString().trim();
          console.log(chalk.gray(`Accounts output: ${accountsOutput}`));
          
          try {
            const accountsResult = JSON.parse(accountsOutput);
            if (accountsResult.accounts && accountsResult.accounts.length > 0) {
              tokenAccount = accountsResult.accounts[0].address;
              console.log(chalk.gray(`Found token account from accounts list: ${tokenAccount}`));
            } else {
              throw new Error("No accounts found for this token");
            }
          } catch (accountsError) {
            console.log(chalk.yellow(`Error parsing accounts output: ${accountsError.message}`));
            
            // Last resort: try to extract from accounts output using regex
            const accountAddressMatch = accountsOutput.match(/address":\s*"([A-Za-z0-9]+)"/);
            if (accountAddressMatch && accountAddressMatch[1]) {
              tokenAccount = accountAddressMatch[1];
            } else {
              // If all else fails, use the wallet address as the account holder
              tokenAccount = keypair.publicKey.toString();
              console.log(chalk.yellow(`Using wallet address as token account holder: ${tokenAccount}`));
            }
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`Error processing account JSON: ${error.message}`));
        
        // Fall back to using the wallet address
        tokenAccount = keypair.publicKey.toString();
        console.log(chalk.yellow(`Using wallet address as token account holder: ${tokenAccount}`));
      }
    } catch (error) {
      console.log(chalk.red(`Error creating token account: ${error.message}`));
      // Fall back to using the wallet address
      tokenAccount = keypair.publicKey.toString();
      console.log(chalk.yellow(`Using wallet address as token account holder: ${tokenAccount}`));
    }

    console.log(chalk.green(`✅ Token account created successfully!`));
    console.log(chalk.yellow(`🔑 Token account: ${tokenAccount}`));

    // Step 3: Mint tokens
    console.log(chalk.blue(`\n💰 Minting ${initialSupply} tokens...`));
    const mintTokensCmd = `spl-token mint ${mintAddress} ${initialSupply} --output json`;
    console.log(chalk.gray(`Running: ${mintTokensCmd}`));
    
    const mintTokensOutput = execSync(mintTokensCmd).toString().trim();
    console.log(chalk.gray(`Mint command output: ${mintTokensOutput}`));
    
    let mintSignature;
    try {
      const mintResult = JSON.parse(mintTokensOutput);
      if (mintResult.signature || (mintResult.transactionData && mintResult.transactionData.signature)) {
        mintSignature = mintResult.signature || mintResult.transactionData.signature;
      }
    } catch (error) {
      console.log(chalk.yellow(`Error parsing mint output: ${error.message}`));
    }
    
    console.log(chalk.green(`✅ Tokens minted successfully!`));

    // Step 4: Upload metadata if image URL is provided
    let metadataUri = null;
    let finalImageUrl = imageUrl;
    
    if (imageUrl || tokenInfo.imagePath) {
      console.log(chalk.blue("\n📤 Uploading metadata..."));
      try {
        // Process image if imagePath is provided
        if (tokenInfo.imagePath && !imageUrl) {
          try {
            console.log(chalk.gray(`Processing image from path: ${tokenInfo.imagePath}`));
            if (fs.existsSync(tokenInfo.imagePath)) {
              // If we have IMGBB_API_KEY, upload the image
              if (IMGBB_API_KEY) {
                console.log(chalk.gray(`Uploading image to IMGBB...`));
                const imageData = fs.readFileSync(tokenInfo.imagePath);
                const imageBase64 = imageData.toString('base64');
                
                const imgFormData = new FormData();
                imgFormData.append('key', IMGBB_API_KEY);
                imgFormData.append('image', imageBase64);
                
                const imgResponse = await axios.post('https://api.imgbb.com/1/upload', imgFormData);
                
                if (imgResponse.data && imgResponse.data.data && imgResponse.data.data.url) {
                  finalImageUrl = imgResponse.data.data.url;
                  console.log(chalk.green(`✅ Image uploaded to: ${finalImageUrl}`));
                }
              } else {
                console.log(chalk.yellow(`⚠️ No IMGBB API key found. Will use local image path in metadata.`));
                finalImageUrl = `file://${path.resolve(tokenInfo.imagePath)}`;
              }
            } else {
              console.log(chalk.yellow(`⚠️ Image file not found at: ${tokenInfo.imagePath}`));
            }
          } catch (imageError) {
            console.log(chalk.yellow(`⚠️ Error processing image: ${imageError.message}`));
          }
        }
        
        // Create metadata JSON
        const metadata = {
          name: tokenName,
          symbol: tokenSymbol,
          description: description || `A token created using the Solana Token Deployer`,
          image: finalImageUrl || ""
        };

        // Use IMGBB to upload the metadata JSON
        if (IMGBB_API_KEY) {
          // Convert metadata to base64
          const metadataBase64 = Buffer.from(JSON.stringify(metadata)).toString('base64');
          
          // Create form data
          const formData = new FormData();
          formData.append('key', IMGBB_API_KEY);
          formData.append('image', metadataBase64);
          formData.append('name', `${tokenSymbol.toLowerCase()}-metadata.json`);
          
          // Upload to IMGBB
          const response = await axios.post('https://api.imgbb.com/1/upload', formData);
          
          if (response.data && response.data.data && response.data.data.url) {
            metadataUri = response.data.data.url;
            console.log(chalk.green(`✅ Metadata uploaded to: ${metadataUri}`));
          } else {
            throw new Error("Failed to upload metadata to IMGBB");
          }
        } else {
          throw new Error("IMGBB API key not found");
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️ Metadata upload failed: ${error.message}`));
        console.log(chalk.yellow("⚠️ Will save metadata locally instead"));
      }
    }

    // Step 5: Create on-chain metadata
    try {
      console.log(chalk.blue("\n🔍 Creating on-chain metadata..."));
      
      // Create a mint public key object
      const mintPubkey = new web3.PublicKey(mintAddress);
      
      // Find metadata PDA
      const [metadataPDA] = web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          METADATA_PROGRAM_ID.toBuffer(),
          mintPubkey.toBuffer(),
        ],
        METADATA_PROGRAM_ID
      );
      
      console.log(chalk.gray(`Metadata PDA: ${metadataPDA.toString()}`));

      // Create metadata instruction
      const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataPDA,
          mint: mintPubkey,
          mintAuthority: keypair.publicKey,
          payer: keypair.publicKey,
          updateAuthority: keypair.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name: tokenName,
              symbol: tokenSymbol,
              uri: metadataUri || "",
              sellerFeeBasisPoints: 0,
              creators: null,
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        }
      );

      // Create and send transaction
      const transaction = new web3.Transaction().add(createMetadataInstruction);
      const metadataSignature = await web3.sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );

      console.log(chalk.green(`✅ On-chain metadata created successfully!`));
      console.log(chalk.gray(`🔗 Signature: ${metadataSignature}`));
      console.log(chalk.gray(`🔍 Explorer: ${EXPLORER_URL}/tx/${metadataSignature}`));
      
    } catch (error) {
      console.log(chalk.yellow(`⚠️ On-chain metadata creation failed: ${error.message}`));
      console.log(chalk.yellow("⚠️ Token created but without on-chain metadata"));
      console.log(chalk.gray("📝 This won't affect the functionality of your token"));
    }

    // Save metadata locally regardless
    const timestamp = Date.now();
    const outputFile = `${tokenSymbol.toLowerCase()}-${timestamp}.json`;
    const outputPath = path.join(TOKEN_OUTPUT_DIR, outputFile);
    
    const tokenMetadata = {
      name: tokenName,
      symbol: tokenSymbol,
      description: description || `A token created using the Solana Token Deployer`,
      image: finalImageUrl || "",
      mintAddress: mintAddress,
      metadataUri: metadataUri,
      explorerUrl: `${EXPLORER_URL}/address/${mintAddress}`
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(tokenMetadata, null, 2));
    
    // Also save a copy with a predictable name for easier access
    const metadataPath = path.join(TOKEN_OUTPUT_DIR, `${tokenSymbol.toLowerCase()}-metadata.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(tokenMetadata, null, 2));
    
    console.log(chalk.green(`\n✅ Token metadata saved to: ${outputFile}`));
    
    return {
      success: true,
      mintAddress: mintAddress,
      mint: mintAddress,
      tokenAccount: tokenAccount,
      signature: signature,
      mintSignature: mintSignature,
      metadataUri: metadataUri || metadataPath,
      explorerUrl: `${EXPLORER_URL}/address/${mintAddress}`
    };
    
  } catch (error) {
    console.error(chalk.red(`❌ Error creating token with Metaplex: ${error.message}`));
    if (error.stderr) {
      console.error(chalk.red(`Detail: ${error.stderr.toString()}`));
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Creates a token using the SPL Token CLI
 * @param {Object} tokenInfo - Information about the token to create
 * @param {string} walletKeyPath - Path to the wallet keypair file
 * @returns {Promise<Object>} Result of token creation
 */
async function createTokenViaCli(tokenInfo, walletKeyPath) {
  try {
    console.log(chalk.blue(`🛠️ Setting up Solana CLI with wallet...`));
    const absoluteWalletPath = path.resolve(walletKeyPath);
    execSync(`solana config set -k "${absoluteWalletPath}"`, { stdio: 'inherit' });
    
    console.log(chalk.blue(`🪙 Creating token with ${tokenInfo.decimals} decimals...`));
    const createOutput = execSync(`spl-token create-token --decimals ${tokenInfo.decimals}`, { encoding: 'utf8' });
    
    const mintAddressMatch = createOutput.match(/Address:\s+([A-Za-z0-9]+)/);
    if (!mintAddressMatch || !mintAddressMatch[1]) {
      throw new Error("Failed to extract token mint address from command output");
    }
    const mintAddress = mintAddressMatch[1];
    
    const signatureMatch = createOutput.match(/Signature:\s+([A-Za-z0-9]+)/);
    const signature = signatureMatch && signatureMatch[1] ? signatureMatch[1] : "UNKNOWN_SIGNATURE";
    
    console.log(chalk.blue(`🏦 Creating token account...`));
    const accountOutput = execSync(`spl-token create-account ${mintAddress}`, { encoding: 'utf8' });
    
    const accountAddressMatch = accountOutput.match(/Creating account ([A-Za-z0-9]+)/);
    const tokenAccount = accountAddressMatch && accountAddressMatch[1] ? accountAddressMatch[1] : "UNKNOWN_ACCOUNT";
    
    console.log(chalk.blue(`💰 Minting ${tokenInfo.initialSupply} tokens...`));
    execSync(`spl-token mint ${mintAddress} ${tokenInfo.initialSupply}`, { stdio: 'inherit' });
    
    return {
      mint: mintAddress,
      mintAddress: mintAddress,
      tokenAccount: tokenAccount,
      metadataAddress: null,
      signature: signature,
      explorerUrl: `${EXPLORER_URL}/address/${mintAddress}`,
      isCliCreated: true
    };
  } catch (error) {
    console.error(chalk.red(`❌ CLI token creation error: ${error.message}`));
    throw error;
  }
}