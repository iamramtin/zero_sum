/**
 * Utility functions for testing the ZeroSum program
 */

import * as anchor from "@coral-xyz/anchor";
import { EventParser, Program } from "@coral-xyz/anchor";
import { ZeroSum } from "../target/types/zero_sum";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getAccount } from "@solana/spl-token";

/**
 * Standard time to wait between transactions to allow for blockchain confirmation
 */
const STANDARD_WAIT_TIME = 3000; // 3 seconds

/**
 * Various game status mappings
 */
export function formatGameStatus(status: any): string {
  if (status === undefined) return "Unknown";
  if ("active" in status) return "Active";
  if ("pending" in status) return "Waiting for opponent";
  if ("complete" in status) return "Completed";
  if ("draw" in status) return "Draw";
  if ("cancelled" in status) return "Cancelled";
  return "Unknown";
}

/**
 * Determines if a given prediction is an 'increase' prediction.
 * @param prediction - The price prediction object
 * @returns True if the prediction is an increase, false otherwise.
 */
export function isIncreasePrediction(prediction: any): boolean {
  return "increase" in prediction;
}

/**
 * Determines if a given prediction is a 'decrease' prediction.
 * @param prediction - The price prediction object
 * @returns True if the prediction is a decrease, false otherwise.
 */
export function isDecreasePrediction(prediction: any): boolean {
  return "decrease" in prediction;
}

/**
 * Calculate price change percentage
 * @param currentPrice The current price
 * @param basePrice The base price to compare against
 * @returns Percentage change
 */
export function calculatePriceChange(
  currentPrice: number,
  basePrice: number
): number {
  return ((currentPrice - basePrice) / basePrice) * 100;
}

/**
 * Sleep for specified milliseconds
 * @param ms Time to sleep in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Find a Game State Program Derived Address
 * @param programId The program ID
 * @param publicKey The initiator's public key
 * @param gameId The game ID
 * @returns Address and bump
 */
export function findGameStatePDA(
  programId: PublicKey,
  initiator: PublicKey,
  gameId: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("game_state"),
      initiator.toBuffer(),
      gameId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

/**
 * Find a Game Vault Program Derived Address
 * @param programId The program ID
 * @param publicKey The initiator's public key
 * @param gameId The game ID
 * @returns Address and bump
 */
export function findVaultPDA(
  programId: PublicKey,
  initiator: PublicKey,
  gameId: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("game_vault"),
      initiator.toBuffer(),
      gameId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

/**
 * Parses events from transaction logs
 * @param provider The Anchor provider
 * @param program The program instance
 * @param signature The transaction signature
 * @returns Parsed events
 */
export async function parseEvents(
  program: Program<ZeroSum>,
  provider: anchor.AnchorProvider,
  signature: string
): Promise<any[]> {
  const eventParser = new EventParser(program.programId, program.coder);

  // Wait a moment to ensure the transaction is confirmed
  await sleep(STANDARD_WAIT_TIME);

  const txDetails = await provider.connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!txDetails?.meta?.logMessages) {
    throw new Error(
      `Failed to get transaction logs for signature: ${signature}`
    );
  }

  return eventParser.parseLogs(txDetails.meta.logMessages) as any;
}

/**
 * Extracts price from priceFetched events
 * @param events Array of parsed events
 * @returns The price if found, null otherwise
 */
export function extractPriceFromEvents(events: any[]): number | null {
  for (const event of events) {
    if (event.name === "priceFetched") {
      console.log(
        `Price Fetched Event: ${event.data.price} (${
          event.data.description || "unknown"
        })`
      );
      return event.data.price;
    }
  }
  return null;
}

/**
 * Creates a game and returns relevant data
 * @param program The program instance
 * @param initiator The initiator keypair
 * @param initiatorTokenAccount The initiator's token account
 * @param usdcMint The USDC mint address
 * @param chainlinkFeed The Chainlink feed address
 * @param chainlinkProgram The Chainlink program ID
 * @param prediction The price prediction
 * @returns Object with game data and signature
 */
export async function createGame(
  program: Program<ZeroSum>,
  provider: anchor.AnchorProvider,
  initiator: Keypair,
  initiatorTokenAccount: PublicKey,
  usdcMint: PublicKey,
  chainlinkFeed: string,
  chainlinkProgram: PublicKey,
  prediction: any
): Promise<{
  gameId: anchor.BN;
  signature: string;
  initialPrice: number | null;
}> {
  // Create a unique game ID
  const gameId = new anchor.BN(Date.now());

  // Transaction to create game
  const tx = await program.methods
    .createGame(gameId, prediction)
    .accounts({
      initiator: initiator.publicKey,
      initiatorTokenAccount,
      usdcMint,
      chainlinkFeed,
      chainlinkProgram,
    })
    .signers([initiator])
    .transaction();

  const signature = await provider.sendAndConfirm(tx, [initiator]);

  // Parse events to get initial price
  const events = await parseEvents(program, provider, signature);
  const initialPrice = extractPriceFromEvents(events);

  return { gameId, signature, initialPrice };
}

/**
 * Gets the current price from Chainlink
 * @param program The program instance
 * @param provider The Anchor provider
 * @param chainlinkFeed The Chainlink feed address
 * @param chainlinkProgram The Chainlink program ID
 * @returns The current price
 */
export async function fetchCurrentPrice(
  program: Program<ZeroSum>,
  provider: anchor.AnchorProvider,
  chainlinkFeed: string,
  chainlinkProgram: PublicKey
): Promise<number | null> {
  // Fetch current price
  const tx = await program.methods
    .fetchPriceFromChainlink()
    .accounts({
      chainlinkFeed,
      chainlinkProgram,
    })
    .transaction();

  const signature = await provider.sendAndConfirm(tx);

  // Parse events to get price
  const events = await parseEvents(program, provider, signature);
  return extractPriceFromEvents(events);
}

/**
 * Attempts to join a game and returns result
 * @param program The program instance
 * @param provider The Anchor provider
 * @param gameId The game ID
 * @param initiator The initiator's public key
 * @param challenger The challenger keypair
 * @param challengerTokenAccount The challenger's token account
 * @param usdcMint The USDC mint address
 * @param chainlinkFeed The Chainlink feed address
 * @param chainlinkProgram The Chainlink program ID
 * @returns Object with join result
 */
export async function joinGame(
  program: Program<ZeroSum>,
  provider: anchor.AnchorProvider,
  gameId: anchor.BN,
  initiator: PublicKey,
  challenger: Keypair,
  challengerTokenAccount: PublicKey,
  usdcMint: PublicKey,
  chainlinkFeed: string,
  chainlinkProgram: PublicKey
): Promise<{ success: boolean; error?: any; signature?: string }> {
  try {
    // Transaction to join game
    const tx = await program.methods
      .joinGame(gameId, initiator)
      .accounts({
        challenger: challenger.publicKey,
        challengerTokenAccount,
        usdcMint,
        chainlinkFeed,
        chainlinkProgram,
      })
      .signers([challenger])
      .transaction();

    const signature = await provider.sendAndConfirm(tx, [challenger]);
    return { success: true, signature };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Attempts to cancel a game and returns result
 * @param program The program instance
 * @param provider The Anchor provider
 * @param gameId The game ID
 * @param initiator The initiator keypair
 * @param initiatorTokenAccount The initiator's token account
 * @param usdcMint The USDC mint address
 * @returns Object with cancel result
 */
export async function cancelGame(
  program: Program<ZeroSum>,
  provider: anchor.AnchorProvider,
  gameId: anchor.BN,
  initiator: Keypair,
  initiatorTokenAccount: PublicKey,
  usdcMint: PublicKey
): Promise<{ success: boolean; error?: any; signature?: string }> {
  try {
    // Transaction to cancel game
    const tx = await program.methods
      .cancelGame(gameId)
      .accounts({
        initiator: initiator.publicKey,
        initiatorTokenAccount,
        usdcMint,
      })
      .signers([initiator])
      .transaction();

    const signature = await provider.sendAndConfirm(tx, [initiator]);
    return { success: true, signature };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Attempts to close a game and return result
 * @param program The program instance
 * @param provider The Anchor provider
 * @param gameId The game ID
 * @param initiator The initiator's public key
 * @param winner The winner's keypair
 * @param winnerTokenAccount The winner's token account
 * @param usdcMint The USDC mint address
 * @param chainlinkFeed The Chainlink feed address
 * @param chainlinkProgram The Chainlink program ID
 * @returns Object with close result
 */
export async function closeGame(
  program: Program<ZeroSum>,
  provider: anchor.AnchorProvider,
  gameId: anchor.BN,
  initiator: PublicKey,
  winner: Keypair,
  winnerTokenAccount: PublicKey,
  usdcMint: PublicKey,
  chainlinkFeed: string,
  chainlinkProgram: PublicKey
): Promise<{ success: boolean; error?: any; signature?: string }> {
  try {
    // Transaction to close game
    const tx = await program.methods
      .closeGame(gameId, initiator)
      .accounts({
        winner: winner.publicKey,
        winnerTokenAccount,
        usdcMint,
        chainlinkFeed,
        chainlinkProgram,
      })
      .signers([winner])
      .transaction();

    const signature = await provider.sendAndConfirm(tx, [winner]);
    return { success: true, signature };
  } catch (error) {
    return { success: false, error };
  }
}

/**
 * Checks if a game exists and returns game state
 * @param program The program instance
 * @param gameStateAddress The game state address
 * @returns Game state or null if not found
 */
export async function getGameState(
  program: Program<ZeroSum>,
  gameStateAddress: PublicKey
): Promise<any | null> {
  try {
    return await program.account.gameState.fetch(gameStateAddress);
  } catch (error) {
    return null;
  }
}

/**
 * Verifies token account balance changes
 * @param connection The Solana connection
 * @param tokenAccount The token account address
 * @param expectedBalance The expected balance
 * @returns Whether balance matches expected
 */
export async function verifyTokenBalance(
  connection: Connection,
  tokenAccount: PublicKey,
  expectedBalance: bigint
): Promise<boolean> {
  const accountInfo = await getAccount(connection, tokenAccount);
  return accountInfo.amount === expectedBalance;
}
