"use client";

import { HermesClient } from "@pythnetwork/hermes-client";
import { useEffect, useState } from "react";

require("@solana/wallet-adapter-react-ui/styles.css");

const FEEDS = [
  {
    symbol: "BTC",
    id: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  },
  {
    symbol: "SOL",
    id: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  },
  {
    symbol: "ETH",
    id: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  },
];

const FEED_IDS = FEEDS.map((feed) => feed.id);

const SYMBOLS = FEEDS.reduce<Record<string, string>>((acc, { id, symbol }) => {
  acc[id.toLowerCase()] = symbol;
  return acc;
}, {});

type PriceData = {
  price: number;
  confidence: number;
  publishTime: number;
};

// Hermes provides other methods for retrieving price updates. See
// https://hermes.pyth.network/docs for more information.
const HERMES_URL = "https://hermes.pyth.network/";

async function priceStream(
  onUpdate: (parsed: {
    id: string;
    price: {
      price: string;
      expo: number;
      conf: string;
      publish_time: number;
    };
  }) => void
) {
  try {
    console.log("[priceStream] Starting price stream...");

    const hermesClient = new HermesClient(HERMES_URL);
    const eventSource = await hermesClient.getPriceUpdatesStream(FEED_IDS);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const parsedArray = data?.parsed ?? [];
      for (const parsed of parsedArray) {
        if (!parsed || !parsed.price) continue;

        console.log("[priceStream] Live price update:", {
          price: parsed.price?.price,
          expo: parsed.price?.expo,
          confidence: parsed.price?.conf,
          publishTime: parsed.price?.publish_time,
        });

        onUpdate(parsed);
      }
    };

    eventSource.onerror = (err) => {
      console.error("[priceStream] Stream error:", err);
      console.log("[priceStream] Closing event source.");
      eventSource.close();
    };
  } catch (err) {
    console.error("[priceStream] Error:", err);
  }
}

export default function LivePythStream() {
  const [prices, setPrices] = useState<Record<string, PriceData | null>>({
    BTC: null,
    ETH: null,
    SOL: null,
  });

  useEffect(() => {
    priceStream((parsed) => {
      const symbol = SYMBOLS[`0x${parsed.id}`.toLowerCase()];

      if (!symbol) return;

      const price =
        Number(parsed.price.price) * Math.pow(10, parsed.price.expo);
      const conf = Number(parsed.price.conf) * Math.pow(10, parsed.price.expo);

      setPrices((prev) => ({
        ...prev,
        [symbol]: {
          price,
          confidence: conf,
          publishTime: parsed.price.publish_time,
        },
      }));
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-6 bg-gray-100">
      <h1 className="text-3xl font-bold">Live Pyth Prices</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {Object.entries(prices).map(([symbol, data]) => (
          <div
            key={symbol}
            className="bg-white rounded-2xl shadow-md p-6 w-full max-w-sm text-center"
          >
            <h2 className="text-2xl font-semibold mb-2">{symbol}/USD</h2>
            {data ? (
              <>
                <p className="text-xl font-mono">${data.price.toFixed(2)}</p>
                <p className="text-sm text-gray-500">
                  Confidence: ±{data.confidence.toFixed(4)}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Updated:{" "}
                  {new Date(data.publishTime * 1000).toLocaleTimeString()}
                </p>
              </>
            ) : (
              <p className="text-gray-400 italic">Waiting for updates…</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
