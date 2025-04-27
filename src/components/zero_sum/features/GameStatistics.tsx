"use client";

import "react-toastify/dist/ReactToastify.css";
import { CONSTANTS } from "../constants";
import { GameStatisticsProps } from "../types";
import { isActiveStatus, isPendingStatus } from "../utils/utils";

require("@solana/wallet-adapter-react-ui/styles.css");

/**
 * Component to display game statistics and summary
 */
export function GameStatistics({
  userGames,
  openGames,
  priceData,
}: GameStatisticsProps): JSX.Element {
  // Calculate total games created
  const totalGames = userGames.length + openGames.length;

  // Calculate total USDC at stake
  const totalStaked =
    (userGames.length + openGames.length) * CONSTANTS.ENTRY_AMOUNT;

  // Count user's active games (with a challenger)
  const activeGames = userGames.filter((game) =>
    isActiveStatus(game.status)
  ).length;

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-3 transition-all hover:shadow-xl border border-gray-100 mb-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Game Statistics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-full p-2 mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Current ETH Price</p>
              <p className="text-lg font-bold">
                ${priceData?.price.toFixed(2) || "Loading..."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
          <div className="flex items-center">
            <div className="bg-purple-100 rounded-full p-2 mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-purple-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Games</p>
              <p className="text-lg font-bold">{totalGames}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-100">
          <div className="flex items-center">
            <div className="bg-green-100 rounded-full p-2 mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-green-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total USDC at Stake</p>
              <p className="text-lg font-bold">{totalStaked}</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
          <div className="flex items-center">
            <div className="bg-yellow-100 rounded-full p-2 mr-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-yellow-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Your Active Games</p>
              <p className="text-lg font-bold">
                {activeGames} / {userGames.length}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
