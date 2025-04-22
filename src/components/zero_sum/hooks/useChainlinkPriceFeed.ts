"use client";

import "react-toastify/dist/ReactToastify.css";
import * as anchor from "@coral-xyz/anchor";
import { useEffect, useRef } from "react";
import { OCR2Feed } from "@chainlink/solana-sdk";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { clusterApiUrl } from "@solana/web3.js";
import { toast } from "react-toastify";
import { CONSTANTS } from "@/components/zero_sum/constants";

require("@solana/wallet-adapter-react-ui/styles.css");

/**
 * Hook to subscribe to Chainlink price feed updates
 * @param onUpdate - Callback function for price updates
 */
export function useChainlinkPriceFeed(
  onUpdate: (price: number, publishTime: number) => void
): void {
  const wallet = useAnchorWallet();
  const subscriptionIdRef = useRef<number | null>(null);
  const feedRef = useRef<OCR2Feed | null>(null);

  useEffect(() => {
    if (!wallet) return;

    const provider = new anchor.AnchorProvider(
      new anchor.web3.Connection(clusterApiUrl("devnet")),
      wallet,
      {}
    );
    anchor.setProvider(provider);

    let isMounted = true;

    (async () => {
      try {
        const feed = await OCR2Feed.load(
          CONSTANTS.CHAINLINK_OFFCHAIN_PROGRAM_ID,
          provider
        );
        const feedAddress = new anchor.web3.PublicKey(
          CONSTANTS.CHAINLINK_FEED_ADDRESS
        );

        const subscriptionId = feed.onRound(feedAddress, (event) => {
          if (!isMounted) return;

          const price = Number(event.answer) / 10 ** CONSTANTS.FEED_DECIMALS;
          const publishTime = Date.now() / 1000;

          console.log(`💰 ETH/USDC: $${price.toFixed(2)}`);
          onUpdate(price, publishTime);
        });

        console.log(
          "Chainlink listener set up and waiting for price updates..."
        );

        subscriptionIdRef.current = subscriptionId;
        feedRef.current = feed;
      } catch (error) {
        console.error("Error loading Chainlink feed:", error);
        toast.error("Failed to connect to price feed");
      }
    })();

    return () => {
      isMounted = false;

      if (subscriptionIdRef.current !== null && feedRef.current) {
        feedRef.current
          .removeListener(subscriptionIdRef.current)
          .catch((err) => {
            console.warn("Failed to remove Chainlink listener:", err);
          });

        console.log("Removed Chainlink listener");
      }
    };
  }, [wallet, onUpdate]);
}
