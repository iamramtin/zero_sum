"use client";

import "@solana/wallet-adapter-react-ui/styles.css";
import "react-toastify/dist/ReactToastify.css";
import { useCallback, useMemo } from "react";
import { useZeroSumProgram } from "../zero_sum-data-access";
import { GameStatusTag } from "./components/GameStatusTag";
import { PredictionBadge } from "./components/PredictionBadge";
import { TableHeader } from "./components/TableHeader";
import { EmptyGamesState } from "./components/EmptyGamesState";
import { CommunityWinnerBadge } from "./components/WinnerBadge";
import { CommunityGamesProps } from "../types/components";
import { GameState } from "../types/game";
import {
  isActiveStatus,
  isDrawStatus,
  isCompleteStatus,
  formatGameStatus,
} from "../utils/gameUtils";
import { formatUnixTimestampBN } from "../utils/timeUtils";

// Number of community games to show
const TOTAL_COMMUNITY_GAMES = 10;

// Game type enum for filtering/segmenting
enum GameType {
  COMPLETED_USER = "Your Completed Games",
  COMMUNITY = "Community Games",
}

// Helper function to check if a game is relevant for community display
const isRelevantCommunityGame = (game: GameState): boolean => {
  return (
    isActiveStatus(game.status) ||
    isDrawStatus(game.status) ||
    isCompleteStatus(game.status)
  );
};

const GameOutcomeIndicator = ({
  game,
  priceChange,
}: {
  game: GameState;
  priceChange: number;
}): JSX.Element | null => {
  // Only show for completed games
  if (!isCompleteStatus(game.status)) return null;

  // Determine actual price direction
  const actualDirection = priceChange >= 0 ? "increase" : "decrease";

  // Determine which player had the correct prediction
  const initiatorPrediction =
    "increase" in game.initiatorPrediction ? "increase" : "decrease";

  const winningPrediction = actualDirection;
  const winnerRole =
    initiatorPrediction === winningPrediction ? "Initiator" : "Challenger";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-purple-600">
        Winner: {winnerRole}
      </span>
    </div>
  );
};

const GameTypeHeader = ({ type }: { type: GameType }): JSX.Element => {
  const bgColor =
    type === GameType.COMPLETED_USER ? "bg-blue-50" : "bg-purple-50";
  const textColor =
    type === GameType.COMPLETED_USER ? "text-blue-700" : "text-purple-700";

  return (
    <tr className={`${bgColor} border-t border-b`}>
      <td
        colSpan={9}
        className={`px-6 py-2 text-sm font-semibold ${textColor}`}
      >
        {type}
      </td>
    </tr>
  );
};

export function CommunityGames({
  allGames,
  userGames,
  openGames,
  priceData,
  publicKey,
}: CommunityGamesProps): JSX.Element {
  const { calculatePriceChange } = useZeroSumProgram(priceData);

  // Filter completed user games
  const completedUserGames = useMemo(() => {
    return userGames
      .filter((game) => isCompleteStatus(game.status))
      .sort(
        (a, b) =>
          formatUnixTimestampBN(b.createdAt).getTime() -
          formatUnixTimestampBN(a.createdAt).getTime()
      );
  }, [userGames]);

  // Filter community games - only active, draw, or completed games
  const communityGames = useMemo(() => {
    if (!publicKey) return [];

    const userGameIds = new Set(
      userGames.map((game) => game.gameId.toString())
    );
    const openGameIds = new Set(
      openGames.map((game) => game.gameId.toString())
    );

    return allGames.filter((game) => {
      const gameId = game.gameId.toString();
      const isUserGame = userGameIds.has(gameId);
      const isOpenGame = openGameIds.has(gameId);
      const hasChallenger = !!game.challenger;

      // Only include relevant game states (active, draw, complete)
      const hasRelevantStatus = isRelevantCommunityGame(game);

      // We only want games that:
      // 1. Are not the user's
      // 2. Are not open for joining
      // 3. Have a challenger (means they've been accepted)
      // 4. Are in active, draw, or complete status
      return !isUserGame && !isOpenGame && hasChallenger && hasRelevantStatus;
    });
  }, [allGames, userGames, openGames, publicKey]);

  // Memoized table headings
  const tableHeadings = useMemo<string[]>(
    () => [
      "#",
      "Game ID",
      "Initiator",
      "Challenger",
      "Initial Price",
      "Predictions",
      "Status",
      "Started",
      "Outcome",
    ],
    []
  );

  const topCommunityGames = useMemo(() => {
    return [...communityGames]
      .sort(
        (a, b) =>
          formatUnixTimestampBN(b.createdAt).getTime() -
          formatUnixTimestampBN(a.createdAt).getTime()
      )
      .slice(0, TOTAL_COMMUNITY_GAMES);
  }, [communityGames]);

  // Render game row
  const renderGameRow = useCallback(
    (game: GameState, index: number, type: GameType): JSX.Element => {
      const gameIdStr = game.gameId.toString();
      const initiatorAddr = game.initiator.toString();
      const challengerAddr = game.challenger?.toString() || "";
      const initiatorPrediction = game.initiatorPrediction;
      const challengerPrediction =
        "increase" in initiatorPrediction ? { decrease: {} } : { increase: {} };

      // Format timestamps
      const startedAt = game.startedAt
        ? formatUnixTimestampBN(game.startedAt)
        : null;

      // Calculate price change
      const priceChange =
        priceData?.price !== undefined
          ? calculatePriceChange(priceData.price, game.initialPrice)
          : 0;

      // Determine winner address
      let winnerAddress = null;
      if (isCompleteStatus(game.status)) {
        const initiatorPrediction = "increase" in game.initiatorPrediction;
        const priceIncreased = priceChange >= 0;

        if (
          (initiatorPrediction && priceIncreased) ||
          (!initiatorPrediction && !priceIncreased)
        ) {
          winnerAddress = initiatorAddr;
        } else if (challengerAddr) {
          winnerAddress = challengerAddr;
        }
      }

      // Highlight if it's a user game
      const isUserGame = type === GameType.COMPLETED_USER;
      const rowClass = isUserGame
        ? "bg-blue-50 hover:bg-blue-100"
        : "hover:bg-gray-50";

      return (
        <tr key={`${type}-${gameIdStr}`} className={rowClass}>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {index + 1}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            {gameIdStr.substring(0, 6)}...
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 truncate max-w-[120px]">
                {initiatorAddr.substring(0, 6)}...
              </span>
              <CommunityWinnerBadge game={game} address={initiatorAddr} />
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm">
            <div className="flex flex-col gap-1">
              <span className="text-gray-500 truncate max-w-[120px]">
                {challengerAddr ? `${challengerAddr.substring(0, 6)}...` : "-"}
              </span>
              {challengerAddr && (
                <CommunityWinnerBadge game={game} address={challengerAddr} />
              )}
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            ${game.initialPrice.toFixed(2)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Initiator:</span>
                <PredictionBadge prediction={initiatorPrediction} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Challenger:</span>
                <PredictionBadge prediction={challengerPrediction} />
              </div>
            </div>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
            {GameStatusTag(formatGameStatus(game.status))}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {startedAt ? startedAt.toLocaleString() : "-"}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <GameOutcomeIndicator game={game} priceChange={priceChange} />
          </td>
        </tr>
      );
    },
    [priceData, calculatePriceChange]
  );

  // Check if we have any games to display
  const hasGamesToDisplay =
    completedUserGames.length > 0 || topCommunityGames.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-3 transition-all border border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">
          Community Games
        </h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-gray-700">
              Your Completed Games ({completedUserGames.length})
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
            <span className="text-gray-700">
              Community Games (Showing {topCommunityGames.length} of{" "}
              {communityGames.length})
            </span>
          </div>
        </div>
      </div>

      {hasGamesToDisplay ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <TableHeader headings={tableHeadings} />
            <tbody className="bg-white divide-y divide-gray-200">
              {/* First show completed user games with a header */}
              {completedUserGames.length > 0 && (
                <>
                  <GameTypeHeader type={GameType.COMPLETED_USER} />
                  {completedUserGames.map((game, index) =>
                    renderGameRow(game, index, GameType.COMPLETED_USER)
                  )}
                </>
              )}

              {/* Then show community games with a header */}
              {topCommunityGames.length > 0 && (
                <>
                  <GameTypeHeader type={GameType.COMMUNITY} />
                  {topCommunityGames.map((game, index) =>
                    renderGameRow(game, index, GameType.COMMUNITY)
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyGamesState />
      )}
    </div>
  );
}
