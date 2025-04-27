"use client";

import BN from "bn.js";
import { useEffect, useState, useCallback, useMemo } from "react";
import { PublicKey } from "@solana/web3.js";
import { CONSTANTS } from "../constants";
import { useZeroSumProgram } from "../zero_sum-data-access";
import { GameActionType, UserGamesProps, GameState } from "../types";
import {
  formatDuration,
  formatUnixTimestampBN,
  getStatusText,
  getTimeRemaining,
  getUserPrediction,
  isDecreasePrediction,
  isIncreasePrediction,
  isCompleteStatus,
  arePredictionsEqual,
} from "../utils/utils";

import "@solana/wallet-adapter-react-ui/styles.css";
import "react-toastify/dist/ReactToastify.css";
import { GameStatusTag } from "./components/GameStatusTag";
import { PredictionBadge } from "./components/PredictionBadge";
import { ActionButton } from "./components/ActionButton";
import { EmptyGamesState } from "./components/EmptyGamesState";
import { TableHeader } from "./components/TableHeader";
import { VictoryCelebration } from "./components/VictoryCelebration";

type LoadingStateType = Record<string, GameActionType>;

export function UserGames({
  userGames,
  priceData,
  publicKey,
}: UserGamesProps): JSX.Element {
  const { calculatePriceChange, cancelGame, drawGame, closeGame } =
    useZeroSumProgram(priceData);

  const [timeNow, setTimeNow] = useState<number>(Date.now());
  const [loadingStates, setLoadingStates] = useState<LoadingStateType>({});
  const [showVictory, setShowVictory] = useState<boolean>(false);
  const [victoryAmount, setVictoryAmount] = useState<string>("");
  const [victoryGame, setVictoryGame] = useState<GameState | null>(null);

  // Setup interval with proper cleanup
  useEffect(() => {
    const interval = setInterval(() => setTimeNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Memoized table headings
  const tableHeadings = useMemo<string[]>(
    () => [
      "#",
      "Game ID",
      "Created",
      "Role",
      "Prediction",
      "Initial Price",
      "Status",
      "Time Remaining",
      "Price Change",
      "Action",
    ],
    []
  );

  // Load state handling functions
  const setLoading = useCallback((gameId: BN, type: GameActionType): void => {
    setLoadingStates((prev) => ({ ...prev, [gameId.toString()]: type }));
  }, []);

  const clearLoading = useCallback((gameId: BN): void => {
    setLoadingStates((prev) => {
      const newState = { ...prev };
      delete newState[gameId.toString()];
      return newState;
    });
  }, []);

  // Handle game actions
  const handleAction = useCallback(
    async (action: GameActionType, game: GameState): Promise<void> => {
      const gameId = game.gameId;

      if (!publicKey || !gameId || loadingStates[gameId.toString()]) return;

      const actionMap: Record<GameActionType, any> = {
        close: closeGame,
        cancel: cancelGame,
        draw: drawGame,
      };

      const mutation = actionMap[action];
      if (!mutation) return;

      try {
        setLoading(gameId, action);
        await mutation.mutateAsync({ gameId, initiator: game.initiator });

        // If this was a close action and the user is winning, show the victory celebration
        if (action === "close") {
          const isInitiator =
            game.initiator.toString() === publicKey?.toString();
          const userPrediction = getUserPrediction(
            game.initiatorPrediction,
            isInitiator
          );

          // Calculate if user is winning
          const priceChange =
            priceData?.price !== undefined
              ? calculatePriceChange(priceData.price, game.initialPrice)
              : 0;

          const isWinning =
            (priceChange > Math.abs(CONSTANTS.WIN_PRICE_THRESHOLD) &&
              isIncreasePrediction(userPrediction)) ||
            (priceChange < -Math.abs(CONSTANTS.WIN_PRICE_THRESHOLD) &&
              isDecreasePrediction(userPrediction));

          if (isWinning) {
            // Calculate the prize amount (entry amount * 2 - fees)
            const entryAmount = game.entryAmount.toNumber() / 1_000_000; // Convert from lamports to USDC
            // const prize = (entryAmount * 2 * 0.95).toFixed(2); // Assuming 5% fee
            const prize = (entryAmount * 2).toFixed(2);

            setVictoryAmount(prize);
            setVictoryGame(game);
            setShowVictory(true);
          }
        }
      } catch (err) {
        console.error(`Error during ${action}:`, err);
      } finally {
        clearLoading(gameId);
      }
    },
    [
      publicKey,
      loadingStates,
      closeGame,
      cancelGame,
      drawGame,
      setLoading,
      clearLoading,
      priceData,
      calculatePriceChange,
    ]
  );

  // Handle victory celebration completion
  const handleVictoryComplete = useCallback(() => {
    setShowVictory(false);
    setVictoryGame(null);
  }, []);

  // Sort games by creation date, newest first
  const sortedGames = useMemo<GameState[]>(() => {
    return [...userGames].sort(
      (a, b) =>
        formatUnixTimestampBN(b.createdAt).getTime() -
        formatUnixTimestampBN(a.createdAt).getTime()
    );
  }, [userGames]);

  // Render game rows
  const renderGameRows = useCallback((): JSX.Element[] => {
    return sortedGames.map((game, index) => {
      const gameIdStr = game.gameId.toString();
      const isInitiator = game.initiator.toString() === publicKey?.toString();
      const createdAt = formatUnixTimestampBN(game.createdAt);
      const startedAt = game.startedAt
        ? formatUnixTimestampBN(game.startedAt)
        : null;
      const userPrediction = getUserPrediction(
        game.initiatorPrediction,
        isInitiator
      );

      // Calculate price change
      const priceChange: number =
        priceData?.price !== undefined
          ? calculatePriceChange(priceData.price, game.initialPrice)
          : 0;

      // Calculate time remaining
      const timeRemaining = getTimeRemaining(
        startedAt,
        CONSTANTS.GAME_TIMEOUT_SECONDS,
        timeNow
      );
      const timeRemainingStr =
        timeRemaining === 0
          ? "Timeout reached"
          : timeRemaining !== null
          ? formatDuration(timeRemaining)
          : "-";

      // Determine if user is winning/won
      const isWinning: boolean =
        (priceChange > Math.abs(CONSTANTS.WIN_PRICE_THRESHOLD) &&
          isIncreasePrediction(userPrediction)) ||
        (priceChange < -Math.abs(CONSTANTS.WIN_PRICE_THRESHOLD) &&
          isDecreasePrediction(userPrediction));

      // Check if the game is complete
      const isComplete = isCompleteStatus(game.status);

      // For completed games, determine if user is winner using stored winning prediction
      const userIsWinner =
        isComplete && game.winningPrediction
          ? arePredictionsEqual(game.winningPrediction, userPrediction)
          : null;

      // Set row background based on game status and outcome
      let rowClass = isComplete
        ? userIsWinner
          ? "bg-green-50 hover:bg-green-100"
          : "bg-red-50 hover:bg-red-100"
        : "hover:bg-gray-50";

      // Get the status text
      const statusText = getStatusText(game.status);

      // Determine if the game is the one that was just won (for highlighting)
      const isRecentlyWon =
        victoryGame && victoryGame.gameId.toString() === gameIdStr;
      if (isRecentlyWon) {
        rowClass = "bg-yellow-50 hover:bg-yellow-100 animate-pulse";
      }

      return (
        <tr key={gameIdStr} className={rowClass}>
          <td className="px-6 py-4 text-sm text-gray-500">{index + 1}</td>
          <td className="px-6 py-4 font-medium text-sm text-gray-900">
            {gameIdStr}
          </td>
          <td className="px-6 py-4 text-sm text-gray-500">
            {createdAt.toLocaleString()}
          </td>
          <td className="px-6 py-4 text-sm text-gray-500">
            {isInitiator ? "Initiator" : "Challenger"}
          </td>
          <td className="px-6 py-4 text-sm font-medium">
            <PredictionBadge prediction={userPrediction} />
          </td>
          <td className="px-6 py-4 text-sm text-gray-500">
            ${game.initialPrice.toFixed(2)}
          </td>
          <td className="px-6 py-4">{GameStatusTag(statusText)}</td>
          <td className="px-6 py-4 text-sm text-gray-500">
            {timeRemainingStr}
          </td>
          <td className="px-6 py-4 text-sm">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                priceChange > 0
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {priceChange > 0 ? "+" : ""}
              {priceChange.toFixed(2)}%
            </span>
          </td>
          <td className="px-6 py-4 text-sm font-medium">
            <ActionButton
              game={game}
              isWinning={isWinning}
              timeRemaining={timeRemaining}
              publicKey={publicKey}
              onAction={handleAction}
              loadingState={loadingStates[gameIdStr]}
            />
          </td>
        </tr>
      );
    });
  }, [
    publicKey,
    priceData,
    sortedGames,
    timeNow,
    loadingStates,
    victoryGame,
    calculatePriceChange,
    handleAction,
  ]);

  // Organize games by status for statistics
  const gameStats = useMemo(() => {
    const total = userGames.length;
    const won = userGames.filter((game) => {
      if (!isCompleteStatus(game.status)) return false;

      const isInitiator = game.initiator.toString() === publicKey?.toString();
      const userPrediction = getUserPrediction(
        game.initiatorPrediction,
        isInitiator
      );

      const userIsWinner = game.winningPrediction
        ? arePredictionsEqual(game.winningPrediction, userPrediction)
        : null;

      return userIsWinner;
    }).length;

    const active = userGames.filter(
      (game) => !isCompleteStatus(game.status)
    ).length;

    return { total, won, active };
  }, [userGames, publicKey]);

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-3 border border-gray-100">
      {showVictory && (
        <VictoryCelebration
          show={showVictory}
          onComplete={handleVictoryComplete}
          prize={`You won ${victoryAmount} USDC!`}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">My Games</h2>

        {userGames.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
              <span className="text-gray-700">Total: {gameStats.total}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
              <span className="text-gray-700">Won: {gameStats.won}</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
              <span className="text-gray-700">Active: {gameStats.active}</span>
            </div>
          </div>
        )}
      </div>

      {userGames.length > 0 ? (
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
