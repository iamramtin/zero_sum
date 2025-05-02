"use client";

import "react-toastify/dist/ReactToastify.css";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast, ToastContainer } from "react-toastify";
import { CreateGame } from "@/components/zero_sum/features/CreateGame";
import { GameStatistics } from "@/components/zero_sum/features/GameStatistics";
import { OpenGames } from "@/components/zero_sum/features/OpenGames";
import { PriceMonitor } from "@/components/zero_sum/features/PriceMonitor";
import { UserGames } from "@/components/zero_sum/features/UserGames";
import { useChainlinkPriceFeed } from "@/components/zero_sum/hooks/useChainlinkPriceFeed";
import { useZeroSumProgram } from "./zero_sum-data-access";
import { CommunityGames } from "./features/CommunityGames";
import { PriceData } from "./types/price";
import { isPendingStatus } from "./utils/gameUtils";

require("@solana/wallet-adapter-react-ui/styles.css");

/**
 * Main Zero Sum Game component
 * This component brings together all the UI components and manages the game state
 */
export default function ZeroSumGame(): JSX.Element {
  // Wallet and connection
  const { publicKey, connected } = useWallet();

  // State variables
  const [priceData, setEthData] = useState<PriceData | null>(null);
  const [initialPrice, setInitialPrice] = useState<number | null>(null);
  const initialPriceRef = useRef<number | null>(null);

  const { getGames } = useZeroSumProgram(priceData);

  // Memoize allGames to prevent recreating the array on every render
  const allGames = useMemo(() => getGames.data || [], [getGames.data]);

  // Filter for games where the user is either the initiator or challenger
  const userGames = useMemo(
    () =>
      allGames.filter(
        (game) =>
          game.initiator.toString() === publicKey?.toString() ||
          game.challenger?.toString() === publicKey?.toString()
      ),
    [allGames, publicKey]
  );

  // Filter for games where the user is either the initiator or challenger
  const openGames = useMemo(
    () =>
      allGames.filter(
        (game) =>
          isPendingStatus(game.status) &&
          game.initiator.toString() !== publicKey?.toString()
      ),
    [allGames, publicKey]
  );

  // Set initial price when first received
  useEffect(() => {
    if (priceData?.price && initialPriceRef.current === null) {
      initialPriceRef.current = priceData.price;
      setInitialPrice(priceData.price);
    }
  }, [priceData?.price]);

  const memoizedOnUpdate = useCallback((price: number, publishTime: number) => {
    const priceChangePercent = initialPriceRef.current
      ? ((price - initialPriceRef.current) / initialPriceRef.current) * 100
      : null;

    setEthData({ price, publishTime, priceChangePercent });
  }, []);

  useChainlinkPriceFeed(memoizedOnUpdate);

  // Reset initial price (for testing)
  const resetInitialPrice = useCallback((): void => {
    if (priceData?.price) {
      initialPriceRef.current = priceData.price;
      setInitialPrice(priceData.price);
      toast.info("Reference price reset to current ETH price");
    }
  }, [priceData]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <ToastContainer position="top-right" autoClose={5000} />

      {connected && (
        <GameStatistics
          allGames={allGames}
          userGames={userGames}
          priceData={priceData}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Price Monitor Section */}
        <PriceMonitor
          priceData={priceData}
          initialPrice={initialPrice}
          resetInitialPrice={resetInitialPrice}
        />

        {/* Create Game Section */}
        <CreateGame connected={connected} priceData={priceData} />
      </div>

      {/* User Games Section */}
      {connected && (
        <div className="mt-8">
          <UserGames
            publicKey={publicKey}
            priceData={priceData}
            userGames={userGames}
          />
        </div>
      )}

      {/* Open Games Section */}
      {connected && (
        <div className="mt-8">
          <OpenGames
            publicKey={publicKey}
            priceData={priceData}
            openGames={openGames}
          />
        </div>
      )}

      {/* Community Games Section */}
      {connected && (
        <div className="mt-8">
          <CommunityGames
            publicKey={publicKey}
            priceData={priceData}
            allGames={allGames}
            userGames={userGames}
            openGames={openGames}
          />
        </div>
      )}

      {!connected && (
        <div className="mt-12 p-8 bg-white rounded-2xl shadow-lg text-center border border-gray-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-gray-400 mb-4"
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
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Connect Your Wallet to Get Started
          </h2>
          <p className="text-gray-600 max-w-lg mx-auto mb-6">
            To participate in the Zero Sum Game, you need to connect your Solana
            wallet. Make predictions on ETH price movements and earn USDC by
            being right!
          </p>
        </div>
      )}

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>© 2025 Zero Sum Game. All rights reserved.</p>
        <p className="mt-1">
          Created by{" "}
          <a
            className="link"
            href="https://github.com/iamramtin/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ramtin Mesgari
          </a>
        </p>
      </footer>
    </div>
  );
}
