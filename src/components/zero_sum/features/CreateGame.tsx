"use client";

import "react-toastify/dist/ReactToastify.css";
import BN from "bn.js";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useZeroSumProgram } from "@/components/zero_sum/zero_sum-data-access";
import { CONSTANTS } from "../constants";
import { CreateGameProps } from "../types/components";
import { PricePrediction, PredictionIncrease, PredictionDecrease } from "../types/game";

require("@solana/wallet-adapter-react-ui/styles.css");

/**
 * Component to create a new game
 */
export function CreateGame({
  connected,
  priceData,
}: CreateGameProps): JSX.Element {
  const { publicKey } = useWallet();
  const { createGame } = useZeroSumProgram(priceData);

  const [gameId, setGameId] = useState<number | null>(Date.now());

  const [creatingPrediction, setCreatingPrediction] =
    useState<PricePrediction | null>(null);

  const handleCreateGame = async (prediction: PricePrediction) => {
    if (!publicKey || !gameId || creatingPrediction !== null) return;

    try {
      setCreatingPrediction(prediction);
      await createGame.mutateAsync({
        gameId: new BN(gameId),
        prediction,
      });
    } catch (error) {
      console.error("Error creating game:", error);
    } finally {
      setGameId(null);
      setCreatingPrediction(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-2 transition-all hover:shadow-xl border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Create New Game
      </h2>

      {connected ? (
        <>
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium">Game Rules:</p>
                <p className="text-sm text-gray-600">
                  Entry fee:{" "}
                  <span className="font-bold">
                    {CONSTANTS.ENTRY_AMOUNT} USDC
                  </span>
                </p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              The winner is determined by whether ETH price increases or
              decreases by {CONSTANTS.WIN_PRICE_THRESHOLD}% first. The second
              player must choose the opposite prediction and can only join if
              the ETH price has not changed by more than{" "}
              {CONSTANTS.MAX_JOIN_PRICE_MOVEMENT}%.
            </p>
          </div>

          <p className="mb-4 font-medium">
            Make your prediction: Will ETH price increase or decrease by{" "}
            {CONSTANTS.WIN_PRICE_THRESHOLD}% first?
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => handleCreateGame(PredictionIncrease)}
              disabled={priceData == null || creatingPrediction !== null}
              className={`flex-1 ${
                creatingPrediction === PredictionIncrease
                  ? "bg-gray-400"
                  : "bg-green-500 hover:bg-green-600"
              } text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm flex items-center justify-center disabled:opacity-50`}
            >
              {creatingPrediction === PredictionIncrease ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
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
                  Predict Increase
                </>
              )}
            </button>

            <button
              onClick={() => handleCreateGame(PredictionDecrease)}
              disabled={priceData == null || creatingPrediction !== null}
              className={`flex-1 ${
                creatingPrediction === PredictionDecrease
                  ? "bg-gray-400"
                  : "bg-red-500 hover:bg-red-600"
              } text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm flex items-center justify-center disabled:opacity-50`}
            >
              {creatingPrediction === PredictionDecrease ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating...
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 mr-2"
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
                  Predict Decrease
                </>
              )}
            </button>
          </div>
        </>
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
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="text-gray-600 font-medium">
            Connect your wallet to create a game
          </p>
        </div>
      )}
    </div>
  );
}
