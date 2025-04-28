"use client";

import "react-toastify/dist/ReactToastify.css";
import BN from "bn.js";
import { CONSTANTS } from "../constants";
import { useZeroSumProgram } from "../zero_sum-data-access";
import { PublicKey } from "@solana/web3.js";
import { useCallback, useMemo, useState } from "react";
import { EmptyGamesState } from "./components/EmptyGamesState";
import { PredictionBadge } from "./components/PredictionBadge";
import { TableHeader } from "./components/TableHeader";
import { JoinButton } from "./components/JoinButton";
import { OpenGamesProps } from "../types/components";
import { GameState } from "../types/game";
import { formatUnixTimestampBN } from "../utils/timeUtils";

require("@solana/wallet-adapter-react-ui/styles.css");

// Type definitions
type JoinActionType = "joining";
type LoadingStateType = Record<string, JoinActionType>;

/**
 * Component to display open games that user can join
 */
export function OpenGames({
  openGames: initialOpenGames,
  priceData,
  publicKey,
}: OpenGamesProps): JSX.Element {
  const { calculatePriceChange, joinGame } = useZeroSumProgram(priceData);

  // Local state for immediate UI updates
  const [openGames, setOpenGames] = useState<GameState[]>(initialOpenGames);
  const [loadingStates, setLoadingStates] = useState<LoadingStateType>({});

  // Update local state when props change
  useMemo(() => {
    setOpenGames(initialOpenGames);
  }, [initialOpenGames]);

  // Memoized table headings
  const tableHeadings = useMemo<string[]>(
    () => [
      "#",
      "Game ID",
      "Created",
      "Initiator",
      "Their Prediction",
      "Your Prediction",
      "Initial Price",
      "Price Change",
      "Actions",
    ],
    []
  );

  // Load state handling functions
  const setLoading = useCallback((gameId: BN, type: JoinActionType): void => {
    setLoadingStates((prev) => ({ ...prev, [gameId.toString()]: type }));
  }, []);

  const clearLoading = useCallback((gameId: BN): void => {
    setLoadingStates((prev) => {
      const updated = { ...prev };
      delete updated[gameId.toString()];
      return updated;
    });
  }, []);

  // Update game status in local state
  const updateGameJoined = useCallback(
    (gameId: BN): void => {
      setOpenGames((prevGames) =>
        prevGames.map((game) =>
          game.gameId.toString() === gameId.toString()
            ? {
                ...game,
                startedAt: new BN(Math.floor(Date.now() / 1000)),
                challenger: publicKey || undefined,
              }
            : game
        )
      );
    },
    [publicKey]
  );

  // Handle join game with immediate UI updates
  const handleJoin = useCallback(
    async (gameId: BN, initiator: PublicKey): Promise<void> => {
      if (!publicKey || !gameId || loadingStates[gameId.toString()]) return;

      try {
        setLoading(gameId, "joining");

        // Update UI immediately for better user experience
        updateGameJoined(gameId);

        // Then make the actual API call
        await joinGame.mutateAsync({
          gameId: new BN(gameId),
          initiator,
        });
      } catch (error) {
        console.error("Error joining game:", error);
        // If we had error recovery, we would revert the optimistic update here
      } finally {
        clearLoading(gameId);
      }
    },
    [
      publicKey,
      loadingStates,
      joinGame,
      setLoading,
      clearLoading,
      updateGameJoined,
    ]
  );

  // Sort games by creation date, newest first
  const sortedGames = useMemo<GameState[]>(() => {
    return [...openGames].sort(
      (a, b) =>
        formatUnixTimestampBN(b.createdAt).getTime() -
        formatUnixTimestampBN(a.createdAt).getTime()
    );
  }, [openGames]);

  // Render game rows
  const renderGameRows = useCallback((): JSX.Element[] => {
    return sortedGames.map((game, index) => {
      const gameIdStr = game.gameId.toString();
      const opponentPrediction = game.initiatorPrediction;
      const userPrediction =
        "increase" in opponentPrediction ? { decrease: {} } : { increase: {} };

      const createdAt = formatUnixTimestampBN(game.createdAt);

      // Calculate price change
      const priceChange: number =
        priceData?.price !== undefined
          ? calculatePriceChange(priceData.price, game.initialPrice)
          : 0;

      // Check if can join based on price movement
      const canJoin =
        Math.abs(priceChange) <= CONSTANTS.MAX_JOIN_PRICE_MOVEMENT;

      return (
        <tr key={gameIdStr} className="hover:bg-gray-50">
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {index + 1}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            {gameIdStr}
          </td>
          <td className="px-6 py-4 text-sm text-gray-500">
            {createdAt.toLocaleString()}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[120px] truncate">
            {game.initiator.toString().substring(0, 8)}...
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <PredictionBadge prediction={opponentPrediction} />
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <PredictionBadge prediction={userPrediction} />
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${game.initialPrice.toFixed(2)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                canJoin
                  ? "bg-green-100 text-green-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {priceChange > 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
            <JoinButton
              game={game}
              canJoin={canJoin}
              loadingState={loadingStates[gameIdStr]}
              onJoin={handleJoin}
            />
          </td>
        </tr>
      );
    });
  }, [sortedGames, priceData, calculatePriceChange, handleJoin, loadingStates]);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-3 transition-all hover:shadow-xl border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Open Games to Join
      </h2>

      {openGames.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <TableHeader headings={tableHeadings} />
            <tbody className="bg-white divide-y divide-gray-200">
              {renderGameRows()}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyGamesState />
      )}
    </div>
  );
}
