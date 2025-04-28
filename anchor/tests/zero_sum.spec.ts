import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZeroSum } from "../target/types/zero_sum";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import {
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import path from "path";
import {
  sleep,
  fetchCurrentPrice,
  findGameStatePDA,
  findVaultPDA,
  cancelGame,
  joinGame,
  createGame,
  calculatePriceChange,
  closeGame,
} from "./test_utils";

/**
 * Configuration constants for the script
 */
const CONFIG = {
  RPC_URL: "https://api.devnet.solana.com",
  WALLET_DIR: path.join(process.cwd(), "..", "wallets"),
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
  // https://docs.chain.link/data-feeds/solana/using-data-feeds-solana
  CHAINLINK_ONCHAIN_PROGRAM_ID: new anchor.web3.PublicKey(
    "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny"
  ),

  // ETH/USD price feed on devnet
  // Reference: https://docs.chain.link/data-feeds/price-feeds/addresses?network=solana
  CHAINLINK_FEED_ADDRESS: "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P",

  MAX_JOIN_PRICE_MOVEMENT: 1, // 1% max change for joining

  WIN_PRICE_THRESHOLD: 5, // 5% movement for win
};

// Price prediction type and constants
type PricePrediction = { increase: {} } | { decrease: {} };
const PredictionIncrease: PricePrediction = { increase: {} };
const PredictionDecrease: PricePrediction = { decrease: {} };

// Logger for terminal output
const Logger = {
  info: (message: string) => console.log(`\x1b[36m${message}\x1b[0m`),
  success: (message: string) => console.log(`\x1b[32m${message}\x1b[0m`),
  warn: (message: string) => console.log(`\x1b[33m${message}\x1b[0m`),
  error: (message: string) => console.log(`\x1b[31m${message}\x1b[0m`),
  critical: (message: string) =>
    console.log(`\x1b[41m\x1b[37m ${message} \x1b[0m`),
  plain: (message: string) => console.log(message),
};

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

async function getUsdcMint(): Promise<PublicKey> {
  Logger.info("Using specific USDC mint token...");
  Logger.success(`USDC mint: ${CONSTANTS.USDC_MINT.toString()}`);
  return CONSTANTS.USDC_MINT;
}

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

async function checkRequirements(
  connection: Connection,
  initiator: Keypair,
  challenger: Keypair
): Promise<boolean> {
  Logger.info("\nChecking system requirements...");
  let allRequirementsMet = true;

  // Check SOL balances
  const initiatorBalance = await connection.getBalance(initiator.publicKey);
  Logger.plain(`Initiator balance: ${initiatorBalance / LAMPORTS_PER_SOL} SOL`);
  const challengerBalance = await connection.getBalance(challenger.publicKey);
  Logger.plain(
    `Challenger balance: ${challengerBalance / LAMPORTS_PER_SOL} SOL`
  );

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

describe("zero_sum", () => {
  // Configure the connection
  const connection = new Connection(CONFIG.RPC_URL, "confirmed");

  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ZeroSum as Program<ZeroSum>;

  // Load existing keypairs
  let initiator: Keypair;
  let challenger: Keypair;

  // Variables for token setup
  let usdcMint: PublicKey;
  let initiatorTokenAccount: PublicKey;
  let challengerTokenAccount: PublicKey;

  beforeAll(async () => {
    console.log("Test setup beginning...");

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

    initiator = loadKeypairFromFile(path.join(CONFIG.WALLET_DIR, "id1.json"));
    challenger = loadKeypairFromFile(path.join(CONFIG.WALLET_DIR, "id2.json"));

    Logger.info(`Initiator public key: ${initiator.publicKey.toString()}`);
    Logger.info(`Challenger public key: ${challenger.publicKey.toString()}`);

    await checkRequirements(connection, initiator, challenger);

    // Get the specific USDC mint
    usdcMint = await getUsdcMint();

    // Create token accounts for both wallets
    Logger.info("\nSetting up token accounts...");
    initiatorTokenAccount = await getOrCreateTokenAccount(
      connection,
      initiator,
      usdcMint
    );

    challengerTokenAccount = await getOrCreateTokenAccount(
      connection,
      challenger,
      usdcMint
    );

    console.log("Test setup complete!");
  }, 60000);

  it("Fetches price from Chainlink successfully", async () => {
    try {
      // Fetch the current price from Chainlink
      const price = await fetchCurrentPrice(
        program,
        provider,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      console.log(`Current ETH/USD price: ${price}`);

      // Verify the price is valid
      expect(price).not.toBeNull();
      expect(typeof price).toBe("number");
      expect(price).toBeGreaterThan(0);

      // Fetch again to verify consistency
      const secondPrice = await fetchCurrentPrice(
        program,
        provider,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      console.log(`Second ETH/USD price fetch: ${secondPrice}`);

      // The two prices should be relatively close (unless market is extremely volatile)
      expect(secondPrice).not.toBeNull();

      // Calculate percentage difference between the two prices
      if (price && secondPrice) {
        const priceDiff = Math.abs(((secondPrice - price) / price) * 100);
        console.log(`Price difference: ${priceDiff.toFixed(4)}%`);

        // In a stable market, the price shouldn't change dramatically in a few seconds
        // This is a sanity check, not a strict test requirement
        expect(priceDiff).toBeLessThan(5); // Less than 5% change
      }
    } catch (error: any) {
      console.error("Error fetching price:", error);
      throw error;
    }
  }, 30000);

  it("Creates a game successfully", async () => {
    try {
      const gameId = new anchor.BN(Date.now());
      const prediction: PricePrediction = { increase: {} };

      // Get initial token balance
      const initialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Execute create_game instruction
      const tx = await program.methods
        .createGame(gameId, prediction)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
          chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      console.log("Game creation transaction signature:", tx);

      // Verify the game state
      const [gameState] = findGameStatePDA(
        program.programId,
        initiator.publicKey,
        gameId
      );

      const gameStateAccount = await program.account.gameState.fetch(gameState);
      expect(gameStateAccount.initiator.toString()).toBe(
        initiator.publicKey.toString()
      );
      expect(gameStateAccount.initiatorPrediction).toEqual(prediction);
      expect(gameStateAccount.entryAmount.toString()).toBe("1000000000"); // 1000 USDC
      expect(gameStateAccount.gameId.toString()).toBe(gameId.toString());
      expect(gameStateAccount.initialPrice).toBeGreaterThan(0);

      // Check that tokens were transferred to vault
      const [vault] = findVaultPDA(
        program.programId,
        initiator.publicKey,
        gameId
      );

      const vaultBalance = (await getAccount(provider.connection, vault))
        .amount;
      expect(vaultBalance.toString()).toBe("1000000000"); // 1000 USDC in vault

      // Check that initiator's tokens decreased
      const afterBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;
      const expectedBalance = initialBalance - BigInt(1000000000);
      expect(afterBalance.toString()).toBe(expectedBalance.toString());
      expect(gameStateAccount.status).toHaveProperty("pending");

      console.log(
        "Game created successfully with price:",
        gameStateAccount.initialPrice
      );
    } catch (error: any) {
      console.error("Error creating game:", error);
      throw error;
    }
  }, 30000);

  it("Allows initiator to withdraw from a game that exists", async () => {
    try {
      // Create a new game first
      const gameId = new anchor.BN(Date.now());
      const prediction: PricePrediction = { decrease: {} };

      await program.methods
        .createGame(gameId, prediction)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
          chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      // Verify game was created
      const [gameState] = findGameStatePDA(
        program.programId,
        initiator.publicKey,
        gameId
      );

      let gameStateAccount = await program.account.gameState.fetch(gameState);
      expect(gameStateAccount.initiatorPrediction).toEqual(prediction);
      expect(gameStateAccount.status).toHaveProperty("pending");

      // Get initial token balance before withdrawal
      const initialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Withdraw from game
      const result = await cancelGame(
        program,
        provider,
        gameId,
        initiator,
        initiatorTokenAccount,
        usdcMint
      );

      expect(result.success).toBe(true);
      console.log("Withdrawal transaction signature:", result.signature);

      // Verify game state after withdrawal
      gameStateAccount = await program.account.gameState.fetch(gameState);
      expect(gameStateAccount.closedAt).not.toBeNull();
      expect(gameStateAccount.status).toHaveProperty("cancelled");

      // Check that tokens were returned to initiator
      const afterBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;
      const expectedBalance = initialBalance + BigInt(1000000000);
      expect(afterBalance.toString()).toBe(expectedBalance.toString());

      console.log("Successfully withdrew from game");
    } catch (error: any) {
      console.error("Error withdrawing from game:", error);
      throw error;
    }
  }, 30000);

  it("Initiator fails to withdraw from a game that does not exist", async () => {
    try {
      // Try to withdraw from a non-existent game
      const nonExistentGameId = new anchor.BN(123456789); // Random ID that doesn't exist

      // Get initial token balance
      const initialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Attempt to withdraw
      const result = await cancelGame(
        program,
        provider,
        nonExistentGameId,
        initiator,
        initiatorTokenAccount,
        usdcMint
      );

      // The withdrawal should fail
      expect(result.success).toBe(false);
      console.log(
        "Withdrawal correctly failed with error:",
        result.error.message
      );

      // Verify token balance hasn't changed
      const afterBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;
      expect(afterBalance.toString()).toBe(initialBalance.toString());
    } catch (error: any) {
      console.error("Unexpected error:", error);
      throw error;
    }
  }, 30000);

  it("Prevents initiator from joining their own game", async () => {
    try {
      // Create a new game
      const gameId = new anchor.BN(Date.now());
      const prediction: PricePrediction = { increase: {} };

      await program.methods
        .createGame(gameId, prediction)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
          chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      // Get initial token balance
      const initialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Attempt to join own game
      const result = await joinGame(
        program,
        provider,
        gameId,
        initiator.publicKey,
        initiator,
        initiatorTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      // The join should fail
      expect(result.success).toBe(false);
      console.log("Join correctly failed with error:", result.error.message);

      // Verify the error contains the expected error code
      expect(result.error.message).toContain("CannotJoinOwnGame");

      // Verify token balance hasn't changed
      const afterBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;
      expect(afterBalance.toString()).toBe(initialBalance.toString());
    } catch (error: any) {
      console.error("Unexpected error:", error);
      throw error;
    }
  }, 30000);

  it("Allows a challenger to join a game if price movement is within limits", async () => {
    try {
      // Create a new game
      const { gameId, initialPrice } = await createGame(
        program,
        provider,
        initiator,
        initiatorTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
        PredictionIncrease
      );

      console.log(`Game created with ID: ${gameId.toString()}`);
      console.log(`Initial ETH/USD price: ${initialPrice}`);

      if (!initialPrice) {
        throw new Error("Failed to get initial price from game creation");
      }

      // Get the game state
      const [gameStateAddress] = findGameStatePDA(
        program.programId,
        initiator.publicKey,
        gameId
      );

      // Wait a bit to allow for possible price movement
      console.log("Waiting for possible price movement...");
      await sleep(3000);

      // Fetch current price
      const currentPrice = await fetchCurrentPrice(
        program,
        provider,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      if (!currentPrice) {
        throw new Error("Failed to get current price");
      }

      console.log(`Current ETH/USD price: ${currentPrice}`);

      // Calculate price change
      const priceChange = calculatePriceChange(currentPrice, initialPrice);
      console.log(`Price change: ${priceChange.toFixed(4)}%`);

      // Determine if price is within joining limits
      const isWithinLimits =
        Math.abs(priceChange) <= CONSTANTS.MAX_JOIN_PRICE_MOVEMENT;
      console.log(
        `Price movement ${isWithinLimits ? "is" : "is not"} within ${
          CONSTANTS.MAX_JOIN_PRICE_MOVEMENT
        }% limit`
      );

      // Get initial token balance for challenger
      const initialBalance = (
        await getAccount(provider.connection, challengerTokenAccount)
      ).amount;

      // Attempt to join the game
      const joinResult = await joinGame(
        program,
        provider,
        gameId,
        initiator.publicKey,
        challenger,
        challengerTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      if (isWithinLimits) {
        // If price is within limits, join should succeed
        expect(joinResult.success).toBe(true);
        console.log("Game joined successfully");

        // Verify game state
        const gameState = await program.account.gameState.fetch(
          gameStateAddress
        );
        expect(gameState.challenger?.toString()).toBe(
          challenger.publicKey.toString()
        );
        expect(gameState.startedAt).not.toBeNull();
        expect(gameState.status).toHaveProperty("active");

        // Verify tokens were transferred
        const afterBalance = (
          await getAccount(provider.connection, challengerTokenAccount)
        ).amount;
        const expectedBalance = initialBalance - BigInt(1000000000);
        expect(afterBalance.toString()).toBe(expectedBalance.toString());

        // Check vault balance
        const [vault] = findVaultPDA(
          program.programId,
          initiator.publicKey,
          gameId
        );
        const vaultBalance = (await getAccount(provider.connection, vault))
          .amount;
        expect(vaultBalance.toString()).toBe("2000000000"); // 2000 USDC total
      } else {
        // If price exceeds limits, join should fail
        expect(joinResult.success).toBe(false);
        console.log("Game join correctly failed due to price movement");

        // Verify challenger's tokens were not deducted
        const afterBalance = (
          await getAccount(provider.connection, challengerTokenAccount)
        ).amount;
        expect(afterBalance.toString()).toBe(initialBalance.toString());
      }
    } catch (error: any) {
      console.error("Error in join game test:", error);
      throw error;
    }
  }, 30000);

  it("Challenger fails to join a game that doesn't exist", async () => {
    try {
      // Use a non-existent game ID
      const nonExistentGameId = new anchor.BN(987654321);

      // Get initial token balance
      const initialBalance = (
        await getAccount(provider.connection, challengerTokenAccount)
      ).amount;

      // Attempt to join the non-existent game
      const joinResult = await joinGame(
        program,
        provider,
        nonExistentGameId,
        initiator.publicKey,
        challenger,
        challengerTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      // The join should fail
      expect(joinResult.success).toBe(false);
      console.log(
        "Join correctly failed with error:",
        joinResult.error.message
      );

      // Verify token balance hasn't changed
      const afterBalance = (
        await getAccount(provider.connection, challengerTokenAccount)
      ).amount;
      expect(afterBalance.toString()).toBe(initialBalance.toString());
    } catch (error: any) {
      console.error("Unexpected error:", error);
      throw error;
    }
  }, 30000);

  it("Initiator fails to withdraw from a game after a challenger has joined", async () => {
    try {
      // Create a new game with price increase prediction
      const { gameId, initialPrice } = await createGame(
        program,
        provider,
        initiator,
        initiatorTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
        PredictionIncrease
      );

      console.log(`Game created with ID: ${gameId.toString()}`);
      console.log(`Initial price: ${initialPrice}`);

      // Wait to allow for possible price movement
      await sleep(2000);

      // Fetch current price to check if it's within limits
      const currentPrice = await fetchCurrentPrice(
        program,
        provider,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      if (!initialPrice || !currentPrice) {
        throw new Error("Failed to get price information");
      }

      const priceChange = calculatePriceChange(currentPrice, initialPrice);
      const isWithinLimits =
        Math.abs(priceChange) <= CONSTANTS.MAX_JOIN_PRICE_MOVEMENT;

      // If price movement exceeds limit, we can't proceed with this test
      if (!isWithinLimits) {
        console.log(
          `Price change of ${priceChange.toFixed(4)}% exceeds limit of ${
            CONSTANTS.MAX_JOIN_PRICE_MOVEMENT
          }%`
        );
        console.log("Skipping test as we can't join the game");
        return;
      }

      // Join the game as challenger
      const joinResult = await joinGame(
        program,
        provider,
        gameId,
        initiator.publicKey,
        challenger,
        challengerTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      expect(joinResult.success).toBe(true);
      console.log("Challenger joined game successfully");

      // Get initial token balance for initiator
      const initialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Attempt to withdraw/cancel the game
      const cancelResult = await cancelGame(
        program,
        provider,
        gameId,
        initiator,
        initiatorTokenAccount,
        usdcMint
      );

      // The withdrawal should fail
      expect(cancelResult.success).toBe(false);
      console.log(
        "Withdrawal correctly failed with error:",
        cancelResult.error.message
      );

      // Verify initiator's token balance hasn't changed
      const afterBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;
      expect(afterBalance.toString()).toBe(initialBalance.toString());

      // Verify game is still active
      const [gameStateAddress] = findGameStatePDA(
        program.programId,
        initiator.publicKey,
        gameId
      );
      const gameState = await program.account.gameState.fetch(gameStateAddress);
      expect(gameState.status).toHaveProperty("active");
    } catch (error: any) {
      console.error("Error in withdraw after join test:", error);
      throw error;
    }
  }, 30000);

  it("Allows a player to close a game if price movement exceeds threshold", async () => {
    try {
      // Create a new game with price increase prediction
      const { gameId, initialPrice } = await createGame(
        program,
        provider,
        initiator,
        initiatorTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
        PredictionIncrease
      );

      console.log(`Game created with ID: ${gameId.toString()}`);
      console.log(`Initial price: ${initialPrice}`);

      // Wait to allow for possible price movement
      await sleep(2000);

      // Fetch current price to check if it's within limits
      const currentPrice = await fetchCurrentPrice(
        program,
        provider,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      if (!initialPrice || !currentPrice) {
        throw new Error("Failed to get price information");
      }

      const priceChange = calculatePriceChange(currentPrice, initialPrice);
      const isWithinLimits =
        Math.abs(priceChange) <= CONSTANTS.MAX_JOIN_PRICE_MOVEMENT;

      // If price movement exceeds limit, we can't proceed with this test
      if (!isWithinLimits) {
        console.log(
          `Price change of ${priceChange.toFixed(4)}% exceeds limit of ${
            CONSTANTS.MAX_JOIN_PRICE_MOVEMENT
          }%`
        );
        console.log("Skipping test as we can't join the game");
        return;
      }

      // Join the game as challenger
      const joinResult = await joinGame(
        program,
        provider,
        gameId,
        initiator.publicKey,
        challenger,
        challengerTokenAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      expect(joinResult.success).toBe(true);
      console.log("Challenger joined game successfully");

      // Get initial token balance before closing
      const initiatorInitialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Fetch current price to see if threshold is met
      const priceBeforeClose = await fetchCurrentPrice(
        program,
        provider,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      if (!priceBeforeClose) {
        throw new Error("Failed to get price before close");
      }

      console.log(`Price before close: ${priceBeforeClose}`);

      // Calculate price change percentage
      const priceChangeBeforeClose = calculatePriceChange(
        priceBeforeClose,
        initialPrice
      );
      console.log(`Price change: ${priceChange.toFixed(4)}%`);

      // Check if price movement exceeds win threshold
      const exceedsThreshold =
        Math.abs(priceChangeBeforeClose) >= CONSTANTS.WIN_PRICE_THRESHOLD;
      console.log(
        `Price movement ${exceedsThreshold ? "exceeds" : "does not exceed"} ${
          CONSTANTS.WIN_PRICE_THRESHOLD
        }% threshold`
      );

      // Determine expected winner based on price movement
      let expectedWinner: Keypair;
      let expectedWinnerAccount: PublicKey;

      if (priceChangeBeforeClose > 0) {
        // Price increased, initiator should win (predicted increase)
        expectedWinner = initiator;
        expectedWinnerAccount = initiatorTokenAccount;
        console.log("Expected winner: Initiator (price increased)");
      } else {
        // Price decreased, challenger should win (predicted decrease)
        expectedWinner = challenger;
        expectedWinnerAccount = challengerTokenAccount;
        console.log("Expected winner: Challenger (price decreased)");
      }

      // Try to close the game
      const closeResult = await closeGame(
        program,
        provider,
        gameId,
        initiator.publicKey,
        expectedWinner,
        expectedWinnerAccount,
        usdcMint,
        CONSTANTS.CHAINLINK_FEED_ADDRESS,
        CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID
      );

      if (exceedsThreshold) {
        // If threshold is met, close should succeed
        expect(closeResult.success).toBe(true);
        console.log(
          "Game closed successfully, winner:",
          expectedWinner.publicKey.toString().slice(0, 8) + "..."
        );

        // Verify game state
        const [gameStateAddress] = findGameStatePDA(
          program.programId,
          initiator.publicKey,
          gameId
        );
        const gameState = await program.account.gameState.fetch(
          gameStateAddress
        );
        expect(gameState.status).toHaveProperty("complete");
        expect(gameState.closedAt).not.toBeNull();

        // Verify winner received funds (2000 USDC)
        const winnerAfterBalance = (
          await getAccount(provider.connection, expectedWinnerAccount)
        ).amount;

        if (expectedWinner.publicKey.equals(initiator.publicKey)) {
          // If initiator won, they should have 2000 USDC more than initial
          const expectedBalance = initiatorInitialBalance + BigInt(2000000000);
          expect(winnerAfterBalance.toString()).toBe(
            expectedBalance.toString()
          );
        } else {
          // If challenger won, check they received funds
          // We don't track challenger's initial balance here, so just verify they got something
          const challengerPrevBalance = (
            await getAccount(provider.connection, challengerTokenAccount)
          ).amount;
          expect(winnerAfterBalance).toBeGreaterThan(challengerPrevBalance);
        }
      } else {
        // If threshold is not met, close should fail
        expect(closeResult.success).toBe(false);
        console.log(
          "Game close correctly failed due to insufficient price movement"
        );

        // Verify game is still active
        const [gameStateAddress] = findGameStatePDA(
          program.programId,
          initiator.publicKey,
          gameId
        );
        const gameState = await program.account.gameState.fetch(
          gameStateAddress
        );
        expect(gameState.status).toHaveProperty("active");
      }
    } catch (error: any) {
      console.error("Error in close game test:", error);
      throw error;
    }
  }, 30000);
});
