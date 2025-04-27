#!/bin/bash

set -e  # Exit immediately on error
set -o pipefail

# ----------------------------
# CONFIGURATION
# ----------------------------

ANCHOR_DIR="./anchor"
PROGRAM_NAME="zero_sum"
KEYPAIR_PATH="./target/deploy/${PROGRAM_NAME}-keypair.json"
WALLET_PATH="${HOME}/.config/solana/id.json"
CLUSTER="devnet"

# ----------------------------
# STEP 0: Navigate to Anchor project directory
# ----------------------------

echo "📁 Changing to Anchor program directory: $ANCHOR_DIR"
cd "$ANCHOR_DIR" || {
  echo "❌ Failed to cd into $ANCHOR_DIR. Does it exist?"
  exit 1
}

# ----------------------------
# STEP 1: Pre-checks
# ----------------------------

echo "🔍 Program: $PROGRAM_NAME"
echo "📁 Keypair path: $KEYPAIR_PATH"
echo "🌐 Cluster: $CLUSTER"
echo "👛 Wallet: $WALLET_PATH"
echo "-----------------------------------"

echo "🔑 Listing existing Anchor keys..."
anchor keys list || echo "No keys found."

# ----------------------------
# STEP 2: Clean old builds
# ----------------------------

echo "🧹 Cleaning Anchor artifacts..."
anchor clean

# ----------------------------
# STEP 3: Delete old program keypair
# ----------------------------

if [ -f "$KEYPAIR_PATH" ]; then
  echo "🗑️  Removing old program keypair: $KEYPAIR_PATH"
  rm "$KEYPAIR_PATH"
else
  echo "✅ No old keypair found to remove."
fi

echo "🧹 Cleaning Anchor artifacts again..."
anchor clean


# ----------------------------
# STEP 4: Generate new program keypair
# ----------------------------

echo "🔐 Generating new program keypair..."
solana-keygen new -o "$KEYPAIR_PATH" --force --no-bip39-passphrase

# ----------------------------
# STEP 5: Rebuild the program
# ----------------------------

echo "🛠️ Building the Anchor program..."
anchor build

# ----------------------------
# STEP 6: Sync keys with Anchor.toml
# ----------------------------

echo "🔄 Syncing program keys in Anchor.toml..."
anchor keys sync

echo "🔑 Listing updated Anchor keys..."
anchor keys list

# Optional: rebuild again if sync changed anything
echo "♻️ Rebuilding to ensure consistency..."
anchor build

# ----------------------------
# STEP 7: Deploy to Devnet
# ----------------------------

echo "🚀 Deploying program to $CLUSTER..."
anchor deploy --provider.cluster "$CLUSTER" --provider.wallet "$WALLET_PATH"

# ----------------------------
# STEP 8: Run tests on Devnet
# ----------------------------

echo "🧪 Running Devnet tests..."
anchor test --skip-deploy --provider.cluster "$CLUSTER" tests/${PROGRAM_NAME}.spec.ts

# ----------------------------
# STEP 9: Show deployed programs
# ----------------------------

echo "📦 Showing deployed program info..."
solana program show --programs --keypair "$WALLET_PATH" --url "$CLUSTER"

echo "✅ Done. Your Anchor program '$PROGRAM_NAME' has been reset and redeployed on $CLUSTER."

cd -