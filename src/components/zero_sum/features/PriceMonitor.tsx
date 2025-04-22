"use client";

import "react-toastify/dist/ReactToastify.css";
import { CONSTANTS } from "../constants";
import { PriceMonitorProps } from "../types";

require("@solana/wallet-adapter-react-ui/styles.css");

/**
 * Component to display current ETH price and changes
 */
export function PriceMonitor({
  priceData,
  initialPrice,
  resetInitialPrice,
}: PriceMonitorProps): JSX.Element {
  // Function to check if price has hit thresholds
  const checkThresholds = (priceChangePercent: number): string => {
    if (priceChangePercent >= CONSTANTS.PRICE_CHANGE_THRESHOLD) {
      return `Increase threshold reached! (${CONSTANTS.PRICE_CHANGE_THRESHOLD}% or more)`;
    } else if (priceChangePercent <= -CONSTANTS.PRICE_CHANGE_THRESHOLD) {
      return `Decrease threshold reached! (${CONSTANTS.PRICE_CHANGE_THRESHOLD}% or more)`;
    } else if (priceChangePercent >= CONSTANTS.JOIN_PRICE_THRESHOLD) {
      return `Price up ${priceChangePercent.toFixed(
        2
      )}%, above joining threshold`;
    } else if (priceChangePercent <= -CONSTANTS.JOIN_PRICE_THRESHOLD) {
      return `Price down ${priceChangePercent.toFixed(
        2
      )}%, above joining threshold`;
    } else {
      return `Price change: ${priceChangePercent.toFixed(2)}% (within ±${
        CONSTANTS.JOIN_PRICE_THRESHOLD
      }% joining threshold)`;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-1 transition-all hover:shadow-xl border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        ETH/USD Price
      </h2>

      {priceData ? (
        <>
          <div className="text-5xl font-mono mb-4 font-bold text-blue-700">
            ${priceData.price.toFixed(2)}
          </div>

          <p className="text-xs text-gray-500 mb-6">
            Last updated:{" "}
            {new Date(priceData.publishTime * 1000).toLocaleTimeString()}
          </p>

          {initialPrice && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-gray-600">
                  Initial Reference Price:
                </p>
                <p className="text-sm font-bold">${initialPrice.toFixed(2)}</p>
              </div>

              {priceData.priceChangePercent !== null && (
                <>
                  <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mt-3">
                    {/* Center marker */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.25 bg-gray-400 z-10" />

                    {/* Price change bar */}
                    {priceData.priceChangePercent !== 0 && (
                      <div
                        className={`absolute h-full top-0 ${
                          priceData.priceChangePercent > 0
                            ? "bg-green-500 left-1/2 origin-left"
                            : "bg-red-500 right-1/2 origin-right"
                        }`}
                        style={{
                          width: `${Math.min(
                            Math.abs(priceData.priceChangePercent) * 10,
                            100
                          )}%`,
                        }}
                      ></div>
                    )}
                  </div>

                  <p
                    className={`text-lg font-semibold mt-2 ${
                      priceData.priceChangePercent > 0
                        ? "text-green-600"
                        : priceData.priceChangePercent < 0
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {priceData.priceChangePercent > 0 ? "+" : ""}
                    {priceData.priceChangePercent.toFixed(2)}%
                  </p>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm">
                      {checkThresholds(priceData.priceChangePercent)}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={resetInitialPrice}
            className="mt-6 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm w-full transition-colors duration-200 shadow-sm"
          >
            Reset Reference Price
          </button>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="text-gray-500 mt-4">Loading ETH price data...</p>
        </div>
      )}
    </div>
  );
}
