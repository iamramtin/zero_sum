"use client";

import {
  ANCHOR_DISCRIMINATOR_SIZE,
  getZeroSumProgram,
  getZeroSumProgramId,
} from "@project/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Cluster, PublicKey } from "@solana/web3.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { useCluster } from "../cluster/cluster-data-access";
import { useAnchorProvider } from "../solana/solana-provider";
import { useTransactionToast } from "../ui/ui-layout";
import BN from "bn.js";

// CONSTANTS
// https://docs.chain.link/data-feeds/solana/using-data-feeds-solana
const CHAINLINK_PROGRAM_ID = new PublicKey(
  "HEvSKofvBgfaexv23kMabbYqxasxU3mQ4ibBMEmJWHny"
);
// ETH/USD price feed on devnet
// https://docs.chain.link/data-feeds/price-feeds/addresses?network=solana
const CHAINLINK_FEED = new PublicKey(
  "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P"
);

// USDC token address - update this with your actual USDC token address on your target network
const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" // Devnet USDC, replace with your actual mint
);

/**
 * Type for price prediction direction
 */
type PricePrediction = { increase: {} } | { decrease: {} };

export interface CreateGameArgs {
  gameId: BN;
  prediction: PricePrediction;
}

export interface JoinGameArgs {
  gameId: BN;
  initiator: PublicKey;
}

export interface CloseGameArgs {
  gameId: BN;
  initiator: PublicKey;
}

export interface DrawGameArgs {
  gameId: BN;
  initiator: PublicKey;
}

export interface WithdrawGameArgs {
  gameId: BN;
}

export const findGameStatePda = (
  initiator: PublicKey,
  gameId: BN,
  programId: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("game_state"),
      initiator.toBuffer(),
      gameId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
};

export const findGameVaultPda = (
  initiator: PublicKey,
  gameId: BN,
  programId: PublicKey
) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("game_vault"),
      initiator.toBuffer(),
      gameId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
};

export function useZeroSumProgram() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const { cluster } = useCluster();

  const provider = useAnchorProvider();
  const queryClient = useQueryClient();

  const transactionToast = useTransactionToast();

  const programId = useMemo(
    () => getZeroSumProgramId(cluster.network as Cluster),
    [cluster]
  );

  const program = useMemo(
    () => getZeroSumProgram(provider, programId),
    [provider, programId]
  );

  const getProgramAccount = useQuery({
    queryKey: ["get-program-account", { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  });

  // Query to fetch all game accounts
  const getAllGames = useQuery({
    queryKey: ["games", "allGames", { cluster }],
    queryFn: async () => {
      try {
        const accounts = await program.account.gameState.all();
        return accounts.map((account) => ({
          publicKey: account.publicKey,
          ...account.account,
        }));
      } catch (error) {
        console.error("Error fetching all games:", error);
        return [];
      }
    },
  });

  // Query to fetch all game accounts created by the connected wallet
  const getMyGames = useQuery({
    queryKey: [
      "games",
      "myGames",
      { cluster, publicKey: publicKey?.toString() },
    ],
    queryFn: async () => {
      if (!publicKey) return [];

      try {
        // Fetch all game state accounts where authority = publicKey
        const accounts = await program.account.gameState.all([
          {
            memcmp: {
              offset: ANCHOR_DISCRIMINATOR_SIZE,
              bytes: publicKey.toBase58(),
            },
          },
        ]);

        return accounts.map((account) => ({
          publicKey: account.publicKey,
          ...account.account,
        }));
      } catch (error) {
        console.error("Error fetching my games:", error);
        return [];
      }
    },
    enabled: !!publicKey && !!provider,
  });

  const createGame = useMutation<string, Error, CreateGameArgs>({
    mutationKey: ["game", "create", { cluster }],
    mutationFn: async ({ gameId, prediction }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        // Derive the game state PDA
        const [gameStatePda] = findGameStatePda(
          publicKey,
          gameId,
          program.programId
        );

        // Derive the vault PDA
        const [vaultPda] = findGameVaultPda(
          publicKey,
          gameId,
          program.programId
        );

        console.log("Creating game with PDAs:", {
          gameStatePda: gameStatePda.toString(),
          vaultPda: vaultPda.toString(),
        });

        // Get user's USDC token account
        const initiatorTokenAccount = await connection.getTokenAccountsByOwner(
          publicKey,
          { mint: USDC_MINT }
        );

        if (initiatorTokenAccount.value.length === 0) {
          throw new Error("No USDC token account found for this wallet");
        }

        const tx = await program.methods
          .createGame(gameId, prediction)
          .accounts({
            initiator: publicKey,
            initiatorTokenAccount: initiatorTokenAccount.value[0].pubkey,
            usdcMint: USDC_MINT,
            chainlinkFeed: CHAINLINK_FEED,
            chainlinkProgram: CHAINLINK_PROGRAM_ID,
          })
          .rpc();

        console.log("New game created with signature:", tx);

        return tx;
      } catch (error: any) {
        console.error("Error creating game:", error);
        if (error.logs) {
          console.error("Transaction logs:", error.logs);
        }
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Successfully created game!");
      return queryClient.invalidateQueries({ queryKey: ["game"] });
    },
    onError: (error) => toast.error(`Failed to create game: ${error}`),
  });

  const joinGame = useMutation<string, Error, JoinGameArgs>({
    mutationKey: ["game", "join", { cluster }],
    mutationFn: async ({ gameId, initiator }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        // Derive the game state PDA
        const [gameStatePda] = findGameStatePda(
          initiator,
          gameId,
          program.programId
        );

        // Derive the vault PDA
        const [vaultPda] = findGameVaultPda(
          initiator,
          gameId,
          program.programId
        );

        console.log("Joining game with PDAs:", {
          gameStatePda: gameStatePda.toString(),
          vaultPda: vaultPda.toString(),
        });

        // Get challenger's USDC token account
        const challengerTokenAccount = await connection.getTokenAccountsByOwner(
          publicKey,
          { mint: USDC_MINT }
        );

        if (challengerTokenAccount.value.length === 0) {
          throw new Error("No USDC token account found for this wallet");
        }

        const tx = await program.methods
          .joinGame(gameId, initiator)
          .accounts({
            challenger: publicKey,
            challengerTokenAccount: challengerTokenAccount.value[0].pubkey,
            usdcMint: USDC_MINT,
            chainlinkFeed: CHAINLINK_FEED,
            chainlinkProgram: CHAINLINK_PROGRAM_ID,
          })
          .rpc();

        console.log(
          `Game with ID ${gameId} joined by ${publicKey} with signature:`,
          tx
        );

        return tx;
      } catch (error: any) {
        console.error("Error joining game:", error);
        if (error.logs) {
          console.error("Transaction logs:", error.logs);
        }
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Successfully joined game!");
      return queryClient.invalidateQueries({ queryKey: ["game"] });
    },
    onError: (error) => toast.error(`Failed to join game: ${error}`),
  });

  const closeGame = useMutation<string, Error, CloseGameArgs>({
    mutationKey: ["close", "game", { cluster }],
    mutationFn: async ({ gameId, initiator }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        // Derive the game state PDA
        const [gameStatePda] = findGameStatePda(
          initiator,
          gameId,
          program.programId
        );

        // Derive the vault PDA
        const [vaultPda] = findGameVaultPda(
          initiator,
          gameId,
          program.programId
        );

        // Get winner's USDC token account
        const winnerTokenAccount = await connection.getTokenAccountsByOwner(
          publicKey,
          { mint: USDC_MINT }
        );

        if (winnerTokenAccount.value.length === 0) {
          throw new Error("No USDC token account found for this wallet");
        }

        const tx = await program.methods
          .closeGame(gameId, initiator)
          .accounts({
            winner: publicKey,
            winnerTokenAccount: winnerTokenAccount.value[0].pubkey,
            usdcMint: USDC_MINT,
            chainlinkFeed: CHAINLINK_FEED,
            chainlinkProgram: CHAINLINK_PROGRAM_ID,
          })
          .rpc();

        console.log(`Game with ID ${gameId} closed with signature:`, tx);
        return tx;
      } catch (error: any) {
        console.error("Error ending game:", error);
        if (error.logs) {
          console.error("Transaction logs:", error.logs);
        }
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Successfully ended game!");
      return queryClient.invalidateQueries({ queryKey: ["game"] });
    },
    onError: (error) => toast.error(`Failed to end game: ${error}`),
  });

  const drawGame = useMutation<string, Error, DrawGameArgs>({
    mutationKey: ["draw", "game", { cluster }],
    mutationFn: async ({ gameId, initiator }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        // Derive the game state PDA
        const [gameStatePda] = findGameStatePda(
          initiator,
          gameId,
          program.programId
        );

        // Derive the vault PDA
        const [vaultPda] = findGameVaultPda(
          initiator,
          gameId,
          program.programId
        );

        // Get game state to identify players
        const gameState = await program.account.gameState.fetch(gameStatePda);

        // Get token accounts for both players
        const initiatorTokenAccount = await connection.getTokenAccountsByOwner(
          gameState.initiator,
          { mint: USDC_MINT }
        );

        if (!gameState.challenger) {
          throw new Error("Missing challenger token account");
        }

        const challengerTokenAccount = await connection.getTokenAccountsByOwner(
          gameState.challenger,
          { mint: USDC_MINT }
        );

        if (
          initiatorTokenAccount.value.length === 0 ||
          challengerTokenAccount.value.length === 0
        ) {
          throw new Error("Missing token accounts for players");
        }

        const tx = await program.methods
          .drawGame(gameId, initiator)
          .accounts({
            player: publicKey,
            initiatorTokenAccount: initiatorTokenAccount.value[0].pubkey,
            challengerTokenAccount: challengerTokenAccount.value[0].pubkey,
            usdcMint: USDC_MINT,
          })
          .rpc();

        console.log(`Game with ID ${gameId} drawn with signature:`, tx);
        return tx;
      } catch (error: any) {
        console.error("Error ending game:", error);
        if (error.logs) {
          console.error("Transaction logs:", error.logs);
        }
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Successfully ended game as draw!");
      return queryClient.invalidateQueries({ queryKey: ["game"] });
    },
    onError: (error) => toast.error(`Failed to end game: ${error}`),
  });

  const withdrawGame = useMutation<string, Error, WithdrawGameArgs>({
    mutationKey: ["withdraw", "game", { cluster }],
    mutationFn: async ({ gameId }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        // Derive the game state PDA
        const [gameStatePda] = findGameStatePda(
          publicKey,
          gameId,
          program.programId
        );

        // Derive the vault PDA
        const [vaultPda] = findGameVaultPda(
          publicKey,
          gameId,
          program.programId
        );

        // Get initiator's USDC token account
        const initiatorTokenAccount = await connection.getTokenAccountsByOwner(
          publicKey,
          { mint: USDC_MINT }
        );

        if (initiatorTokenAccount.value.length === 0) {
          throw new Error("No USDC token account found for this wallet");
        }

        const tx = await program.methods
          .withdraw(gameId)
          .accounts({
            initiator: publicKey,
            initiatorTokenAccount: initiatorTokenAccount.value[0].pubkey,
            usdcMint: USDC_MINT,
          })
          .rpc();

        console.log(`Game with ID ${gameId} withdrawn with signature:`, tx);
        return tx;
      } catch (error: any) {
        console.error("Error withdrawing from game:", error);
        if (error.logs) {
          console.error("Transaction logs:", error.logs);
        }
        throw error;
      }
    },
    onSuccess: (signature) => {
      transactionToast(signature);
      toast.success("Successfully cancelled game and withdrawn funds!");
      return queryClient.invalidateQueries({ queryKey: ["game"] });
    },
    onError: (error) => toast.error(`Failed to withdraw from game: ${error}`),
  });

  return {
    program,
    programId,
    getProgramAccount,
    getAllGames,
    getMyGames,
    createGame,
    joinGame,
    closeGame,
    drawGame,
    withdrawGame,
  };
}
