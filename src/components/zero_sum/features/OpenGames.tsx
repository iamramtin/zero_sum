"use client";

import "react-toastify/dist/ReactToastify.css";
import BN from "bn.js";
import { CONSTANTS } from "../constants";
import { OpenGamesProps } from "../types";
import { useZeroSumProgram } from "../zero_sum-data-access";
import { PublicKey } from "@solana/web3.js";
import { useState } from "react";

require("@solana/wallet-adapter-react-ui/styles.css");

/**
 * Component to display open games that user can join
 */
export function OpenGames({
  openGames,
  priceData,
  publicKey,
}: OpenGamesProps): JSX.Element {
  const { calculatePriceChange, joinGame } = useZeroSumProgram(priceData);

  const [loadingStates, setLoadingStates] = useState<Record<string, string>>(
    {}
  );

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

  const handleJoin = async (gameId: BN, initiator: PublicKey) => {
    if (!publicKey || !gameId || loadingStates[gameId.toString()]) return;
    try {
      setLoading(gameId, "joining");
      await joinGame.mutateAsync({
        gameId: new BN(gameId),
        initiator,
      });
    } catch (error) {
      console.error("Error joining game:", error);
      clearLoading(gameId);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-3 transition-all hover:shadow-xl border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Open Games to Join
      </h2>

      {openGames.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "#",
                  "Game ID",
                  "Initiator",
                  "Their Prediction",
                  "Your Prediction",
                  "Initial Price",
                  "Entry Amount",
                  "Price Change",
                  "Actions",
                ].map((label) => (
                  <th
                    key={label}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {openGames.map((game, index) => {
                const opponentPrediction = game.initiatorPrediction;
                const yourPrediction =
                  "increase" in opponentPrediction
                    ? { decrease: {} }
                    : { increase: {} };

                const isIncrease = "increase" in opponentPrediction;

                const priceChange =
                  priceData?.price !== undefined
                    ? calculatePriceChange(priceData.price, game.initialPrice)
                    : 0;

                const canJoin =
                  Math.abs(priceChange) <= CONSTANTS.JOIN_PRICE_THRESHOLD;

                const entryAmount = game.entryAmount.toNumber() / 1_000_000;

                return (
                  <tr key={game.gameId.toString()} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {game.gameId.toString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[120px] truncate">
                      {game.initiator.toString().substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isIncrease ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg
                            className="mr-1 h-3 w-3 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                          Increase
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <svg
                            className="mr-1 h-3 w-3 text-red-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                          Decrease
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {"increase" in yourPrediction ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <svg
                            className="mr-1 h-3 w-3 text-green-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 15l7-7 7 7"
                            />
                          </svg>
                          Increase
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <svg
                            className="mr-1 h-3 w-3 text-red-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                          Decrease
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${game.initialPrice.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {entryAmount.toString()} USDC
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
                      <div className="relative group inline-block">
                        <button
                          onClick={() =>
                            handleJoin(game.gameId, game.initiator)
                          }
                          disabled={
                            loadingStates[game.gameId.toString()] ===
                              "joining" ||
                            !canJoin ||
                            !!game.startedAt ||
                            !!game.closedAt ||
                            !!game.cancelledAt
                          }
                          className="border border-blue-500 text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1 text-sm rounded-lg disabled:opacity-50"
                        >
                          {loadingStates[game.gameId.toString()] === "joining"
                            ? "Joining..."
                            : game.closedAt
                            ? "Joined"
                            : "Join"}
                        </button>

                        {(!canJoin ||
                          !!game.startedAt ||
                          !!game.closedAt ||
                          !!game.cancelledAt) && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                            Price movement
                            {priceChange > 0 ? " above " : " below "}{" "}
                            {CONSTANTS.JOIN_PRICE_THRESHOLD}%
                          </div>
                        )}
                      </div>
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
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-gray-600 font-semibold">
            No open games available.
          </p>
        </div>
      )}
    </div>
  );
}
