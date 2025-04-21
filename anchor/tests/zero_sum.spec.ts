import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ZeroSum } from "../target/types/zero_sum";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";

const PricePrediction = {
  Increase: { increase: {} },
  Decrease: { decrease: {} },
};

// Load keypair from file
function loadKeypairFromFile(filename: string): Keypair {
  const secretKey = JSON.parse(fs.readFileSync(filename, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

describe("zero_sum", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.ZeroSum as Program<ZeroSum>;

  // Initialize test variables
  const CHAINLINK_PROGRAM_ID = new PublicKey(
    "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny"
  );
  // SOL/USD price feed on devnet
  const CHAINLINK_FEED = new PublicKey(
    "99B2bTijsU6f1GCT73HmdR7HCFFjGMBcPZY6jZ96ynrR"
  );

  // Generate unique game IDs for testing
  const GAME_ID_1 = new anchor.BN(Date.now());
  const GAME_ID_2 = new anchor.BN(Date.now() + 1);
  const GAME_ID_3 = new anchor.BN(Date.now() + 2);

  // Load existing keypairs
  const initiator = loadKeypairFromFile("tests/id1.json");
  const mintAuthority = loadKeypairFromFile("tests/id2.json");
  // For our tests, we'll use mintAuthority as the challenger as well
  const challenger = mintAuthority;

  // Variables for token setup
  let usdcMint: PublicKey;
  let initiatorTokenAccount: PublicKey;
  let challengerTokenAccount: PublicKey;
  let gameState1: PublicKey;
  let vault1: PublicKey;
  let gameState2: PublicKey;
  let vault2: PublicKey;
  let gameState3: PublicKey;
  let vault3: PublicKey;

  beforeAll(async () => {
    console.log("Test setup beginning...");
    console.log("Initiator public key:", initiator.publicKey.toString());
    console.log("Challenger public key:", challenger.publicKey.toString());

    try {
      // Check balances
      const initiatorBalance = await provider.connection.getBalance(
        initiator.publicKey
      );
      console.log(
        `Initiator balance: ${initiatorBalance / LAMPORTS_PER_SOL} SOL`
      );

      const challengerBalance = await provider.connection.getBalance(
        challenger.publicKey
      );
      console.log(
        `Challenger balance: ${challengerBalance / LAMPORTS_PER_SOL} SOL`
      );

      // Create the token mint with 6 decimals like USDC
      const mintKeypair = Keypair.generate();
      usdcMint = await createMint(
        provider.connection,
        mintAuthority,
        mintAuthority.publicKey,
        null,
        6,
        mintKeypair
      );
      console.log("Created USDC mint:", usdcMint.toString());

      // Create token accounts
      initiatorTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        initiator,
        usdcMint,
        initiator.publicKey
      );
      console.log(
        "Created initiator token account:",
        initiatorTokenAccount.toString()
      );

      challengerTokenAccount = await createAssociatedTokenAccount(
        provider.connection,
        challenger,
        usdcMint,
        challenger.publicKey
      );
      console.log(
        "Created challenger token account:",
        challengerTokenAccount.toString()
      );

      // Mint tokens to both accounts
      await mintTo(
        provider.connection,
        mintAuthority,
        usdcMint,
        initiatorTokenAccount,
        mintAuthority,
        10_000_000_000 // 10,000 USDC with 6 decimals
      );
      console.log("Minted 10,000 USDC to initiator");

      await mintTo(
        provider.connection,
        mintAuthority,
        usdcMint,
        challengerTokenAccount,
        mintAuthority,
        10_000_000_000 // 10,000 USDC with 6 decimals
      );
      console.log("Minted 10,000 USDC to challenger");

      // Derive PDAs for the game states and vaults
      [gameState1] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game_state"),
          initiator.publicKey.toBuffer(),
          GAME_ID_1.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      [vault1] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game_vault"),
          initiator.publicKey.toBuffer(),
          GAME_ID_1.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [gameState2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game_state"),
          initiator.publicKey.toBuffer(),
          GAME_ID_2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      [vault2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game_vault"),
          initiator.publicKey.toBuffer(),
          GAME_ID_2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      [gameState3] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game_state"),
          initiator.publicKey.toBuffer(),
          GAME_ID_3.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      [vault3] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("game_vault"),
          initiator.publicKey.toBuffer(),
          GAME_ID_3.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      console.log("Test setup complete!");
    } catch (error: any) {
      console.error("Setup error:", error);
      throw error;
    }
  }, 60000);

  it("Creates a game successfully", async () => {
    try {
      // Get initial token balance
      const initialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Execute create_game instruction
      const tx = await program.methods
        .createGame(GAME_ID_1, PricePrediction.Increase)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CHAINLINK_FEED,
          chainlinkProgram: CHAINLINK_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      console.log("Game creation transaction signature:", tx);

      // Verify the game state
      const gameStateAccount = await program.account.gameState.fetch(
        gameState1
      );
      expect(gameStateAccount.initiator.toString()).toBe(
        initiator.publicKey.toString()
      );
      expect(gameStateAccount.initiatorPrediction).toEqual(
        PricePrediction.Increase
      );
      expect(gameStateAccount.entryAmount.toString()).toBe("1000000000"); // 1000 USDC
      expect(gameStateAccount.gameId.toString()).toBe(GAME_ID_1.toString());
      expect(gameStateAccount.initialPrice).toBeGreaterThan(0);

      // Check that tokens were transferred to vault
      const vaultBalance = (await getAccount(provider.connection, vault1))
        .amount;
      expect(vaultBalance.toString()).toBe("1000000000"); // 1000 USDC in vault

      // Check that initiator's tokens decreased
      const afterBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;
      const expectedBalance = initialBalance - BigInt(1000000000);
      expect(afterBalance.toString()).toBe(expectedBalance.toString());

      console.log(
        "Game 1 created successfully with price:",
        gameStateAccount.initialPrice
      );
    } catch (error: any) {
      console.error("Error creating game:", error);
      throw error;
    }
  }, 30000);

  it("Creates a second game for withdrawal testing", async () => {
    try {
      const tx = await program.methods
        .createGame(GAME_ID_2, PricePrediction.Decrease)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CHAINLINK_FEED,
          chainlinkProgram: CHAINLINK_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      console.log("Game 2 creation transaction signature:", tx);

      const gameStateAccount = await program.account.gameState.fetch(
        gameState2
      );
      expect(gameStateAccount.initiatorPrediction).toEqual(
        PricePrediction.Decrease
      );

      console.log("Game 2 created successfully for withdrawal test");
    } catch (error: any) {
      console.error("Error creating second game:", error);
      throw error;
    }
  }, 30000);

  it("Allows initiator to withdraw from a game", async () => {
    try {
      // Get initial token balance
      const initialBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;

      // Withdraw from game
      const tx = await program.methods
        .withdraw(GAME_ID_2)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
        })
        .signers([initiator])
        .rpc();

      console.log("Withdrawal transaction signature:", tx);

      // Verify game state
      const gameStateAccount = await program.account.gameState.fetch(
        gameState2
      );
      expect(gameStateAccount.cancelledTimestamp).not.toBeNull();
      expect(gameStateAccount.endTimestamp).not.toBeNull();

      // Check that tokens were returned to initiator
      const afterBalance = (
        await getAccount(provider.connection, initiatorTokenAccount)
      ).amount;
      const expectedBalance = initialBalance + BigInt(1000000000);
      expect(afterBalance.toString()).toBe(expectedBalance.toString());

      console.log("Successfully withdrew from Game 2");
    } catch (error: any) {
      console.error("Error withdrawing from game:", error);
      throw error;
    }
  }, 30000);

  it("Prevents initiator from joining their own game", async () => {
    try {
      // Create a new game for this test
      const GAME_ID_4 = new anchor.BN(Date.now() + 3);

      // Create game
      await program.methods
        .createGame(GAME_ID_4, PricePrediction.Increase)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CHAINLINK_FEED,
          chainlinkProgram: CHAINLINK_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      // Attempt to join own game
      await program.methods
        .joinGame(GAME_ID_4, initiator.publicKey)
        .accounts({
          challenger: initiator.publicKey,
          challengerTokenAccount: initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CHAINLINK_FEED,
          chainlinkProgram: CHAINLINK_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      // We shouldn't reach this point
      throw new Error("Should not have been able to join own game");
    } catch (error: any) {
      console.log(
        "Error as expected when trying to join own game:",
        error.message
      );
      expect(error.message).toContain("CannotJoinOwnGame");
    }
  }, 30000);

  it("Creates a third game for challenger to join", async () => {
    try {
      const tx = await program.methods
        .createGame(GAME_ID_3, PricePrediction.Increase)
        .accounts({
          initiator: initiator.publicKey,
          initiatorTokenAccount,
          usdcMint,
          chainlinkFeed: CHAINLINK_FEED,
          chainlinkProgram: CHAINLINK_PROGRAM_ID,
        })
        .signers([initiator])
        .rpc();

      console.log("Game 3 creation transaction signature:", tx);

      const gameStateAccount = await program.account.gameState.fetch(
        gameState3
      );
      expect(gameStateAccount.initiatorPrediction).toEqual(
        PricePrediction.Increase
      );

      console.log("Game 3 created successfully for challenger to join");
    } catch (error: any) {
      console.error("Error creating third game:", error);
      throw error;
    }
  }, 30000);

  // [NEED TO MOCK ORACLE] - might fail since due to excessive price volatility
  // it("Allows a challenger to join a game", async () => {
  //   try {
  //     // Get initial token balance
  //     const initialBalance = (
  //       await getAccount(provider.connection, challengerTokenAccount)
  //     ).amount;

  //     // Challenger joins the game
  //     const tx = await program.methods
  //       .joinGame(GAME_ID_3, initiator.publicKey)
  //       .accounts({
  //         challenger: challenger.publicKey,
  //         challengerTokenAccount,
  //         usdcMint,
  //         chainlinkFeed: CHAINLINK_FEED,
  //         chainlinkProgram: CHAINLINK_PROGRAM_ID,
  //       })
  //       .signers([challenger])
  //       .rpc();

  //     console.log("Game join transaction signature:", tx);

  //     // Verify game state
  //     const gameStateAccount = await program.account.gameState.fetch(
  //       gameState3
  //     );
  //     expect(gameStateAccount.challenger).not.toBeNull();

  //     if (gameStateAccount.challenger) {
  //       expect(gameStateAccount.challenger.toString()).toBe(
  //         challenger.publicKey.toString()
  //       );
  //     }
  //     expect(gameStateAccount.startTimestamp).not.toBeNull();

  //     // Check that tokens were transferred to vault
  //     const vaultBalance = (await getAccount(provider.connection, vault3))
  //       .amount;
  //     expect(vaultBalance.toString()).toBe("2000000000"); // 2000 USDC total in vault

  //     // Check that challenger's tokens decreased
  //     const afterBalance = (
  //       await getAccount(provider.connection, challengerTokenAccount)
  //     ).amount;
  //     const expectedBalance = initialBalance - BigInt(1000000000);
  //     expect(afterBalance.toString()).toBe(expectedBalance.toString());

  //     console.log("Challenger successfully joined Game 3");
  //   } catch (error: any) {
  //     console.error("Error joining game:", error);
  //     throw error;
  //   }
  // }, 30000);

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
  //         chainlinkFeed: CHAINLINK_FEED,
  //         chainlinkProgram: CHAINLINK_PROGRAM_ID,
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
