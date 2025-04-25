# Solana Token Deployer CLI

A powerful command-line tool for creating and managing SPL tokens on Solana.

## Features

- Create SPL tokens with metadata
- Mint additional tokens to existing mints
- View token details and balances
- Upload images for token metadata
- Update token metadata (name, symbol, URI)
- Support for both devnet and mainnet

## Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Copy `.env.example` to `.env` and configure your environment variables

## Usage

```bash
# Create a new token (interactive mode)
node index.js

# Create a token with specific parameters
node index.js create --name "My Token" --symbol "MYTKN" --decimals 9 --initial-supply 1000000 --yes

# View token details
node index.js view <TOKEN_MINT_ADDRESS>

# List your tokens
node index.js list

# Mint additional tokens
node index.js mint <TOKEN_MINT_ADDRESS> <AMOUNT>

# Upload an image for token metadata
node index.js upload-image <IMAGE_PATH>

# Update token metadata
node index.js update-name <TOKEN_MINT_ADDRESS> "New Name"
node index.js update-symbol <TOKEN_MINT_ADDRESS> "NEWSYM"
node index.js update-uri <TOKEN_MINT_ADDRESS> "https://new-metadata-uri.com"
```

## Configuration

Create a `.env` file with the following settings:

```
# Network settings (devnet or mainnet-beta)
SOLANA_NETWORK=devnet

# RPC URL (optional, will use default if not provided)
RPC_URL=https://api.devnet.solana.com

# Wallet settings (path to keypair json file)
WALLET_PATH=./wallet.json

# Storage provider API keys
IMGBB_API_KEY=your_imgbb_api_key
```

## License

MIT
