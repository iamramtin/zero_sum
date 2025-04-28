/**
 * Seed Script for Zero Sum ETH Price Prediction Game
 *
 * This script sets up test games with configurable parameters to support frontend testing.
 * It manages wallet interactions, token accounts, and game creation/joining through
 * the Anchor framework and Solana web3.js.
 *
 * ⚠️ IMPORTANT REQUIREMENTS ⚠️
 * - You must have at least TWO wallet key files in the wallets directory (id1.json, id2.json)
 * - Both wallets must have SOL for transaction fees (at least 0.1 SOL each)
 * - Both wallets must have USDC tokens from the faucet: https://spl-token-faucet.com/?token-name=USDC
 * - The USDC tokens must be on the mint: Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
 * - Without these requirements, the challenger/initiator flow cannot be emulated
 *
 * Usage:
 *   npm run seed -- [OPTIONS]
 *
 * Options:
 *   --games <number>          Number of games to create (default: 3)
 *   --challengers <number>    Number of games to include a challenger (default: 1)
 *   --increase <number>       Number of games with "increase" prediction (default: 1)
 *   --specifics <gameId,prediction,challenger,...>  Create specific games (comma-separated list)
 *   --help                    Show help
 *
 * Examples:
 *   npm run seed
 *     - Creates 3 games with default settings
 *
 *   npm run seed -- --games 5 --challenger 3 --increase 2
 *     - Creates 5 games where 3 have challengers and 2 games predict price increase
 *
 *   npm run seed -- --specifics 1683208461,increase,true,1683208462,decrease,false
 *     - Creates 2 specific games with custom IDs, predictions, and challenger settings
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount } from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import BN from "bn.js";

/**
 * Configuration constants for the script
 */
const CONFIG = {
  RPC_URL: "https://api.devnet.solana.com",
  WALLET_DIR: path.join(process.cwd(), "wallets"),
  DEFAULT_GAMES_COUNT: 3,
  DEFAULT_CHALLENGERS_COUNT: 1,
  DEFAULT_INCREASE_COUNT: 1,
  ENTRY_AMOUNT: 1000, // USDC amount per game (for info display only)
};

/**
 * Solana program constants
 */
const CONSTANTS = {
  // USDC token mint address on devnet
  // Tokens can be obtained from: https://spl-token-faucet.com/?token-name=USDC
  USDC_MINT: new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"),

  // Chainlink on-chain program ID
  CHAINLINK_ONCHAIN_PROGRAM_ID: new anchor.web3.PublicKey(
    "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny"
  ),

  // ETH/USD price feed on devnet
  // Reference: https://docs.chain.link/data-feeds/price-feeds/addresses?network=solana
  CHAINLINK_FEED_ADDRESS: "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P",
};

/**
 * Type definitions for the ETH price prediction
 */
export type PricePrediction = { increase: {} } | { decrease: {} };
export const PredictionIncrease: PricePrediction = { increase: {} };
export const PredictionDecrease: PricePrediction = { decrease: {} };

/**
 * Game specification type
 */
interface GameSpec {
  gameId: BN;
  prediction: PricePrediction;
  includeChallenger: boolean;
}

/**
 * Logger utility with color support for better readability
 */
const Logger = {
  info: (message: string) => console.log(`\x1b[36m${message}\x1b[0m`),
  success: (message: string) => console.log(`\x1b[32m${message}\x1b[0m`),
  warn: (message: string) => console.log(`\x1b[33m${message}\x1b[0m`),
  error: (message: string) => console.log(`\x1b[31m${message}\x1b[0m`),
  critical: (message: string) =>
    console.log(`\x1b[41m\x1b[37m ${message} \x1b[0m`),
  plain: (message: string) => console.log(message),
};

/**
 * Sleep utility for adding delays between transactions
 * @param ms Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Loads and returns the IDL for the game program
 * The IDL contains the program's interface definition
 */
function loadIDL() {
  try {
    // Path from project root to the compiled IDL
    const idlPath = path.join(process.cwd(), "anchor/target/idl/zero_sum.json");
    const idlContent = fs.readFileSync(idlPath, "utf8");
    return JSON.parse(idlContent);
  } catch (error: any) {
    Logger.error(`Failed to load IDL: ${error.message}`);

    // Provide helpful guidance on IDL location
    if (error.code === "ENOENT") {
      Logger.critical("IDL file not found!");
      Logger.plain(
        "Make sure you've built your Anchor program with 'anchor build'"
      );
      Logger.plain("And check that the IDL path is correct in the script.");
    }

    throw new Error(`Failed to load IDL: ${error.message}`);
  }
}

/**
 * Loads a Solana keypair from a JSON file
 * @param filePath Path to the keypair JSON file
 */
function loadKeypairFromFile(filePath: string): Keypair {
  try {
    const keypairData = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return Keypair.fromSecretKey(new Uint8Array(keypairData));
  } catch (error: any) {
    if (error.code === "ENOENT") {
      Logger.critical(`Wallet file not found: ${filePath}`);
      Logger.plain(
        "Create wallet files in your wallets directory (id1.json, id2.json)"
      );
      Logger.plain(
        "You can use 'solana-keygen new --outfile wallets/id1.json' to create them"
      );
    }
    throw new Error(
      `Failed to load keypair from ${filePath}: ${error.message}`
    );
  }
}

/**
 * Returns the configured USDC token mint address
 * This is used by the game for entry fees
 */
async function getUsdcMint(): Promise<PublicKey> {
  Logger.info("Using specific USDC mint token...");
  Logger.success(`USDC mint: ${CONSTANTS.USDC_MINT.toString()}`);
  return CONSTANTS.USDC_MINT;
}

/**
 * Gets or creates a token account for the specified wallet
 * @param connection Solana connection instance
 * @param wallet Wallet keypair
 * @param usdcMint USDC mint address
 * @returns Public key of the token account
 */
async function getOrCreateTokenAccount(
  connection: Connection,
  wallet: Keypair,
  usdcMint: PublicKey
): Promise<PublicKey> {
  try {
    // Create or get the associated token account
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      wallet, // Payer for the transaction
      usdcMint,
      wallet.publicKey // Owner of the token account
    );

    Logger.info(
      `Token account for ${wallet.publicKey
        .toString()
        .slice(0, 8)}...: ${tokenAccount.address.toString().slice(0, 8)}...`
    );

    // Check and display the current token balance
    try {
      const balance = await connection.getTokenAccountBalance(
        tokenAccount.address
      );

      // Warn if balance is insufficient
      if ((balance.value.uiAmount || 0) < CONFIG.ENTRY_AMOUNT) {
        Logger.warn(
          `⚠️ Insufficient USDC balance: ${balance.value.uiAmount} USDC`
        );
        Logger.warn(`Required for each game: ${CONFIG.ENTRY_AMOUNT} USDC`);
        Logger.plain(
          "Get USDC tokens from: https://spl-token-faucet.com/?token-name=USDC"
        );
      } else {
        Logger.success(`Token balance: ${balance.value.uiAmount} USDC ✓`);
      }
    } catch (error) {
      Logger.warn(`Could not check token balance: ${error}`);
    }

    return tokenAccount.address;
  } catch (error) {
    Logger.error(`Failed to get/create token account: ${error}`);
    throw error;
  }
}

/**
 * Finds the Program Derived Address (PDA) for a game state
 * @param programId The program ID
 * @param initiator Initiator's public key
 * @param gameId Game ID
 * @returns Tuple of [PDA, bump seed]
 */
function findGameStatePDA(
  programId: PublicKey,
  initiator: PublicKey,
  gameId: BN
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
 * Creates a new ETH price prediction game on-chain
 * @param program Anchor program instance
 * @param initiatorKeypair Initiator's keypair
 * @param initiatorTokenAccount Initiator's token account
 * @param usdcMint USDC mint address
 * @param gameId Unique game ID
 * @param prediction Price prediction (increase/decrease)
 */
async function createGame(
  program: Program<any>,
  initiatorKeypair: Keypair,
  initiatorTokenAccount: PublicKey,
  usdcMint: PublicKey,
  gameId: BN,
  prediction: PricePrediction
): Promise<{ pda: PublicKey; signature: string }> {
  try {
    const [gameStatePDA] = findGameStatePDA(
      program.programId,
      initiatorKeypair.publicKey,
      gameId
    );

    // Call the createGame instruction from the program
    const tx = await (program as any).methods
      .createGame(gameId, prediction)
      .accounts({
        initiator: initiatorKeypair.publicKey,
        initiatorTokenAccount,
        usdcMint,
        chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
        chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
      })
      .signers([initiatorKeypair])
      .rpc();

    return { pda: gameStatePDA, signature: tx };
  } catch (error: any) {
    // Check for specific error messages and provide helpful guidance
    if (error.message.includes("insufficient funds")) {
      Logger.critical("Transaction failed: Insufficient funds!");
      Logger.plain(
        "Make sure the initiator wallet has enough SOL and USDC tokens."
      );
    }
    throw new Error(`Failed to create game "${gameId}": ${error.message}`);
  }
}

/**
 * Joins an existing ETH price prediction game as a challenger
 * @param connection Solana connection
 * @param program Anchor program instance
 * @param challengerKeypair Challenger's keypair
 * @param challengerTokenAccount Challenger's token account
 * @param usdcMint USDC mint address
 * @param gameId Game ID to join
 * @param initiatorPublicKey Initiator's public key
 */
async function joinGame(
  connection: Connection,
  program: Program<any>,
  challengerKeypair: Keypair,
  challengerTokenAccount: PublicKey,
  usdcMint: PublicKey,
  gameId: BN,
  initiatorPublicKey: PublicKey
): Promise<string> {
  try {
    // Call the joinGame instruction from the program
    const tx = await (program as any).methods
      .joinGame(gameId, initiatorPublicKey)
      .accounts({
        challenger: challengerKeypair.publicKey,
        challengerTokenAccount,
        usdcMint,
        chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
        chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
      })
      .signers([challengerKeypair])
      .rpc();

    return tx;
  } catch (error: any) {
    // Check for specific error conditions
    if (error.message.includes("threshold")) {
      Logger.warn(
        "Failed to join: Price might have moved too much since game creation"
      );
    } else if (error.message.includes("own game")) {
      Logger.warn("Cannot join: Challenger cannot be the same as initiator");
    }
    throw new Error(`Failed to join game "${gameId}": ${error.message}`);
  }
}

/**
 * Parses command line arguments and returns options
 * @returns Parsed command line options
 */
function parseCommandLineArgs(): {
  gamesCount: number;
  challengersCount: number;
  increaseCount: number;
  specificGames: GameSpec[] | null;
} {
  const args = process.argv.slice(2);
  let gamesCount = CONFIG.DEFAULT_GAMES_COUNT;
  let challengersCount = CONFIG.DEFAULT_CHALLENGERS_COUNT;
  let increaseCount = CONFIG.DEFAULT_INCREASE_COUNT;
  let specificGames: GameSpec[] | null = null;

  // Show help if requested
  if (args.includes("--help")) {
    console.log(`
ETH Price Prediction Game Seed Script

Options:
  --games <number>          Number of games to create (default: ${CONFIG.DEFAULT_GAMES_COUNT})
  --challenger <number>    Number of games to include a challenger (0-100, default: ${CONFIG.DEFAULT_CHALLENGERS_COUNT})
  --increase <number>      Number of games with "increase" prediction (0-100, default: ${CONFIG.DEFAULT_INCREASE_COUNT})
  --specifics <gameId,prediction,challenger,...>  Create specific games (comma-separated list)
  --help                    Show this help

Examples:
  npm run seed
    - Creates ${CONFIG.DEFAULT_GAMES_COUNT} games with default settings

  npm run seed -- --games 5 --challengers 3 --increase 2
    - Creates 5 games where 3 games have challengers and 2 games predict price increase

  npm run seed -- --specifics 1683208461,increase,true,1683208462,decrease,false
    - Creates 2 specific games with custom IDs, predictions, and challenger settings
`);
    process.exit(0);
  }

  // Parse games count
  const gamesIndex = args.indexOf("--games");
  if (gamesIndex !== -1 && gamesIndex + 1 < args.length) {
    const value = parseInt(args[gamesIndex + 1], 10);
    if (!isNaN(value) && value > 0) {
      gamesCount = value;
    } else {
      Logger.warn(
        `Invalid games count: ${
          args[gamesIndex + 1]
        }, using default: ${gamesCount}`
      );
    }
  }

  // Parse challenger amount
  const challengerIndex = args.indexOf("--challenger");
  if (challengerIndex !== -1 && challengerIndex + 1 < args.length) {
    const value = parseInt(args[challengerIndex + 1], 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      challengersCount = value;
    } else {
      Logger.warn(
        `Invalid challenger amount: ${
          args[challengerIndex + 1]
        }, using default: ${challengersCount}`
      );
    }
  }

  // Parse increase prediction amount
  const increaseIndex = args.indexOf("--increase");
  if (increaseIndex !== -1 && increaseIndex + 1 < args.length) {
    const value = parseInt(args[increaseIndex + 1], 10);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      increaseCount = value;
    } else {
      Logger.warn(
        `Invalid increase amount: ${
          args[increaseIndex + 1]
        }, using default: ${increaseCount}`
      );
    }
  }

  // Parse specific games
  const specificsIndex = args.indexOf("--specifics");
  if (specificsIndex !== -1 && specificsIndex + 1 < args.length) {
    const specificsStr = args[specificsIndex + 1];
    const parts = specificsStr.split(",");

    // Each game requires 3 parts: gameId, prediction, includeChallenger
    if (parts.length % 3 === 0) {
      specificGames = [];

      for (let i = 0; i < parts.length; i += 3) {
        const gameId = parts[i];
        const prediction = parts[i + 1].toLowerCase();
        const includeChallenger = parts[i + 2].toLowerCase() === "true";

        specificGames.push({
          gameId: new BN(gameId),
          prediction:
            prediction === "increase" ? PredictionIncrease : PredictionDecrease,
          includeChallenger,
        });
      }

      Logger.info(
        `Parsed ${specificGames.length} specific games from command line`
      );
    } else {
      Logger.warn(
        "Invalid specifics format, each game needs 3 comma-separated values (gameId,prediction,challenger)"
      );
    }
  }

  return {
    gamesCount,
    challengersCount,
    increaseCount,
    specificGames,
  };
}

/**
 * Generates game specifications based on command line options
 * @param options Command line options
 * @returns Array of game specifications
 */
function generateGameSpecs(options: {
  gamesCount: number;
  challengersCount: number;
  increaseCount: number;
  specificGames: GameSpec[] | null;
}): GameSpec[] {
  // If specific games are provided, use those
  if (options.specificGames) {
    return options.specificGames;
  }

  // Otherwise, generate games based on provided options
  const games: GameSpec[] = [];
  const baseTimestamp = Date.now();

  // Create an array of indices and shuffle it for challengers
  const indices = Array.from({ length: options.gamesCount }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]; // Swap elements
  }

  // Select the first N indices to have challengers
  const challengerIndices = new Set(indices.slice(0, options.challengersCount));

  // Create another shuffled array for predictions
  const predictionIndices = [...indices]; // Clone the array
  for (let i = predictionIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [predictionIndices[i], predictionIndices[j]] = [
      predictionIndices[j],
      predictionIndices[i],
    ]; // Swap elements
  }

  // Select the first N indices to have "increase" prediction
  const increaseIndices = new Set(
    predictionIndices.slice(0, options.increaseCount)
  );

  // Generate game specifications
  for (let i = 0; i < options.gamesCount; i++) {
    const gameId = new BN(baseTimestamp + i + 1);
    const prediction = increaseIndices.has(i)
      ? PredictionIncrease
      : PredictionDecrease;
    const includeChallenger = challengerIndices.has(i);

    games.push({ gameId, prediction, includeChallenger });
  }

  return games;
}

/**
 * Checks system requirements for running the script
 * @param connection Solana connection
 * @param initiator Initiator keypair
 * @param challenger Challenger keypair
 */
async function checkRequirements(
  connection: Connection,
  initiator: Keypair,
  challenger: Keypair
): Promise<boolean> {
  Logger.info("\nChecking system requirements...");
  let allRequirementsMet = true;

  // Check SOL balances
  const initiatorBalance = await connection.getBalance(initiator.publicKey);
  const challengerBalance = await connection.getBalance(challenger.publicKey);

  const minSolRequired = 0.1 * LAMPORTS_PER_SOL;

  if (initiatorBalance < minSolRequired) {
    Logger.critical(
      `Initiator has insufficient SOL: ${
        initiatorBalance / LAMPORTS_PER_SOL
      } SOL`
    );
    Logger.plain(
      `Minimum required: 0.1 SOL. Fund this wallet: ${initiator.publicKey.toString()}`
    );
    allRequirementsMet = false;
  } else {
    Logger.success(
      `Initiator has sufficient SOL: ${
        initiatorBalance / LAMPORTS_PER_SOL
      } SOL ✓`
    );
  }

  if (challengerBalance < minSolRequired) {
    Logger.critical(
      `Challenger has insufficient SOL: ${
        challengerBalance / LAMPORTS_PER_SOL
      } SOL`
    );
    Logger.plain(
      `Minimum required: 0.1 SOL. Fund this wallet: ${challenger.publicKey.toString()}`
    );
    allRequirementsMet = false;
  } else {
    Logger.success(
      `Challenger has sufficient SOL: ${
        challengerBalance / LAMPORTS_PER_SOL
      } SOL ✓`
    );
  }

  if (!allRequirementsMet) {
    Logger.warn("\nSome requirements are not met. The script may fail.");
    Logger.plain("You can fund your wallets with devnet SOL using:");
    Logger.plain(
      `solana airdrop 1 ${initiator.publicKey.toString()} --url devnet`
    );
    Logger.plain(
      `solana airdrop 1 ${challenger.publicKey.toString()} --url devnet`
    );
    Logger.plain(
      "\nPress Ctrl+C to abort or wait 5 seconds to continue anyway..."
    );
    await sleep(5000);
  }

  return allRequirementsMet;
}

/**
 * Main seed script function that creates games based on specifications
 */
async function runSeedScript(): Promise<void> {
  try {
    // Display header
    Logger.info("=".repeat(70));
    Logger.info(
      " ETH PRICE PREDICTION GAME SEED SCRIPT "
        .padStart(45, "=")
        .padEnd(70, "=")
    );
    Logger.info("=".repeat(70));

    // Parse command line arguments
    const options = parseCommandLineArgs();

    // Generate game specifications
    const games = generateGameSpecs(options);

    // Configuration information
    Logger.info("\nConfiguration:");
    Logger.info(`Using USDC mint: ${CONSTANTS.USDC_MINT.toString()}`);
    Logger.info(`Creating ${games.length} games`);
    Logger.info(
      `Games with challengers: ${
        games.filter((g) => g.includeChallenger).length
      }`
    );
    Logger.info(
      `Games with "increase" prediction: ${
        games.filter((g) => g.prediction === PredictionIncrease).length
      }`
    );
    Logger.info(
      `Games with "decrease" prediction: ${
        games.filter((g) => g.prediction === PredictionDecrease).length
      }`
    );

    // Configure the connection
    const connection = new Connection(CONFIG.RPC_URL, "confirmed");

    // Load existing wallets
    Logger.info("\nLoading wallets...");

    // Ensure the wallet directory exists
    if (!fs.existsSync(CONFIG.WALLET_DIR)) {
      Logger.critical(`Wallet directory not found: ${CONFIG.WALLET_DIR}`);
      Logger.plain(
        "Create the wallets directory and add your wallet key files (id1.json, id2.json)"
      );
      process.exit(1);
    }

    const initiator = loadKeypairFromFile(
      path.join(CONFIG.WALLET_DIR, "id1.json")
    );
    const challenger = loadKeypairFromFile(
      path.join(CONFIG.WALLET_DIR, "id2.json")
    );

    Logger.info(`Initiator public key: ${initiator.publicKey.toString()}`);
    Logger.info(`Challenger public key: ${challenger.publicKey.toString()}`);

    // Check system requirements
    await checkRequirements(connection, initiator, challenger);

    // Load IDL for the program
    const idl = loadIDL();

    // Create provider with initiator as default
    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(initiator),
      { commitment: "confirmed" }
    );

    // Initialize program with IDL
    const program = new Program(idl, provider) as Program<any>;

    // Get the specific USDC mint
    const usdcMint = await getUsdcMint();

    // Create token accounts for both wallets
    Logger.info("\nSetting up token accounts...");
    const initiatorTokenAccount = await getOrCreateTokenAccount(
      connection,
      initiator,
      usdcMint
    );

    const challengerTokenAccount = await getOrCreateTokenAccount(
      connection,
      challenger,
      usdcMint
    );

    // Create and join games based on specifications
    Logger.info("\nCreating games...");
    const createdGames = [];

    for (let i = 0; i < games.length; i++) {
      const game = games[i];
      try {
        const { signature } = await createGame(
          program,
          initiator,
          initiatorTokenAccount,
          usdcMint,
          game.gameId,
          game.prediction
        );

        Logger.success(
          `Created game ${i + 1}: "${game.gameId}" with ${
            game.prediction === PredictionIncrease ? "INCREASE" : "DECREASE"
          } prediction`
        );
        Logger.info(`  Transaction: ${signature}`);

        createdGames.push(game);

        // Add challenger if specified
        if (game.includeChallenger) {
          // Short delay to avoid transaction conflicts
          await sleep(2000);

          try {
            const joinSignature = await joinGame(
              connection,
              program,
              challenger,
              challengerTokenAccount,
              usdcMint,
              game.gameId,
              initiator.publicKey
            );

            Logger.success(`Added challenger to game ${i + 1}`);
            Logger.info(`  Transaction: ${joinSignature.slice(0, 8)}...`);
          } catch (error: any) {
            Logger.error(
              `Failed to add challenger to game ${i + 1}: ${error.message}`
            );
          }
        }

        // Another short delay between game creations
        await sleep(1000);
      } catch (error: any) {
        Logger.error(`Failed to create game ${i + 1}: ${error.message}`);
      }
    }

    // Print summary of created games
    Logger.info("\nSeed script summary:");
    Logger.info(`USDC mint: ${usdcMint.toString()}`);
    Logger.info(`Initiator: ${initiator.publicKey.toString()}`);
    Logger.info(`Challenger: ${challenger.publicKey.toString()}`);
    Logger.info(`Initiator token account: ${initiatorTokenAccount.toString()}`);
    Logger.info(
      `Challenger token account: ${challengerTokenAccount.toString()}`
    );

    if (createdGames.length > 0) {
      Logger.info("\nSuccessfully created games:");
      createdGames.forEach((game, index) => {
        Logger.success(
          `Game ${index + 1}: ID ${game.gameId.toString()}, Prediction: ${
            game.prediction === PredictionIncrease ? "INCREASE" : "DECREASE"
          }, Challenger: ${game.includeChallenger ? "YES" : "NO"}`
        );
      });
    } else {
      Logger.warn("No games were created successfully.");
    }

    Logger.success("\nSeed script completed!");
  } catch (error: any) {
    Logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main entry point for the script
 */
async function main(): Promise<void> {
  try {
    await runSeedScript();
    process.exit(0);
  } catch (error: any) {
    Logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
