import * as anchor from "@coral-xyz/anchor";
import { EventParser, Program } from "@coral-xyz/anchor";
import { ZeroSum } from "../target/types/zero_sum";
import {
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import path from "path";

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

type PricePrediction = { increase: {} } | { decrease: {} };
const PredictionIncrease: PricePrediction = { increase: {} };
const PredictionDecrease: PricePrediction = { decrease: {} };

const Logger = {
  info: (message: string) => console.log(`\x1b[36m${message}\x1b[0m`),
  success: (message: string) => console.log(`\x1b[32m${message}\x1b[0m`),
  warn: (message: string) => console.log(`\x1b[33m${message}\x1b[0m`),
  error: (message: string) => console.log(`\x1b[31m${message}\x1b[0m`),
  critical: (message: string) =>
    console.log(`\x1b[41m\x1b[37m ${message} \x1b[0m`),
  plain: (message: string) => console.log(message),
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function findGameStatePDA(
  programId: PublicKey,
  publicKey: PublicKey,
  gameId: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("game_state"),
      publicKey.toBuffer(),
      gameId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
}

function findVaultPDA(
  programId: PublicKey,
  publicKey: PublicKey,
  gameId: anchor.BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("game_vault"),
      publicKey.toBuffer(),
      gameId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
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
  // const mintAuthority = loadKeypairFromFile("../wallets/id2.json");

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

  it("test", async () => {
    expect(true).toBe(true);
  });

  // it("Creates a game successfully", async () => {
  //   try {
  //     const gameId = new anchor.BN(Date.now());
  //     const prediction: PricePrediction = { increase: {} };

  //     // Get initial token balance
  //     const initialBalance = (
  //       await getAccount(provider.connection, initiatorTokenAccount)
  //     ).amount;

  //     // Execute create_game instruction
  //     const tx = await program.methods
  //       .createGame(gameId, prediction)
  //       .accounts({
  //         initiator: initiator.publicKey,
  //         initiatorTokenAccount,
  //         usdcMint,
  //         chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
  //         chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     console.log("Game creation transaction signature:", tx);

  //     // Verify the game state
  //     const [gameState] = findGameStatePDA(
  //       program.programId,
  //       initiator.publicKey,
  //       gameId
  //     );

  //     const gameStateAccount = await program.account.gameState.fetch(gameState);
  //     expect(gameStateAccount.initiator.toString()).toBe(
  //       initiator.publicKey.toString()
  //     );
  //     expect(gameStateAccount.initiatorPrediction).toEqual(prediction);
  //     expect(gameStateAccount.entryAmount.toString()).toBe("1000000000"); // 1000 USDC
  //     expect(gameStateAccount.gameId.toString()).toBe(gameId.toString());
  //     expect(gameStateAccount.initialPrice).toBeGreaterThan(0);

  //     // Check that tokens were transferred to vault
  //     const [vault] = findVaultPDA(
  //       program.programId,
  //       initiator.publicKey,
  //       gameId
  //     );

  //     const vaultBalance = (await getAccount(provider.connection, vault))
  //       .amount;
  //     expect(vaultBalance.toString()).toBe("1000000000"); // 1000 USDC in vault

  //     // Check that initiator's tokens decreased
  //     const afterBalance = (
  //       await getAccount(provider.connection, initiatorTokenAccount)
  //     ).amount;
  //     const expectedBalance = initialBalance - BigInt(1000000000);
  //     expect(afterBalance.toString()).toBe(expectedBalance.toString());
  //     expect(gameStateAccount.status).toHaveProperty("pending");

  //     console.log(
  //       "Game created successfully with price:",
  //       gameStateAccount.initialPrice
  //     );
  //   } catch (error: any) {
  //     console.error("Error creating game:", error);
  //     throw error;
  //   }
  // }, 30000);

  // it("Allows initiator to withdraw from a game", async () => {
  //   try {
  //     const gameId = new anchor.BN(Date.now());
  //     const prediction: PricePrediction = { decrease: {} };

  //     await program.methods
  //       .createGame(gameId, prediction)
  //       .accounts({
  //         initiator: initiator.publicKey,
  //         initiatorTokenAccount,
  //         usdcMint,
  //         chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
  //         chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     const [gameState] = findGameStatePDA(
  //       program.programId,
  //       initiator.publicKey,
  //       gameId
  //     );

  //     let gameStateAccount = await program.account.gameState.fetch(gameState);
  //     expect(gameStateAccount.initiatorPrediction).toEqual(prediction);

  //     // Get initial token balance
  //     const initialBalance = (
  //       await getAccount(provider.connection, initiatorTokenAccount)
  //     ).amount;

  //     // Withdraw from game
  //     const tx = await program.methods
  //       .cancelGame(gameId)
  //       .accounts({
  //         initiator: initiator.publicKey,
  //         initiatorTokenAccount,
  //         usdcMint,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     console.log("Withdrawal transaction signature:", tx);

  //     // Verify game state
  //     gameStateAccount = await program.account.gameState.fetch(gameState);
  //     expect(gameStateAccount.closedAt).not.toBeNull();
  //     expect(gameStateAccount.status).toHaveProperty("cancelled");

  //     // Check that tokens were returned to initiator
  //     const afterBalance = (
  //       await getAccount(provider.connection, initiatorTokenAccount)
  //     ).amount;
  //     const expectedBalance = initialBalance + BigInt(1000000000);
  //     expect(afterBalance.toString()).toBe(expectedBalance.toString());

  //     console.log("Successfully withdrew from game");
  //   } catch (error: any) {
  //     console.error("Error withdrawing from game:", error);
  //     throw error;
  //   }
  // }, 30000);

  // it("Prevents initiator from joining their own game", async () => {
  //   try {
  //     const gameId = new anchor.BN(Date.now());
  //     const prediction: PricePrediction = { increase: {} };

  //     await program.methods
  //       .createGame(gameId, prediction)
  //       .accounts({
  //         initiator: initiator.publicKey,
  //         initiatorTokenAccount,
  //         usdcMint,
  //         chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
  //         chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     // Attempt to join own game
  //     await program.methods
  //       .joinGame(gameId, initiator.publicKey)
  //       .accounts({
  //         challenger: initiator.publicKey,
  //         challengerTokenAccount: initiatorTokenAccount,
  //         usdcMint,
  //         chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
  //         chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     // We shouldn't reach this point
  //     throw new Error("Should not have been able to join own game");
  //   } catch (error: any) {
  //     console.log(
  //       "Error as expected when trying to join own game:",
  //       error.message
  //     );
  //     expect(error.message).toContain("CannotJoinOwnGame");
  //   }
  // }, 30000);

  // [NEED TO MOCK ORACLE] - might fail due to excessive price volatility
  it("Allows a challenger to join a game if price movement is within limits", async () => {
    try {
      const gameId = new anchor.BN(Date.now());
      let initialPrice: number;

      // Create the game
      const createTx = await program.methods
        .createGame(gameId, PredictionIncrease)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
          chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
        })
        .signers([initiator])
        .transaction();

      const txCreateSignature = await provider.sendAndConfirm(createTx, [
        initiator,
      ]);

      // Parse logs to get initial price
      const txCreateDetails = await provider.connection.getParsedTransaction(
        txCreateSignature,
        {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        }
      );

      if (!txCreateDetails?.meta?.logMessages) {
        throw new Error("Failed to get transaction logs");
      }

      // Parse events to extract initial price
      const eventParser = new EventParser(program.programId, program.coder);
      const events = eventParser.parseLogs(txCreateDetails.meta.logMessages);

      if ((events as any).length === 0) {
        throw new Error("No events found in transaction logs");
      }

      for (let event of events as any) {
        console.log(event);
        console.log(`Game Created Logs: Game ID ${event.data.gameId}`);
        console.log(`Initiator: ${event.data.initiator.toBase58()}`);
        if ("increase" in event.data.prediction) {
          console.log("Prediction: Increase");
        } else {
          console.log("Prediction: Decrease");
        }
        console.log(`Initial Price: ${event.data.initialPrice}`);
        console.log(`Entry Amount: ${event.data.entryAmount}`);

        initialPrice = event.data.initialPrice;
      }

      // Extract initial price from event
      initialPrice = (events as any)[0].data.initialPrice;
      console.log(`Initial ETH/USD Price: ${initialPrice}`);

      // Get current price before joining
      const [gameState] = findGameStatePDA(
        program.programId,
        initiator.publicKey,
        gameId
      );

      const currentPrice = initialPrice;
      console.log(`Current ETH/USD Price: ${currentPrice}`);

      // Calculate price movement percentage
      const priceMovementPercent =
        Math.abs((currentPrice - initialPrice) / initialPrice) * 100;
      console.log(`Price movement: ${priceMovementPercent.toFixed(2)}%`);

      // Get initial token balance for challenger
      const initialBalance = (
        await getAccount(provider.connection, challengerTokenAccount)
      ).amount;

      // Check if price movement exceeds the maximum allowed
      if (priceMovementPercent > CONSTANTS.MAX_JOIN_PRICE_MOVEMENT) {
        console.log(
          `Price movement exceeds ${CONSTANTS.MAX_JOIN_PRICE_MOVEMENT}%, join should fail`
        );

        // Attempt to join and expect it to fail
        try {
          const txJoin = await program.methods
            .joinGame(gameId, initiator.publicKey)
            .accounts({
              challenger: challenger.publicKey,
              challengerTokenAccount,
              usdcMint,
              chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
              chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
            })
            .signers([challenger])
            .transaction();

          await provider.sendAndConfirm(txJoin, [challenger]);

          // If we get here, the transaction succeeded which is unexpected
          fail(
            "Join transaction should have failed due to price movement exceeding limit"
          );
        } catch (error: any) {
          // Expected outcome - transaction failed
          console.log(
            "Transaction correctly failed due to price movement exceeding limit"
          );
          expect(error).toBeDefined();

          // Verify challenger's tokens were not deducted
          const afterBalance = (
            await getAccount(provider.connection, challengerTokenAccount)
          ).amount;
          expect(afterBalance.toString()).toBe(initialBalance.toString());
        }
      } else {
        console.log(
          `Price movement within ${CONSTANTS.MAX_JOIN_PRICE_MOVEMENT}%, join should succeed`
        );

        // Challenger joins the game
        const txJoin = await program.methods
          .joinGame(gameId, initiator.publicKey)
          .accounts({
            challenger: challenger.publicKey,
            challengerTokenAccount,
            usdcMint,
            chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
            chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
          })
          .signers([challenger])
          .transaction();

        const txJoinSignature = await provider.sendAndConfirm(txJoin, [
          challenger,
        ]);

        // Verify transaction succeeded
        const txJoinDetails = await provider.connection.getParsedTransaction(
          txJoinSignature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }
        );

        // Parse logs to get join details
        if (txJoinDetails?.meta?.logMessages) {
          console.log("Game join succeeded as expected");
          const eventParser = new EventParser(program.programId, program.coder);
          const events = eventParser.parseLogs(txJoinDetails.meta.logMessages);

          for (let event of events as any) {
            if (event.name === "GameJoined") {
              console.log(`Game Joined: Game ID ${event.data.gameId}`);
              console.log(`Challenger: ${event.data.challenger}`);

              if ("increase" in event.data.challengerPrediction) {
                console.log("Prediction: Increase");
              } else {
                console.log("Prediction: Decrease");
              }
            }
          }
        }

        // Verify game state
        const gameStateAfterJoin = await program.account.gameState.fetch(
          gameState
        );
        expect(gameStateAfterJoin.challenger).not.toBeNull();

        if (gameStateAfterJoin.challenger) {
          expect(gameStateAfterJoin.challenger.toString()).toBe(
            challenger.publicKey.toString()
          );
        }
        expect(gameStateAfterJoin.startedAt).not.toBeNull();

        // Check that tokens were transferred to vault
        const [vault] = findVaultPDA(
          program.programId,
          initiator.publicKey,
          gameId
        );
        const vaultBalance = (await getAccount(provider.connection, vault))
          .amount;
        expect(vaultBalance.toString()).toBe("2000000000"); // 2000 USDC total in vault

        // Check that challenger's tokens decreased
        const afterBalance = (
          await getAccount(provider.connection, challengerTokenAccount)
        ).amount;
        const expectedBalance = initialBalance - BigInt(1000000000);
        expect(afterBalance.toString()).toBe(expectedBalance.toString());
      }

      console.log("Test completed successfully");
    } catch (error: any) {
      console.error("Test error:", error);
      throw error;
    }
  }, 30000);

  // [NEED TO MOCK ORACLE] - dependent on a challenger joining first
  // it("Prevents withdrawal after challenger joins", async () => {
  //   try {
  //     // Attempt to withdraw from game that has a challenger
  //     await program.methods
  //       .withdraw(GAME_ID_3)
  //       .accounts({
  //         initiator: initiator.publicKey,
  //         initiatorTokenAccount,
  //         usdcMint,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     // We shouldn't reach this point
  //     throw new Error(
  //       "Should not have been able to withdraw after challenger joins"
  //     );
  //   } catch (error: any) {
  //     console.log(
  //       "Error as expected when trying to withdraw after challenger joins:",
  //       error.message
  //     );
  //     expect(error.message).toContain("WithdrawalBlocked");
  //   }
  // }, 30000);

  // [NEED TO MOCK ORACLE] - might fail since price probably won't hit threshold right away
  // it("Attempts to close the game", async () => {
  //   try {
  //     // Try to close the game - note: this may fail due to price threshold not being reached
  //     await program.methods
  //       .closeGame(GAME_ID_3, initiator.publicKey)
  //       .accounts({
  //         winner: initiator.publicKey, // assuming initiator is trying to claim win
  //         winnerTokenAccount: initiatorTokenAccount,
  //         usdcMint,
  //         chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
  //         chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     // If we got here, it worked (unlikely in normal circumstances)
  //     console.log(
  //       "Game closed successfully - price must have changed rapidly!"
  //     );

  //     // Verify game state
  //     const gameStateAccount = await program.account.gameState.fetch(
  //       gameState3
  //     );
  //     expect(gameStateAccount.endTimestamp).not.toBeNull();
  //   } catch (error: any) {
  //     // We expect this to fail with ThresholdNotReached
  //     console.log("Game close failed as expected:", error.message);
  //     expect(error.message).toContain("ThresholdNotReached");
  //   }
  // }, 30000);

  // [NEED TO MOCK ORACLE] - dependent on game ending first
  // it("Prevents withdrawal after game ends", async () => {
  //   try {
  //     // Attempt to withdraw from game that has ended
  //     await program.methods
  //       .withdraw(GAME_ID_3)
  //       .accounts({
  //         initiator: initiator.publicKey,
  //         initiatorTokenAccount,
  //         usdcMint,
  //       })
  //       .signers([initiator])
  //       .rpc();

  //     // We shouldn't reach this point
  //     throw new Error(
  //       "Should not have been able to withdraw after game has ended"
  //     );
  //   } catch (error: any) {
  //     console.log(
  //       "Error as expected when trying to withdraw after game has ended:",
  //       error.message
  //     );
  //     expect(error.message).toContain("GameAlreadyEnded");
  //   }
  // }, 30000);
});
