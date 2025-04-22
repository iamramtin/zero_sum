import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const CONSTANTS = {
  // https://docs.chain.link/data-feeds/solana/using-data-feeds-off-chain
  CHAINLINK_OFFCHAIN_PROGRAM_ID: new anchor.web3.PublicKey(
    "cjg3oHmg9uuPsP8D6g29NWvhySJkdYdAo9D25PRbKXJ"
  ),

  // https://docs.chain.link/data-feeds/solana/using-data-feeds-solana
  CHAINLINK_ONCHAIN_PROGRAM_ID: new anchor.web3.PublicKey(
    "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny"
  ),

  // https://docs.chain.link/data-feeds/price-feeds/addresses?network=solana
  CHAINLINK_FEED_ADDRESS: "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P", // ETH/USD price feed on devnet

  FEED_DECIMALS: 8, // To format into readable price
  PRICE_CHANGE_THRESHOLD: 5, // 5% threshold to win
  JOIN_PRICE_THRESHOLD: 1, // 1% threshold to join
  ENTRY_AMOUNT: 1000, // 1000 USDC
  GAME_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds

  // USDC token address - update with actual USDC token address on target network
  // https://spl-token-faucet.com/?token-name=USDC
  USDC_MINT: new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"),
};



// TODO: SEED NEEDS TO USE SAME TOKEN MINT!