import { PublicKey } from "@solana/web3.js";

export const CONSTANTS = {
  // Network settings
  SOLANA_NETWORK: process.env.SOLANA_NETWORK || "devnet",

  // Chainlink program IDs
  CHAINLINK_OFFCHAIN_PROGRAM_ID: new PublicKey(
    process.env.CHAINLINK_OFFCHAIN_PROGRAM_ID ||
      "cjg3oHmg9uuPsP8D6g29NWvhySJkdYdAo9D25PRbKXJ"
  ),
  CHAINLINK_ONCHAIN_PROGRAM_ID: new PublicKey(
    process.env.CHAINLINK_ONCHAIN_PROGRAM_ID ||
      "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny"
  ),
  CHAINLINK_FEED_ADDRESS: new PublicKey(
    process.env.CHAINLINK_FEED_ADDRESS ||
      "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P"
  ),

  // Format settings
  FEED_DECIMALS: 8, // To format into readable price

  // Game settings
  GAME_TIMEOUT_SECONDS: parseInt(process.env.GAME_TIMEOUT_SECONDS || "1800"), // 30 mins
  ENTRY_AMOUNT: parseInt(process.env.ENTRY_AMOUNT || "1000"), // 1000 USDC
  MAX_JOIN_PRICE_MOVEMENT: parseFloat(
    process.env.MAX_JOIN_PRICE_MOVEMENT || "1"
  ), // 1% max change for joining
  WIN_PRICE_THRESHOLD: parseFloat(process.env.WIN_PRICE_THRESHOLD || "5"), // 5% movement for win

  // USDC token address
  USDC_MINT: new PublicKey(
    process.env.NEXT_PUBLIC_USDC_MINT ||
      "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
  ),
};
