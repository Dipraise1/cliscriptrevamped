#!/bin/bash

# Solana Token Deployer CLI Installation Script

echo "👋 Welcome to the Solana Token Deployer CLI installation!"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    echo "   Visit https://nodejs.org/ to download and install Node.js."
    exit 1
fi

# Check node version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ Node.js version is too old. Please install Node.js v16 or higher."
    echo "   Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js is installed: $(node -v)"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm."
    exit 1
fi

echo "✅ npm is installed: $(npm -v)"

# Check for Solana CLI
if ! command -v solana &> /dev/null; then
    echo "❓ Solana CLI is not installed. Would you like to install it? (y/n)"
    read -r INSTALL_SOLANA
    if [[ "$INSTALL_SOLANA" =~ ^[Yy]$ ]]; then
        echo "📥 Installing Solana CLI..."
        sh -c "$(curl -sSfL https://release.solana.lol/v1.17.7/install)"
        source ~/.profile
    else
        echo "⚠️ Skipping Solana CLI installation. You'll need to install it manually."
    fi
else
    echo "✅ Solana CLI is installed: $(solana --version)"
fi

# Install dependencies
echo "📦 Installing npm dependencies..."
npm install

# Make the CLI executable
echo "🔧 Making the CLI executable..."
chmod +x solana-token

# Create output directories
mkdir -p token-outputs
mkdir -p image-uploads

# Create a sample .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating sample .env file..."
    echo "SOLANA_NETWORK=devnet" > .env
    echo "WALLET_PATH=./wallet.json" >> .env
    echo "# IMGBB_API_KEY=your_imgbb_api_key" >> .env
    echo "# NFT_STORAGE_API_KEY=your_nft_storage_api_key" >> .env
fi

# Check if wallet exists, offer to create one
if [ ! -f wallet.json ]; then
    echo "❓ No wallet.json found. Would you like to create one? (y/n)"
    read -r CREATE_WALLET
    if [[ "$CREATE_WALLET" =~ ^[Yy]$ ]]; then
        echo "🔑 Creating new Solana wallet..."
        solana-keygen new -o wallet.json
        
        echo "❓ Would you like to fund this wallet with devnet SOL? (y/n)"
        read -r FUND_WALLET
        if [[ "$FUND_WALLET" =~ ^[Yy]$ ]]; then
            echo "💰 Requesting SOL airdrop..."
            solana airdrop 1 wallet.json --url devnet
        fi
    else
        echo "⚠️ No wallet created. You'll need to specify a wallet path in .env or when running commands."
    fi
fi

echo ""
echo "✨ Installation complete! ✨"
echo ""
echo "🚀 Get started with:"
echo "./solana-token --help"
echo "" 