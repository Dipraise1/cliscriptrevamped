#!/usr/bin/env node

import { getTokenInfo } from './src/fetch-info.js';
import { createToken } from './src/token-creator.js';
import { listTokens, getTokenDetails, displayTokenDetails } from './src/token-viewer.js';
import { mintTokens } from './src/mint-tokens.js';
import { uploadImage } from './src/image-uploader.js';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { NETWORK } from './src/config.js';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ASCII art logo
const asciiLogo = `
   ███████╗ ██████╗ ██╗      █████╗ ███╗   ██╗ █████╗ 
   ██╔════╝██╔═══██╗██║     ██╔══██╗████╗  ██║██╔══██╗
   ███████╗██║   ██║██║     ███████║██╔██╗ ██║███████║
   ╚════██║██║   ██║██║     ██╔══██║██║╚██╗██║██╔══██║
   ███████║╚██████╔╝███████╗██║  ██║██║ ╚████║██║  ██║
   ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
                                      
   ████████╗ ██████╗ ██╗  ██╗███████╗███╗   ██╗      
   ╚══██╔══╝██╔═══██╗██║ ██╔╝██╔════╝████╗  ██║      
      ██║   ██║   ██║█████╔╝ █████╗  ██╔██╗ ██║      
      ██║   ██║   ██║██╔═██╗ ██╔══╝  ██║╚██╗██║      
      ██║   ╚██████╔╝██║  ██╗███████╗██║ ╚████║      
      ╚═╝    ╚═════╝ ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝      
                                                      
   ██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗███████╗██████╗ 
   ██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝██╔════╝██╔══██╗
   ██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ █████╗  ██████╔╝
   ██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  ██╔══╝  ██╔══██╗
   ██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║   ███████╗██║  ██║
   ╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚══════╝╚═╝  ╚═╝
   
                                                 v1.0.0
`;

async function main() {
  // Print colored ASCII logo
  console.log(chalk.cyan(asciiLogo));

  // Print welcome message
  console.log(chalk.bold.white("Welcome to the Solana Token Deployer CLI"));
  console.log(chalk.white("A powerful tool for creating and managing SPL tokens on Solana\n"));

  // Print running environment
  console.log(chalk.bold.yellow(`🔗 Network: ${chalk.white(NETWORK.toUpperCase())}`));
  console.log(chalk.bold.yellow(`📅 Time: ${chalk.white(new Date().toLocaleString())}\n`));

  try {
    // Check for command line arguments
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      printHelp();
      return;
    }
    
    // Check for token view command
    if (args.includes('view')) {
      await handleViewToken(args);
      return;
    }
    
    // Check for token list command
    if (args.includes('list')) {
      await handleListTokens(args);
      return;
    }

    // Check for mint tokens command
    if (args.includes('mint')) {
      await handleMintTokens(args);
      return;
    }

    // Check for upload image command
    if (args.includes('upload-image')) {
      await handleImageUpload(args);
      return;
    }

    // Check for update URI command
    if (args.includes('update-uri')) {
      await handleUpdateTokenUri(args);
      return;
    }

    // Check for update name command
    if (args.includes('update-name')) {
      await handleUpdateTokenName(args);
      return;
    }

    // Check for update symbol command
    if (args.includes('update-symbol')) {
      await handleUpdateTokenSymbol(args);
      return;
    }

    // Continue with token creation flow
    let tokenInfo;
    
    // Check if we're in simulation mode
    const simulationMode = args.includes('--simulate') || args.includes('-s');
    if (simulationMode) {
      console.log(chalk.bgYellow.black("\n🧪 SIMULATION MODE ENABLED"));
      console.log(chalk.yellow("No actual blockchain transactions will be made\n"));
    }

    // Check if configuration file is specified
    const configIndex = args.indexOf('--config');
    if (configIndex !== -1 && args.length > configIndex + 1) {
      const configFile = args[configIndex + 1];
      console.log(chalk.blue(`📄 Loading configuration from: ${chalk.white(configFile)}`));
      
      try {
        const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        tokenInfo = configData;
        console.log(chalk.green("✅ Configuration loaded successfully.\n"));
      } catch (error) {
        console.error(chalk.red(`❌ Error loading configuration file: ${error.message}`));
        console.log(chalk.yellow("Falling back to interactive mode...\n"));
      }
    }

    // If no config file or it failed to load, use interactive mode
    if (!tokenInfo) {
      console.log(chalk.blue("🔍 Please provide details for your new token:"));
      tokenInfo = await getTokenInfo();
      
      if (!tokenInfo.name) {
        console.log(chalk.yellow("Token creation cancelled."));
        return;
      }
    }
    
    // Display token details
    console.log(chalk.bold.white("\n📝 Token details:"));
    console.log(chalk.white(`• Name: ${chalk.cyan(tokenInfo.name)}`));
    console.log(chalk.white(`• Symbol: ${chalk.cyan(tokenInfo.symbol)}`));
    console.log(chalk.white(`• Decimals: ${chalk.cyan(tokenInfo.decimals)}`));
    console.log(chalk.white(`• Initial Supply: ${chalk.cyan(tokenInfo.initialSupply)}`));
    if (tokenInfo.imageUrl) console.log(chalk.white(`• Image URL: ${chalk.cyan(tokenInfo.imageUrl)}`));
    if (tokenInfo.description) console.log(chalk.white(`• Description: ${chalk.cyan(tokenInfo.description)}`));
    console.log();

    // Confirm if user wants to proceed
    if (!args.includes('--yes') && !args.includes('-y')) {
      const { proceed } = await getConfirmation();
      if (!proceed) {
        console.log(chalk.yellow("Token creation cancelled."));
        return;
      }
    }

    // Create and mint the token
    console.log(chalk.blue("\n🔨 Creating token..."));
    
    const options = {
      tokenInfo: tokenInfo,
      walletPath: process.env.WALLET_PATH,
      simulationMode: simulationMode,
      useMetaplex: true
    };
    
    const result = await createToken(options);
    
    const mint = result.mintAddress || result.mint;
    
    console.log(chalk.bold.green("\n✅ Token created successfully!"));
    console.log(chalk.white(`📌 Mint Address: ${chalk.cyan(mint || "Not available")}`));
    
    if (result.explorerUrl) {
      console.log(chalk.white(`🔍 View on Solana Explorer: ${chalk.cyan(result.explorerUrl)}`));
    } else if (mint) {
      console.log(chalk.white(`🔍 View on Solana Explorer: ${chalk.cyan(`${EXPLORER_URL}/address/${mint}`)}`));
    }
    
    // Display metadata information
    console.log(chalk.bold.white("\n📋 Token Metadata:"));
    console.log(chalk.white(`• Token will appear as ${chalk.cyan(tokenInfo.symbol)} with name ${chalk.cyan(tokenInfo.name)} in explorers`));
    
    if (result.metadataAddress) {
      console.log(chalk.white(`• Metadata Address: ${chalk.cyan(result.metadataAddress)}`));
    } else {
      console.log(chalk.yellow(`• Metadata creation encountered an issue, but your token is still valid.`));
      console.log(chalk.yellow(`• Your token may appear with address instead of name in some explorers.`));
    }
    
    if (!simulationMode) {
      console.log(chalk.yellow(`\nℹ️ Note: It may take a few minutes for the token to appear with its name in explorers.`));
    }

    // Save token details to file
    const outputDir = './token-outputs';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    
    const outputFile = path.join(outputDir, `${tokenInfo.symbol.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`);
    const outputData = {
      ...tokenInfo,
      mint: mint || null,
      transaction: result.signature || null,
      createdAt: new Date().toISOString(),
      explorerUrl: result.explorerUrl || (mint ? `${EXPLORER_URL}/address/${mint}` : null),
      metadataAddress: result.metadataAddress || result.metadataPDA || null,
      metadataUri: result.metadataUri || ""
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
    console.log(chalk.white(`💾 Token details saved to: ${chalk.cyan(outputFile)}`));
    
    console.log(chalk.bold.green("\n🎉 All operations completed successfully!"));
    
  } catch (error) {
    console.error(chalk.bold.red("\n❌ Error encountered:"));
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.dim("\nStack trace:"));
      console.error(chalk.dim(error.stack));
    }
    process.exit(1);
  }
}

/**
 * Handle the token list command
 * @param {string[]} args - Command line arguments
 */
async function handleListTokens(args) {
  const verbose = args.includes('--verbose') || args.includes('-v');
  
  // Check for filter argument
  let filter = '';
  const filterIndex = args.indexOf('--filter');
  if (filterIndex !== -1 && args.length > filterIndex + 1) {
    filter = args[filterIndex + 1];
    console.log(chalk.blue(`🔍 Filtering tokens with: ${chalk.cyan(filter)}`));
  }
  
  await listTokens(verbose, filter);
}

/**
 * Handle the token view command
 * @param {string[]} args - Command line arguments
 */
async function handleViewToken(args) {
  const viewIndex = args.indexOf('view') + 1;
  
  if (args.length <= viewIndex) {
    console.error(chalk.red("❌ Please provide a token mint address or index."));
    console.log(chalk.blue("Usage: solana-token view <MINT_ADDRESS_OR_INDEX>"));
    return;
  }
  
  const identifier = args[viewIndex];
  const simulateOnly = args.includes('--simulate');
  
  // Check if the identifier is a number (index) or a string (mint address)
  if (/^\d+$/.test(identifier)) {
    // It's an index, get the list of tokens
    const tokens = await listTokens(false);
    const index = parseInt(identifier) - 1;
    
    if (index < 0 || index >= tokens.length) {
      console.error(chalk.red(`❌ Invalid token index. Please choose between 1 and ${tokens.length}`));
      return;
    }
    
    const token = tokens[index];
    const tokenDetails = await getTokenDetails(token.mint, simulateOnly);
    displayTokenDetails(tokenDetails);
  } else {
    // It's a mint address
    try {
      const tokenDetails = await getTokenDetails(identifier, simulateOnly);
      displayTokenDetails(tokenDetails);
    } catch (error) {
      console.error(chalk.red(`❌ Failed to get token details: ${error.message}`));
    }
  }
}

/**
 * Handle the mint tokens command
 * @param {string[]} args - Command line arguments
 */
async function handleMintTokens(args) {
  const mintIndex = args.indexOf('mint') + 1;
  
  if (args.length <= mintIndex) {
    console.error(chalk.red("❌ Please provide a token mint address."));
    console.log(chalk.blue("Usage: solana-token mint <TOKEN_MINT_ADDRESS> <AMOUNT> [--wallet <WALLET_PATH>]"));
    return;
  }
  
  const tokenMint = args[mintIndex];
  
  // Check if amount is provided
  if (args.length <= mintIndex + 1) {
    console.error(chalk.red("❌ Please provide an amount to mint."));
    console.log(chalk.blue("Usage: solana-token mint <TOKEN_MINT_ADDRESS> <AMOUNT> [--wallet <WALLET_PATH>]"));
    return;
  }
  
  const amount = args[mintIndex + 1];
  
  // Check for wallet path
  let walletPath = null;
  const walletIndex = args.indexOf('--wallet');
  if (walletIndex !== -1 && args.length > walletIndex + 1) {
    walletPath = args[walletIndex + 1];
  }
  
  console.log(chalk.blue(`\n🪙 Minting ${chalk.cyan(amount)} tokens to mint ${chalk.cyan(tokenMint)}...`));
  
  try {
    const result = await mintTokens(tokenMint, amount, walletPath);
    
    if (result.success) {
      console.log(chalk.bold.green("\n🎉 Token minting completed successfully!"));
      console.log(chalk.white(`🔍 View on Solana Explorer: ${chalk.cyan(result.explorerUrl)}`));
    } else {
      console.error(chalk.bold.red("\n❌ Failed to mint tokens."));
      if (result.error) {
        console.error(chalk.red(result.error));
      }
    }
  } catch (error) {
    console.error(chalk.bold.red("\n❌ Error encountered while minting tokens:"));
    console.error(chalk.red(error.message));
  }
}

/**
 * Handle the image upload command
 * @param {string[]} args - Command line arguments
 */
async function handleImageUpload(args) {
  const uploadIndex = args.indexOf('upload-image') + 1;
  
  if (args.length <= uploadIndex) {
    console.error(chalk.red("❌ Please provide a path to the image file."));
    console.log(chalk.blue("Usage: solana-token upload-image <IMAGE_PATH>"));
    return;
  }
  
  const imagePath = args[uploadIndex];
  
  try {
    console.log(chalk.blue(`\n🖼️ Uploading image: ${chalk.cyan(imagePath)}...`));
    const result = await uploadImage(imagePath);
    
    if (result.success) {
      console.log(chalk.bold.green("\n✅ Image uploaded successfully!"));
      console.log(chalk.white(`📌 Image URL: ${chalk.cyan(result.url)}`));
      
      // Save the URL to a file for easy access
      const outputDir = './image-uploads';
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
      }
      
      const filename = path.basename(imagePath);
      const outputFile = path.join(outputDir, `${filename.split('.')[0]}-${Date.now()}.json`);
      
      fs.writeFileSync(outputFile, JSON.stringify({
        originalFile: imagePath,
        url: result.url,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      console.log(chalk.white(`💾 Image URL saved to: ${chalk.cyan(outputFile)}`));
    } else {
      console.error(chalk.bold.red("\n❌ Failed to upload image."));
      if (result.error) {
        console.error(chalk.red(result.error));
      }
    }
  } catch (error) {
    console.error(chalk.bold.red("\n❌ Error encountered while uploading image:"));
    console.error(chalk.red(error.message));
  }
}

async function handleUpdateTokenUri(args) {
  try {
    // Remove the command name from args
    const filteredArgs = args.filter(arg => arg !== 'update-uri');
    
    if (filteredArgs.length < 2) {
      console.log(chalk.red('Usage: solana-token update-uri <token_mint_address> <new_uri>'));
      console.log('Example: solana-token update-uri EMBxqSXtEKFHcGzpWRjXba9XpXL15JMwiTRBwQ7w4TQT "https://arweave.net/new-metadata-uri"');
      return;
    }
    
    const mintAddress = filteredArgs[0];
    // Join the remaining args as the URI (in case it has spaces)
    const newUri = filteredArgs.slice(1).join(' ');
    
    // Execute the script with the arguments
    const scriptPath = path.join(__dirname, 'src', 'update-token-uri.js');
    const cmd = `node ${scriptPath} ${mintAddress} "${newUri}"`;
    
    console.log(chalk.blue(`🔄 Executing: ${cmd}`));
    execSync(cmd, { stdio: 'inherit' });
    
  } catch (error) {
    console.error(chalk.bold.red("\n❌ Error updating token URI:"));
    console.error(chalk.red(error.message));
  }
}

async function handleUpdateTokenName(args) {
  try {
    // Remove the command name from args
    const filteredArgs = args.filter(arg => arg !== 'update-name');
    
    if (filteredArgs.length < 2) {
      console.log(chalk.red('Usage: solana-token update-name <token_mint_address> <new_name>'));
      console.log('Example: solana-token update-name EMBxqSXtEKFHcGzpWRjXba9XpXL15JMwiTRBwQ7w4TQT "Solana Token"');
      return;
    }
    
    const mintAddress = filteredArgs[0];
    // Join the remaining args as the name (in case it has spaces)
    const newName = filteredArgs.slice(1).join(' ');
    
    // Execute the script with the arguments
    const scriptPath = path.join(__dirname, 'src', 'update-token-name.js');
    const cmd = `node ${scriptPath} ${mintAddress} "${newName}"`;
    
    console.log(chalk.blue(`🔄 Executing: ${cmd}`));
    execSync(cmd, { stdio: 'inherit' });
    
  } catch (error) {
    console.error(chalk.bold.red("\n❌ Error updating token name:"));
    console.error(chalk.red(error.message));
  }
}

async function handleUpdateTokenSymbol(args) {
  try {
    // Remove the command name from args
    const filteredArgs = args.filter(arg => arg !== 'update-symbol');
    
    if (filteredArgs.length < 2) {
      console.log(chalk.red('Usage: solana-token update-symbol <token_mint_address> <new_symbol>'));
      console.log('Example: solana-token update-symbol EMBxqSXtEKFHcGzpWRjXba9XpXL15JMwiTRBwQ7w4TQT "SOL"');
      return;
    }
    
    const mintAddress = filteredArgs[0];
    // Join the remaining args as the symbol (in case it has spaces)
    const newSymbol = filteredArgs.slice(1).join(' ');
    
    // Execute the script with the arguments
    const scriptPath = path.join(__dirname, 'src', 'update-token-symbol.js');
    const cmd = `node ${scriptPath} ${mintAddress} "${newSymbol}"`;
    
    console.log(chalk.blue(`🔄 Executing: ${cmd}`));
    execSync(cmd, { stdio: 'inherit' });
    
  } catch (error) {
    console.error(chalk.bold.red("\n❌ Error updating token symbol:"));
    console.error(chalk.red(error.message));
  }
}

async function getConfirmation() {
  const prompts = (await import('prompts')).default;
  return prompts({
    type: 'confirm',
    name: 'proceed',
    message: 'Do you want to proceed with token creation?',
    initial: true
  });
}

function printHelp() {
  console.log(chalk.bold.white("\nSolana Token Deployer CLI - Help"));
  console.log("\nUsage: solana-token [COMMAND] [OPTIONS]");
  
  console.log("\nCommands:");
  console.log("  (no command)    Interactive token creation wizard");
  console.log("  list            List all tokens created with this CLI");
  console.log("  view <address>  View details of a specific token");
  console.log("  mint <address> <amount>  Mint additional tokens to a token mint");
  console.log("  upload-image <path>  Upload an image to IPFS or similar storage");
  console.log("  update-uri <address> <new_uri>  Update a token's metadata URI");
  console.log("  update-name <address> <new_name>  Update a token's name");
  console.log("  update-symbol <address> <new_symbol>  Update a token's symbol");
  
  console.log("\nToken Creation Options:");
  console.log("  --config <path>  Path to token configuration JSON file");
  console.log("  --simulate, -s   Simulate token creation without making actual transactions");
  console.log("  --yes, -y        Skip confirmation prompt");
  
  console.log("\nList Options:");
  console.log("  --verbose, -v    Show verbose token details");
  console.log("  --filter <text>  Filter tokens by name or symbol");
  
  console.log("\nMint Options:");
  console.log("  --wallet <path>  Path to wallet keypair JSON file");
  
  console.log("\nGeneral Options:");
  console.log("  --help, -h       Show this help message");
  console.log();
}

main().catch(console.error); 