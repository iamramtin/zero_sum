"use client";

import "react-toastify/dist/ReactToastify.css";
import BN from "bn.js";
import { CONSTANTS } from "../constants";
import { useZeroSumProgram } from "../zero_sum-data-access";
import { UserGamesProps } from "../types";
import {
  formatTimeRemaining,
  formatUnixTimestampBN,
  getGameStatus,
  getUserPrediction,
  isDecrease,
  isIncrease,
} from "../utils/utils";
import { renderStatusTag } from "../utils/getGameStatus";
import { PublicKey } from "@solana/web3.js";
import { useEffect, useMemo, useState } from "react";

require("@solana/wallet-adapter-react-ui/styles.css");

export function UserGames({
  userGames,
  priceData,
  publicKey,
}: UserGamesProps): JSX.Element {
  const { calculatePriceChange, cancelGame, drawGame, closeGame } =
    useZeroSumProgram(priceData);

  const [timeNow, setTimeNow] = useState(Date.now());
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>(
    {}
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeNow(Date.now());
    }, 1000); // Update every second

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const setLoading = (gameId: BN, type: string) => {
    setLoadingStates((prev) => ({ ...prev, [gameId.toString()]: type }));
  };

  const clearLoading = (gameId: BN) => {
    setLoadingStates((prev) => {
      const updated = { ...prev };
      delete updated[gameId.toString()];
      return updated;
    });
  };

  const handleClose = async (gameId: BN, initiator: PublicKey) => {
    if (!publicKey || !gameId || loadingStates[gameId.toString()]) return;
    try {
      setLoading(gameId, "closing");
      await closeGame.mutateAsync({ gameId, initiator });
    } catch (err) {
      console.error("Error closing game:", err);
    } finally {
      clearLoading(gameId);
    }
  };

  const handleCancel = async (gameId: BN) => {
    if (!publicKey || !gameId || loadingStates[gameId.toString()]) return;
    try {
      setLoading(gameId, "cancelling");
      await cancelGame.mutateAsync({ gameId });
    } catch (err) {
      console.error("Error cancelling game:", err);
    } finally {
      clearLoading(gameId);
    }
  };

  const handleDraw = async (gameId: BN, initiator: PublicKey) => {
    if (!publicKey || !gameId || loadingStates[gameId.toString()]) return;
    try {
      setLoading(gameId, "drawing");
      await drawGame.mutateAsync({ gameId, initiator });
    } catch (err) {
      console.error("Error drawing game:", err);
    } finally {
      clearLoading(gameId);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-3 border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">My Games</h2>

      {userGames.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "#",
                  "Game ID",
                  "Your Role",
                  "Your Prediction",
                  "Initial Price",
                  "Status",
                  "Created At",
                  "Time Remaining",
                  "Price Change",
                  "Action",
                ].map((label) => (
                  <th
                    key={label}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userGames
                .sort(
                  (a, b) =>
                    formatUnixTimestampBN(b.createdAt).getTime() -
                    formatUnixTimestampBN(a.createdAt).getTime()
                )
                .map((game, index) => {
                  const isInitiator =
                    game.initiator.toString() === publicKey?.toString();
                  const createdAt = formatUnixTimestampBN(game.createdAt);
                  const startedAt = game.startedAt
                    ? formatUnixTimestampBN(game.startedAt)
                    : null;

                  const userPrediction = getUserPrediction(
                    game.initiatorPrediction,
                    isInitiator
                  );

                  const status = getGameStatus(game);
                  const priceChange =
                    priceData?.price !== undefined
                      ? calculatePriceChange(priceData.price, game.initialPrice)
                      : 0;

                  const canClose =
                    game.challenger &&
                    Math.abs(priceChange) >= CONSTANTS.PRICE_CHANGE_THRESHOLD;

                  const isWinning =
                    canClose &&
                    ((priceChange > 0 && isIncrease(userPrediction)) ||
                      (priceChange < 0 && isDecrease(userPrediction)));

                  const gameAge =
                    Date.now() - (startedAt || createdAt).getTime();
                  const canDraw = gameAge >= CONSTANTS.GAME_TIMEOUT;

                  return (
                    <tr
                      key={game.gameId.toString()}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {game.gameId.toString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {isInitiator ? "Initiator" : "Challenger"}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {isIncrease(userPrediction) ? (
                          <span className="text-green-800 bg-green-100 px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                            ▲ Increase
                          </span>
                        ) : (
                          <span className="text-red-800 bg-red-100 px-2 py-1 rounded-full text-xs font-medium inline-flex items-center">
                            ▼ Decrease
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        ${game.initialPrice.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">{renderStatusTag(status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {createdAt.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatTimeRemaining(
                          startedAt,
                          CONSTANTS.GAME_TIMEOUT,
                          timeNow
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            priceChange > 0
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-yellow-800"
                          }`}
                        >
                          {priceChange > 0 ? "+" : ""}
                          {priceChange.toFixed(2)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {!game.challenger && isInitiator ? (
                          <button
                            onClick={() => handleCancel(game.gameId)}
                            disabled={
                              loadingStates[game.gameId.toString()] ===
                                "cancelling" ||
                              !!game.startedAt ||
                              !!game.closedAt ||
                              !!game.cancelledAt
                            }
                            className="text-yellow-600 border border-yellow-500 bg-yellow-50 hover:bg-yellow-100 px-3 py-1 rounded-lg text-sm disabled:opacity-50"
                          >
                            {loadingStates[game.gameId.toString()] ===
                            "cancelling"
                              ? "Cancelling..."
                              : game.cancelledAt
                              ? "Cancelled"
                              : "Cancel"}
                          </button>
                        ) : isWinning ? (
                          <button
                            onClick={() =>
                              handleClose(game.gameId, game.initiator)
                            }
                            disabled={
                              loadingStates[game.gameId.toString()] ===
                                "closing" ||
                              !game.startedAt ||
                              !!game.closedAt ||
                              !!game.cancelledAt
                            }
                            className="text-purple-600 border border-purple-500 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg text-sm disabled:opacity-50"
                          >
                            {loadingStates[game.gameId.toString()] === "closing"
                              ? "Closing..."
                              : game.closedAt
                              ? "Closed"
                              : "Claim Win"}
                          </button>
                        ) : canDraw ? (
                          <button
                            onClick={() =>
                              handleDraw(game.gameId, game.initiator)
                            }
                            disabled={
                              loadingStates[game.gameId.toString()] ===
                                "drawing" ||
                              !game.startedAt ||
                              !!game.closedAt ||
                              !!game.cancelledAt
                            }
                            className="text-gray-600 border border-gray-400 bg-gray-50 hover:bg-gray-100 px-3 py-1 rounded-lg text-sm disabled:opacity-50"
                          >
                            {loadingStates[game.gameId.toString()] === "drawing"
                              ? "Processing..."
                              : game.closedAt
                              ? "Drawn"
                              : "Draw"}
                          </button>
                        ) : (
                          <span className="text-gray-500 italic text-sm">
                            {canClose
                              ? "You are not winning"
                              : `Waiting for ${CONSTANTS.PRICE_CHANGE_THRESHOLD}% move`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-lg border border-gray-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-12 w-12 text-gray-400 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m4-4h8"
            />
          </svg>
          <p className="text-gray-500 text-sm">No games found.</p>
        </div>
      )}
    </div>
  );
}
