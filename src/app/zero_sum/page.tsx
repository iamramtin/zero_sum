"use client";

import * as anchor from "@coral-xyz/anchor";
import { useEffect, useState, useRef, useMemo } from "react";
import { OCR2Feed, Round } from "@chainlink/solana-sdk";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

require("@solana/wallet-adapter-react-ui/styles.css");

const CHAINLINK_FEED_ADDRESS = "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P";
const CHAINLINK_PROGRAM_ID = new anchor.web3.PublicKey(
  "cjg3oHmg9uuPsP8D6g29NWvhySJkdYdAo9D25PRbKXJ"
);
const FEED_DECIMALS = 8; // TO FORMAT INTO READABLE PRICE
const PRICE_CHANGE = 0.05; // 5% threshold
const JOIN_PRICE_CHANGE = 1; // 1% threshold
const ENTRY_AMOUNT = 1000; // 1000 USDC

// Types
type PriceData = {
  price: number;
  publishTime: number;
  priceChangePercent: number | null;
};

type GameState = {
  gameId: string; // Unique identifier for the game
  initiator: string; // Game creator address
  initiatorPrediction: "increase" | "decrease"; // First player's prediction
  challenger?: string; // Joining player address
  entryAmount: number; // Amount to enter the game (default to 1000 USDC)
  initialPrice: number; // Price at game creation (from Chainlink)
  createdAt: number; // Timestamp of game creation
  startedAt?: number; // Timestamp when challenger joined and game started
  closedAt?: number; // Timestamp when game was closed
  cancelledAt?: number; // Timestamp if game was canceled
};

// Utility function to get price updates from Chainlink (rename to priceStream)
function useChainlinkPriceFeed(
  onUpdate: (price: number, publishTime: number) => void
) {
  const wallet = useAnchorWallet();

  useEffect(() => {
    if (!wallet) return;

    const provider = new anchor.AnchorProvider(
      new anchor.web3.Connection(clusterApiUrl("devnet")),
      wallet,
      {}
    );
    anchor.setProvider(provider);

    (async () => {
      const feed: OCR2Feed = await OCR2Feed.load(
        CHAINLINK_PROGRAM_ID,
        provider
      );

      feed.onRound(
        new anchor.web3.PublicKey(CHAINLINK_FEED_ADDRESS),
        (event: Round) => {
          const price = Number(event.answer) / 10 ** FEED_DECIMALS;
          const slot = event.slot;
          const publishTime = Date.now() / 1000;

          console.log("💰", price + "\t\t🕒 ", slot);

          console.log("📥 New round received!");
          console.log("🧮 Answer:", event.answer.toNumber());
          console.log(
            "🕒 Timestamp:",
            new Date(event.slot * 1000).toISOString()
          );

          onUpdate(price, publishTime);
        }
      );
    })();
  }, [wallet, onUpdate]);
}

export default function EthPricePredictionGame() {
  // State variables
  const [ethData, setEthData] = useState<PriceData | null>(null);
  const [initialPrice, setInitialPrice] = useState<number | null>(null);
  const initialPriceRef = useRef<number | null>(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [gameStates, setGameStates] = useState<GameState[]>([]);
  const [userGames, setUserGames] = useState<GameState[]>([]);
  const [openGames, setOpenGames] = useState<GameState[]>([]);
  const [nextGameId, setNextGameId] = useState<number>(1);
  const [creatingGame, setCreatingGame] = useState(false);
  const [joiningGame, setJoiningGame] = useState(false);
  const [closingGame, setClosingGame] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Wallet and connection
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();

  // Memoize the connection to prevent it from changing on every render
  const memoizedConnection = useMemo(() => {
    const newConnection = new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
      "confirmed"
    );
    return newConnection;
  }, []); // Empty dependency array means it only gets created once

  // Set initial price when first received
  useEffect(() => {
    if (ethData?.price && initialPriceRef.current === null) {
      initialPriceRef.current = ethData.price;
      setInitialPrice(ethData.price);
    }
  }, [ethData?.price]);

  // Initialize program and fetch games
  useEffect(() => {
    if (!connected || !anchorWallet) return;

    const loadGames = async () => {
      setLoadingGames(true);
      try {
        // This is where you would connect to your program
        const provider = new anchor.AnchorProvider(
          memoizedConnection,
          anchorWallet,
          {
            commitment: "confirmed",
          }
        );

        // Load your IDL - in a real app, you'd import this
        // const idl = await Program.fetchIdl(PROGRAM_ID, provider);
        // const program = new Program(idl, PROGRAM_ID, provider);

        // Fetch game states from your program
        // Implementation depends on your specific program structure
        // This is a placeholder - replace with actual calls to your program

        // Simulate fetching games for demo purposes
        const mockGames: GameState[] = [
          {
            gameId: "1",
            initiator: anchorWallet.publicKey.toString(),
            initiatorPrediction: "increase",
            entryAmount: ENTRY_AMOUNT,
            initialPrice: 3500.25,
            createdAt: Date.now(),
          },
          {
            gameId: "2",
            initiator: "DiffPubKey123...",
            initiatorPrediction: "decrease",
            entryAmount: ENTRY_AMOUNT,
            initialPrice: 3489.75,
            createdAt: Date.now(),
          },
        ];

        setGameStates(mockGames);

        // Filter games for user and open games
        if (publicKey) {
          const userPubKey = publicKey.toString();
          setUserGames(
            mockGames.filter(
              (g) => g.initiator === userPubKey || g.challenger === userPubKey
            )
          );

          setOpenGames(
            mockGames.filter((g) => !g.challenger && g.initiator !== userPubKey)
          );
        }

        // Set next game ID
        const maxId = Math.max(...mockGames.map((g) => parseInt(g.gameId)), 0);
        setNextGameId(maxId + 1);
      } catch (error) {
        console.error("Failed to load games:", error);
        toast.error("Failed to load games");
      } finally {
        setLoadingGames(false);
      }
    };

    loadGames();
  }, [connected, anchorWallet, publicKey, memoizedConnection]);

  // Calculate price change percentage
  const calculatePriceChange = (currentPrice: number, basePrice: number) => {
    return ((currentPrice - basePrice) / basePrice) * 100;
  };

  // Check if price has hit thresholds
  const checkThresholds = (priceChangePercent: number) => {
    if (priceChangePercent >= PRICE_CHANGE) {
      return `Increase threshold reached! (${PRICE_CHANGE}% or more)`;
    } else if (priceChangePercent <= -PRICE_CHANGE) {
      return `Decrease threshold reached! (${PRICE_CHANGE}% or more)`;
    } else if (priceChangePercent >= JOIN_PRICE_CHANGE) {
      return `Price up ${priceChangePercent.toFixed(
        2
      )}%, above joining threshold`;
    } else if (priceChangePercent <= -JOIN_PRICE_CHANGE) {
      return `Price down ${priceChangePercent.toFixed(
        2
      )}%, above joining threshold`;
    } else {
      return `Price change: ${priceChangePercent.toFixed(
        2
      )}% (within ±${JOIN_PRICE_CHANGE}% joining threshold)`;
    }
  };

  useChainlinkPriceFeed((price, publishTime) => {
    const priceChangePercent = initialPriceRef.current
      ? ((price - initialPriceRef.current) / initialPriceRef.current) * 100
      : null;

    setEthData({ price, publishTime, priceChangePercent });

    if (initialPriceRef.current === null) {
      initialPriceRef.current = price;
      setInitialPrice(price);
    }
  });

  // Reset initial price (for testing)
  const resetInitialPrice = () => {
    if (ethData?.price) {
      initialPriceRef.current = ethData.price;
      setInitialPrice(ethData.price);
    }
  };

  // Create a new game
  const createGame = async (prediction: "increase" | "decrease") => {
    if (!connected || !anchorWallet || !ethData?.price) {
      toast.error("Please connect your wallet first");
      return;
    }

    setCreatingGame(true);
    try {
      // In a real app, this would call your Anchor program
      // This is a placeholder for demonstration
      toast.info(`Creating game with prediction: ETH will ${prediction}`);

      // Simulate creating a game
      setTimeout(() => {
        const newGame: GameState = {
          gameId: nextGameId.toString(),
          initiator: anchorWallet.publicKey.toString(),
          initiatorPrediction: prediction,
          entryAmount: ENTRY_AMOUNT,
          initialPrice: ethData.price,
          createdAt: Date.now(),
        };

        setGameStates((prev) => [...prev, newGame]);
        setUserGames((prev) => [...prev, newGame]);
        setNextGameId((prev) => prev + 1);

        toast.success("Game created successfully!");
      }, 2000);
    } catch (error) {
      console.error("Error creating game:", error);
      toast.error("Failed to create game");
    } finally {
      setCreatingGame(false);
    }
  };

  // Join an existing game
  const joinGame = async (gameId: string) => {
    if (!connected || !anchorWallet || !ethData?.price) {
      toast.error("Please connect your wallet first");
      return;
    }

    const game = gameStates.find((g) => g.gameId === gameId);
    if (!game) {
      toast.error("Game not found");
      return;
    }

    // Check if price has moved more than 1%
    const priceChange = calculatePriceChange(ethData.price, game.initialPrice);
    if (Math.abs(priceChange) > JOIN_PRICE_CHANGE) {
      toast.error(
        `Price has moved by ${priceChange.toFixed(
          2
        )}%, which exceeds the ${JOIN_PRICE_CHANGE}% joining threshold`
      );
      return;
    }

    setJoiningGame(true);
    try {
      // In a real app, this would call your Anchor program
      // This is a placeholder for demonstration
      toast.info(`Joining game with id: ${gameId}`);

      // Simulate joining a game
      setTimeout(() => {
        setGameStates((prev) =>
          prev.map((g) => {
            if (g.gameId === gameId) {
              return {
                ...g,
                challenger: anchorWallet.publicKey.toString(),
                startTimestamp: Date.now() / 1000,
              };
            }
            return g;
          })
        );

        setOpenGames((prev) => prev.filter((g) => g.gameId !== gameId));
        setUserGames((prev) => [
          ...prev,
          { ...game, challenger: anchorWallet.publicKey.toString() },
        ]);

        toast.success("Joined game successfully!");
      }, 2000);
    } catch (error) {
      console.error("Error joining game:", error);
      toast.error("Failed to join game");
    } finally {
      setJoiningGame(false);
    }
  };

  // Close a game (claim winnings)
  const closeGame = async (gameId: string) => {
    if (!connected || !anchorWallet || !ethData?.price) {
      toast.error("Please connect your wallet first");
      return;
    }

    const game = gameStates.find((g) => g.gameId === gameId);
    if (!game) {
      toast.error("Game not found");
      return;
    }

    // Check if price has moved enough to win
    const priceChange = calculatePriceChange(ethData.price, game.initialPrice);
    if (Math.abs(priceChange) < PRICE_CHANGE) {
      toast.error(
        `Price has only moved by ${priceChange.toFixed(
          2
        )}%, which is below the ${PRICE_CHANGE}% threshold to close the game`
      );
      return;
    }

    // Check if user is the winner
    const userPredictedIncrease =
      game.initiator === anchorWallet.publicKey.toString()
        ? game.initiatorPrediction === "increase"
        : game.initiatorPrediction === "decrease";

    const priceIncreased = priceChange > 0;

    if (
      (userPredictedIncrease && !priceIncreased) ||
      (!userPredictedIncrease && priceIncreased)
    ) {
      toast.error("You cannot close this game as you are not the winner");
      return;
    }

    setClosingGame(true);
    try {
      // In a real app, this would call your Anchor program
      // This is a placeholder for demonstration
      toast.info(`Closing game with id: ${gameId}`);

      // Simulate closing a game
      setTimeout(() => {
        setGameStates((prev) => prev.filter((g) => g.gameId !== gameId));
        setUserGames((prev) => prev.filter((g) => g.gameId !== gameId));

        toast.success(`Game closed! You won ${ENTRY_AMOUNT * 2} USDC`);
      }, 2000);
    } catch (error) {
      console.error("Error closing game:", error);
      toast.error("Failed to close game");
    } finally {
      setClosingGame(false);
    }
  };

  // Withdraw from a game (only available if no challenger has joined)
  const withdrawFromGame = async (gameId: string) => {
    if (!connected || !anchorWallet) {
      toast.error("Please connect your wallet first");
      return;
    }

    const game = gameStates.find((g) => g.gameId === gameId);
    if (!game) {
      toast.error("Game not found");
      return;
    }

    if (game.challenger) {
      toast.error("Cannot withdraw from game after a challenger has joined");
      return;
    }

    if (game.initiator !== anchorWallet.publicKey.toString()) {
      toast.error("Only the initiator can withdraw from a game");
      return;
    }

    setWithdrawing(true);

    try {
      // In a real app, this would call your Anchor program
      // This is a placeholder for demonstration
      toast.info(`Withdrawing from game with id: ${gameId}`);

      // Simulate withdrawing from a game
      setTimeout(() => {
        setGameStates((prev) => prev.filter((g) => g.gameId !== gameId));
        setUserGames((prev) => prev.filter((g) => g.gameId !== gameId));
        setOpenGames((prev) => prev.filter((g) => g.gameId !== gameId));

        toast.success(`Successfully withdrew ${ENTRY_AMOUNT} USDC from game`);
      }, 2000);
    } catch (error) {
      console.error("Error withdrawing from game:", error);
      toast.error("Failed to withdraw from game");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <ToastContainer position="top-right" autoClose={5000} />

      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ETH Price Prediction Game</h1>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Price Monitor Section */}
        <div className="bg-white rounded-2xl shadow-md p-6 md:col-span-1">
          <h2 className="text-2xl font-semibold mb-4">ETH/USD Price</h2>

          {ethData ? (
            <>
              <div className="text-4xl font-mono mb-4">
                ${ethData.price.toFixed(2)}
              </div>

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

              <button
                onClick={resetInitialPrice}
                className="mt-6 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm w-full"
              >
                Reset Initial Price
              </button>
            </>
          ) : (
            <p className="text-gray-400 italic">
              Waiting for ETH price updates...
            </p>
          )}
        </div>

        {/* Create Game Section */}
        <div className="bg-white rounded-2xl shadow-md p-6 md:col-span-2">
          <h2 className="text-2xl font-semibold mb-4">Create New Game</h2>

          {connected ? (
            <>
              <p className="mb-4">
                Entry amount:{" "}
                <span className="font-bold">{ENTRY_AMOUNT} USDC</span>
              </p>

              <p className="mb-6">
                Make your prediction: Will ETH price increase or decrease by{" "}
                {PRICE_CHANGE}% first?
              </p>

              <div className="flex gap-4">
                <button
                  onClick={() => createGame("increase")}
                  disabled={creatingGame}
                  className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium"
                >
                  {creatingGame ? "Creating..." : "Predict Increase"}
                </button>

                <button
                  onClick={() => createGame("decrease")}
                  disabled={creatingGame}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium"
                >
                  {creatingGame ? "Creating..." : "Predict Decrease"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-500">
              Connect your wallet to create a game
            </p>
          )}
        </div>

        {/* My Games Section */}
        {connected && (
          <div className="bg-white rounded-2xl shadow-md p-6 md:col-span-3">
            <h2 className="text-2xl font-semibold mb-4">My Games</h2>

            {loadingGames ? (
              <p className="text-gray-500">Loading your games...</p>
            ) : userGames.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Game ID</th>
                      <th className="text-left py-3 px-4">Your Role</th>
                      <th className="text-left py-3 px-4">Your Prediction</th>
                      <th className="text-left py-3 px-4">Initial Price</th>
                      <th className="text-left py-3 px-4">Status</th>
                      <th className="text-left py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userGames.map((game) => {
                      const isInitiator =
                        game.initiator === publicKey?.toString();
                      const userPrediction = isInitiator
                        ? game.initiatorPrediction
                        : game.initiatorPrediction === "increase"
                        ? "decrease"
                        : "increase";
                      const gameStatus = game.challenger
                        ? "Active"
                        : "Waiting for opponent";

                      // Calculate price movement for action button visibility
                      const priceChange =
                        (ethData?.price &&
                          calculatePriceChange(
                            ethData.price,
                            game.initialPrice
                          )) ||
                        0;

                      const canClose =
                        game.challenger &&
                        priceChange !== null &&
                        Math.abs(priceChange) >= PRICE_CHANGE;

                      const isPotentialWinner =
                        canClose &&
                        ((priceChange! > 0 && userPrediction === "increase") ||
                          (priceChange! < 0 && userPrediction === "decrease"));

                      return (
                        <tr
                          key={game.gameId}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">{game.gameId}</td>
                          <td className="py-3 px-4">
                            {isInitiator ? "Initiator" : "Challenger"}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {userPrediction === "increase" ? (
                              <span className="text-green-600">Increase</span>
                            ) : (
                              <span className="text-red-600">Decrease</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            ${game.initialPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">{gameStatus}</td>
                          <td className="py-3 px-4">
                            {!game.challenger && isInitiator ? (
                              <button
                                onClick={() => withdrawFromGame(game.gameId)}
                                disabled={withdrawing}
                                className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white py-1 px-3 rounded text-sm"
                              >
                                {withdrawing ? "Withdrawing..." : "Withdraw"}
                              </button>
                            ) : isPotentialWinner ? (
                              <button
                                onClick={() => closeGame(game.gameId)}
                                disabled={closingGame}
                                className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white py-1 px-3 rounded text-sm"
                              >
                                {closingGame ? "Closing..." : "Claim Win"}
                              </button>
                            ) : (
                              <span className="text-gray-500 text-sm">
                                {canClose
                                  ? "You're not winning"
                                  : "Waiting for 5% move"}
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
              <p className="text-gray-500">No active games</p>
            )}
          </div>
        )}

        {/* Open Games Section */}
        {connected && (
          <div className="bg-white rounded-2xl shadow-md p-6 md:col-span-3">
            <h2 className="text-2xl font-semibold mb-4">Open Games to Join</h2>

            {loadingGames ? (
              <p className="text-gray-500">Loading available games...</p>
            ) : openGames.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Game ID</th>
                      <th className="text-left py-3 px-4">Initiator</th>
                      <th className="text-left py-3 px-4">Their Prediction</th>
                      <th className="text-left py-3 px-4">Your Prediction</th>
                      <th className="text-left py-3 px-4">Initial Price</th>
                      <th className="text-left py-3 px-4">Entry Amount</th>
                      <th className="text-left py-3 px-4">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openGames.map((game) => {
                      const opponentPrediction = game.initiatorPrediction;
                      const yourPrediction =
                        opponentPrediction === "increase"
                          ? "decrease"
                          : "increase";

                      // Calculate price movement since game was created
                      const priceChange =
                        (ethData?.price &&
                          calculatePriceChange(
                            ethData.price,
                            game.initialPrice
                          )) ||
                        0;

                      const canJoin =
                        priceChange !== null &&
                        Math.abs(priceChange) <= JOIN_PRICE_CHANGE;

                      return (
                        <tr
                          key={game.gameId}
                          className="border-b hover:bg-gray-50"
                        >
                          <td className="py-3 px-4">{game.gameId}</td>
                          <td className="py-3 px-4 truncate max-w-[100px]">
                            {game.initiator.substring(0, 8)}...
                          </td>
                          <td className="py-3 px-4">
                            {opponentPrediction === "increase" ? (
                              <span className="text-green-600">Increase</span>
                            ) : (
                              <span className="text-red-600">Decrease</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium">
                            {yourPrediction === "increase" ? (
                              <span className="text-green-600">Increase</span>
                            ) : (
                              <span className="text-red-600">Decrease</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            ${game.initialPrice.toFixed(2)}
                          </td>
                          <td className="py-3 px-4">{game.entryAmount} USDC</td>
                          <td className="py-3 px-4">
                            {canJoin ? (
                              <button
                                onClick={() => joinGame(game.gameId)}
                                disabled={joiningGame}
                                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white py-1 px-3 rounded text-sm"
                              >
                                {joiningGame ? "Joining..." : "Join Game"}
                              </button>
                            ) : (
                              <span className="text-yellow-600 text-sm">
                                Price moved too much
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
              <p className="text-gray-500">No open games available to join</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
