"use client";

import BN from "bn.js";
import { getZeroSumProgram, getZeroSumProgramId } from "@project/anchor";
import {
  useAnchorWallet,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import { EventParser } from "@coral-xyz/anchor";
import { Cluster, PublicKey } from "@solana/web3.js";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useCluster } from "../cluster/cluster-data-access";
import { useAnchorProvider } from "../solana/solana-provider";
import { useTransactionToast } from "../ui/ui-layout";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { toast } from "react-toastify";
import { PriceData } from "@/components/zero_sum/types/price";
import { CONSTANTS } from "@/components/zero_sum/constants";
import {
  handlePriceFetched,
  handlePriceChanged,
  handleGameCreated,
  handleGameClosed,
  handleGameJoined,
} from "./utils/eventUtils";

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

export interface CancelGameArgs {
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

export function useZeroSumProgram(priceData: PriceData | null) {
  const anchorWallet = useAnchorWallet();
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
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

  const eventParser = new EventParser(program.programId, program.coder);

  function handleTransactionEvents(logMessages: string[] | null | undefined) {
    if (logMessages == null || logMessages == undefined) return;

    const events = eventParser.parseLogs(logMessages);

    for (const event of events) {
      console.log("event.name", event.name);

      switch (event.name) {
        case "priceFetched":
          console.log("Price Fetched Event", event.data);
          handlePriceFetched(event.data);
          break;
        case "priceChanged":
          console.log("Price Changed Event", event.data);
          handlePriceChanged(event.data);
          break;
        case "gameCreated":
          console.log("Game Created Event", event.data);
          handleGameCreated(event.data);
          break;
        case "gameJoined":
          console.log("Game Joined Event", event.data);
          handleGameJoined(event.data);
          break;
        case "gameClosed":
          console.log("Game Closed Event", event.data);
          handleGameClosed(event.data)
          break;
        default:
          console.warn("Unknown event", event);
      }
    }
  }

  // Calculate price change percentage
  const calculatePriceChange = useCallback(
    (currentPrice: number, basePrice: number): number => {
      return ((currentPrice - basePrice) / basePrice) * 100;
    },
    []
  );

  // Query to fetch all game accounts
  const getGames = useQuery({
    queryKey: ["games", "allGames", { cluster }],
    queryFn: async () => {
      try {
        // Fetch all game state accounts without the authority filter
        const accounts = await program.account.gameState.all();

        return accounts.map((account) => ({
          publicKey: account.publicKey,
          ...account.account,
        }));
      } catch (error: any) {
        console.error("Error fetching games:", error);
        console.error("Error details:", error.stack);
        return [];
      }
    },
    enabled: !!provider,
  });

  const createGame = useMutation<string, Error, CreateGameArgs>({
    mutationKey: ["game", "create", { cluster }],
    mutationFn: async ({ gameId, prediction }) => {
      if (!publicKey || !connected || !anchorWallet) {
        toast.error("Please connect your wallet first");
        throw new Error("Wallet not connected");
      }

      if (!priceData?.price) {
        toast.error("Please wait for prices to load");
        throw new Error("Price feed not loaded");
      }

      try {
        const initiatorTokenAccount = await getAssociatedTokenAddress(
          CONSTANTS.USDC_MINT,
          publicKey
        );

        const tx = await program.methods
          .createGame(gameId, prediction)
          .accounts({
            initiator: publicKey,
            initiatorTokenAccount,
            usdcMint: CONSTANTS.USDC_MINT,
            chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
            chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
          })
          .transaction();

        const txSignature = await provider.sendAndConfirm(tx, []);

        const txDetails = await provider.connection.getParsedTransaction(
          txSignature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }
        );

        handleTransactionEvents(txDetails?.meta?.logMessages);

        console.log("New game created with signature:", tx);
        return txSignature;
      } catch (error: any) {
        toast.error("Unable to create game");
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
    onError: (error) => console.error(`Failed to create game: ${error}`),
  });

  const joinGame = useMutation<string, Error, JoinGameArgs>({
    mutationKey: ["game", "join", { cluster }],
    mutationFn: async ({ gameId, initiator }) => {
      if (!publicKey || !connected || !anchorWallet) {
        toast.error("Please connect your wallet first");
        throw new Error("Wallet not connected");
      }

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
          { mint: CONSTANTS.USDC_MINT }
        );

        if (challengerTokenAccount.value.length === 0) {
          throw new Error("No USDC token account found for this wallet");
        }

        const tx = await program.methods
          .joinGame(gameId, initiator)
          .accounts({
            challenger: publicKey,
            challengerTokenAccount: challengerTokenAccount.value[0].pubkey,
            usdcMint: CONSTANTS.USDC_MINT,
            chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
            chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
          })
          .transaction();

        const txSignature = await provider.sendAndConfirm(tx, []);

        const txDetails = await provider.connection.getParsedTransaction(
          txSignature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }
        );

        handleTransactionEvents(txDetails?.meta?.logMessages);

        console.log(
          `Game with ID ${gameId} joined by ${publicKey} with signature:`,
          tx
        );

        return txSignature;
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
      if (!publicKey || !connected || !anchorWallet) {
        toast.error("Please connect your wallet first");
        throw new Error("Wallet not connected");
      }

      try {
        // Get winner's USDC token account
        const winnerTokenAccount = await connection.getTokenAccountsByOwner(
          publicKey,
          { mint: CONSTANTS.USDC_MINT }
        );

        if (winnerTokenAccount.value.length === 0) {
          throw new Error("No USDC token account found for this wallet");
        }

        const tx = await program.methods
          .closeGame(gameId, initiator)
          .accounts({
            winner: publicKey,
            winnerTokenAccount: winnerTokenAccount.value[0].pubkey,
            usdcMint: CONSTANTS.USDC_MINT,
            chainlinkFeed: CONSTANTS.CHAINLINK_FEED_ADDRESS,
            chainlinkProgram: CONSTANTS.CHAINLINK_ONCHAIN_PROGRAM_ID,
          })
          .transaction();

        const txSignature = await provider.sendAndConfirm(tx, []);

        const txDetails = await provider.connection.getParsedTransaction(
          txSignature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }
        );

        handleTransactionEvents(txDetails?.meta?.logMessages);

        console.log(`Game with ID ${gameId} closed with signature:`, tx);
        return txSignature;
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
      if (!publicKey || !connected || !anchorWallet) {
        toast.error("Please connect your wallet first");
        throw new Error("Wallet not connected");
      }

      try {
        // Derive the game state PDA
        const [gameStatePda] = findGameStatePda(
          initiator,
          gameId,
          program.programId
        );

        // Get game state to identify players
        const gameState = await program.account.gameState.fetch(gameStatePda);

        // Get token accounts for both players
        const initiatorTokenAccount = await connection.getTokenAccountsByOwner(
          gameState.initiator,
          { mint: CONSTANTS.USDC_MINT }
        );

        if (!gameState.challenger) {
          throw new Error("Missing challenger token account");
        }

        const challengerTokenAccount = await connection.getTokenAccountsByOwner(
          gameState.challenger,
          { mint: CONSTANTS.USDC_MINT }
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
            usdcMint: CONSTANTS.USDC_MINT,
          })
          .transaction();

        const txSignature = await provider.sendAndConfirm(tx, []);

        const txDetails = await provider.connection.getParsedTransaction(
          txSignature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }
        );

        handleTransactionEvents(txDetails?.meta?.logMessages);

        console.log(`Game with ID ${gameId} drawn with signature:`, tx);
        return txSignature;
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

  const cancelGame = useMutation<string, Error, CancelGameArgs>({
    mutationKey: ["cancel", "game", { cluster }],
    mutationFn: async ({ gameId }) => {
      if (!publicKey) throw new Error("Wallet not connected");

      try {
        // Get initiator's USDC token account
        const initiatorTokenAccount = await connection.getTokenAccountsByOwner(
          publicKey,
          { mint: CONSTANTS.USDC_MINT }
        );

        if (initiatorTokenAccount.value.length === 0) {
          throw new Error("No USDC token account found for this wallet");
        }

        const tx = await program.methods
          .cancelGame(gameId)
          .accounts({
            initiator: publicKey,
            initiatorTokenAccount: initiatorTokenAccount.value[0].pubkey,
            usdcMint: CONSTANTS.USDC_MINT,
          })
          .transaction();

        const txSignature = await provider.sendAndConfirm(tx, []);

        const txDetails = await provider.connection.getParsedTransaction(
          txSignature,
          {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
          }
        );

        handleTransactionEvents(txDetails?.meta?.logMessages);

        console.log(`Game with ID ${gameId} cancelled with signature:`, tx);
        return txSignature;
      } catch (error: any) {
        console.error("Error cancelling game:", error);
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
    calculatePriceChange,
    getProgramAccount,
    getGames,
    createGame,
    joinGame,
    closeGame,
    drawGame,
    cancelGame,
  };
}
