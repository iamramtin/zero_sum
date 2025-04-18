"use client";

import { HermesClient } from "@pythnetwork/hermes-client";
import { useEffect, useState } from "react";
import { useRef } from "react";

require("@solana/wallet-adapter-react-ui/styles.css");

const PRICE_FEED = {
  symbol: "ETH",
  id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
};

const FEED_IDS = [PRICE_FEED.id];

const PRICE_CHANGE = 0.05;

type PriceData = {
  price: number;
  confidence: number;
  publishTime: number;
  priceChangePercent: number | null;
};

// Get real-time price updates from Hermes
const HERMES_URL = "https://hermes.pyth.network/";

async function priceStream(
  onUpdate: (price: number, confidence: number, publishTime: number) => void
) {
  try {
    console.log("[priceStream] Starting ETH price stream...");

    const hermesClient = new HermesClient(HERMES_URL);
    const eventSource = await hermesClient.getPriceUpdatesStream(FEED_IDS);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const parsedArray = data?.parsed ?? [];

      for (const parsed of parsedArray) {
        if (!parsed || !parsed.price || !parsed.id) continue;

        // Check if it's the ETH feed
        if (`0x${parsed.id}`.toLowerCase() !== PRICE_FEED.id.toLowerCase())
          continue;

        const price =
          Number(parsed.price.price) * Math.pow(10, parsed.price.expo);
        const conf =
          Number(parsed.price.conf) * Math.pow(10, parsed.price.expo);
        const publishTime = parsed.price.publish_time;

        console.log("[priceStream] ETH price update:", {
          price,
          confidence: conf,
          publishTime,
        });

        onUpdate(price, conf, publishTime);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[priceStream] Stream error:", err);
      console.log(
        "[priceStream] Closing event source and attempting to reconnect."
      );
      eventSource.close();

      // Attempt to reconnect after a delay
      setTimeout(() => priceStream(onUpdate), 5000);
    };

    return () => {
      console.log("[priceStream] Closing event source.");
      eventSource.close();
    };
  } catch (err) {
    console.error("[priceStream] Error:", err);

    // Attempt to reconnect after a delay
    setTimeout(() => priceStream(onUpdate), 5000);
  }
}

export default function EthPriceMonitor() {
  const [ethData, setEthData] = useState<PriceData | null>(null);
  const [initialPrice, setInitialPrice] = useState<number | null>(null);
  const initialPriceRef = useRef<number | null>(null);

  // Set initial price when first received
  useEffect(() => {
    if (ethData?.price && initialPriceRef.current === null) {
      initialPriceRef.current = ethData.price;
      setInitialPrice(ethData.price);
    }
  }, [ethData?.price]);

  // Calculate price change percentage
  const calculatePriceChange = (currentPrice: number, basePrice: number) => {
    return ((currentPrice - basePrice) / basePrice) * 100;
  };

  // Check if price has hit 5% thresholds
  const checkThresholds = (priceChangePercent: number) => {
    if (priceChangePercent >= PRICE_CHANGE) {
      return `Increase threshold reached! (${PRICE_CHANGE}% or more)`;
    } else if (priceChangePercent <= -PRICE_CHANGE) {
      return `Decrease threshold reached! (${PRICE_CHANGE}% or more)`;
    } else if (priceChangePercent >= 1) {
      return `Price up, but below ${PRICE_CHANGE}% threshold`;
    } else if (priceChangePercent <= -1) {
      return `Price down, but above -${PRICE_CHANGE}% threshold`;
    } else {
      return "Price stable (less than ±1% change)";
    }
  };

  useEffect(() => {
    let cleanupFn: (() => void) | undefined;

    const setup = async () => {
      cleanupFn = await priceStream((price, confidence, publishTime) => {
        setEthData((_prevData) => {
          const priceChangePercent = initialPriceRef.current
            ? calculatePriceChange(price, initialPriceRef.current)
            : null;

          return {
            price,
            confidence,
            publishTime,
            priceChangePercent,
          };
        });
      });
    };

    setup();

    return () => {
      if (cleanupFn) {
        cleanupFn();
      }
    };
  }, []);

  // Reset initial price (for testing)
  const resetInitialPrice = () => {
    if (ethData?.price) {
      initialPriceRef.current = ethData.price;
      setInitialPrice(ethData.price);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-6 bg-gray-100">
      <h1 className="text-3xl font-bold">ETH Price Monitor for Escrow Game</h1>

      <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-md text-center">
        <h2 className="text-2xl font-semibold mb-4">ETH/USD</h2>

        {ethData ? (
          <>
            <div className="text-4xl font-mono mb-4">
              ${ethData.price.toFixed(2)}
            </div>

            <p className="text-sm text-gray-500 mb-2">
              Confidence: ±${ethData.confidence.toFixed(4)}
            </p>

            <p className="text-xs text-gray-400 mb-6">
              Updated:{" "}
              {new Date(ethData.publishTime * 1000).toLocaleTimeString()}
            </p>

            {initialPrice && (
              <div className="border-t pt-4">
                <p className="text-sm font-semibold">
                  Initial Price: ${initialPrice.toFixed(2)}
                </p>

                {ethData.priceChangePercent !== null && (
                  <>
                    <p
                      className={`text-lg font-semibold mt-2 ${
                        ethData.priceChangePercent > 0
                          ? "text-green-600"
                          : ethData.priceChangePercent < 0
                          ? "text-red-600"
                          : ""
                      }`}
                    >
                      {ethData.priceChangePercent > 0 ? "+" : ""}
                      {ethData.priceChangePercent.toFixed(2)}%
                    </p>

                    <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                      <p className="text-sm">
                        {checkThresholds(ethData.priceChangePercent)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-400 italic">
            Waiting for ETH price updates...
          </p>
        )}

        <button
          onClick={resetInitialPrice}
          className="mt-6 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm"
        >
          Reset Initial Price
        </button>
      </div>
    </div>
  );
}
