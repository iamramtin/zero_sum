"use client";

// Import required libraries
import * as anchor from "@coral-xyz/anchor";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { OCR2Feed, Round } from "@chainlink/solana-sdk";
import { useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

require("@solana/wallet-adapter-react-ui/styles.css");

// Constants
// ------------------------------------------------------------------------------------------------
// src/constants/index.ts
const CONSTANTS = {
  CHAINLINK_FEED_ADDRESS: "669U43LNHx7LsVj95uYksnhXUfWKDsdzVqev3V4Jpw3P",
  CHAINLINK_PROGRAM_ID: new anchor.web3.PublicKey(
    "cjg3oHmg9uuPsP8D6g29NWvhySJkdYdAo9D25PRbKXJ"
  ),
  FEED_DECIMALS: 8, // To format into readable price
  PRICE_CHANGE_THRESHOLD: 5, // 5% threshold to win
  JOIN_PRICE_THRESHOLD: 1, // 1% threshold to join
  ENTRY_AMOUNT: 1000, // 1000 USDC
  GAME_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
};

// Types
// ------------------------------------------------------------------------------------------------
// src/types/index.ts

/**
 * Type for price prediction direction
 */
type PredictionDirection = "increase" | "decrease";

/**
 * Type for price data
 */
interface PriceData {
  price: number;
  publishTime: number;
  priceChangePercent: number | null;
}

/**
 * Type for game state
 */
interface GameState {
  gameId: string;
  initiator: string;
  initiatorPrediction: PredictionDirection;
  challenger?: string;
  entryAmount: number;
  initialPrice: number;
  createdAt: number;
  startedAt?: number;
  closedAt?: number;
  cancelledAt?: number;
}

/**
 * Props type for the GameActions hook
 */
interface GameActionsProps {
  gameStates: GameState[];
  setGameStates: React.Dispatch<React.SetStateAction<GameState[]>>;
  setUserGames: React.Dispatch<React.SetStateAction<GameState[]>>;
  setOpenGames: React.Dispatch<React.SetStateAction<GameState[]>>;
  setNextGameId: React.Dispatch<React.SetStateAction<number>>;
  ethData: PriceData | null;
}

/**
 * Return type for the GameActions hook
 */
interface GameActionsReturn {
  creatingGame: boolean;
  joiningGame: boolean;
  closingGame: boolean;
  withdrawing: boolean;
  requestingDraw: boolean;
  createGame: (prediction: PredictionDirection) => Promise<void>;
  joinGame: (gameId: string) => Promise<void>;
  closeGame: (gameId: string) => Promise<void>;
  withdrawFromGame: (gameId: string) => Promise<void>;
  requestDraw: (gameId: string) => Promise<void>;
  calculatePriceChange: (currentPrice: number, basePrice: number) => number;
}

/**
 * Props for PriceMonitor component
 */
interface PriceMonitorProps {
  ethData: PriceData | null;
  initialPrice: number | null;
  resetInitialPrice: () => void;
}

/**
 * Props for CreateGame component
 */
interface CreateGameProps {
  connected: boolean;
  creating: boolean;
  onCreateGame: (prediction: PredictionDirection) => Promise<void>;
}

/**
 * Props for UserGames component
 */
interface UserGamesProps {
  userGames: GameState[];
  ethData: PriceData | null;
  publicKey: PublicKey | null;
  calculatePriceChange: (currentPrice: number, basePrice: number) => number;
  onCloseGame: (gameId: string) => Promise<void>;
  onWithdraw: (gameId: string) => Promise<void>;
  onRequestDraw: (gameId: string) => Promise<void>;
  closingGame: boolean;
  withdrawing: boolean;
  requestingDraw: boolean;
}

/**
 * Props for OpenGames component
 */
interface OpenGamesProps {
  openGames: GameState[];
  ethData: PriceData | null;
  calculatePriceChange: (currentPrice: number, basePrice: number) => number;
  onJoinGame: (gameId: string) => Promise<void>;
  joiningGame: boolean;
}

/**
 * Props for GameStatistics component
 */
interface GameStatisticsProps {
  userGames: GameState[];
  openGames: GameState[];
  ethData: PriceData | null;
}

/**
 * Main Zero Sum Game component
 * This component brings together all the UI components and manages the game state
 */
export default function ZeroSumGame(): JSX.Element {
  // State variables
  const [ethData, setEthData] = useState<PriceData | null>(null);
  const [initialPrice, setInitialPrice] = useState<number | null>(null);
  const initialPriceRef = useRef<number | null>(null);
  const [loadingGames, setLoadingGames] = useState<boolean>(false);
  const [gameStates, setGameStates] = useState<GameState[]>([]);
  const [userGames, setUserGames] = useState<GameState[]>([]);
  const [openGames, setOpenGames] = useState<GameState[]>([]);
  const [nextGameId, setNextGameId] = useState<number>(1);

  // Wallet and connection
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();

  // Memoize the connection to prevent recreating on every render
  const memoizedConnection = useMemo(() => {
    return new Connection(
      process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
      "confirmed"
    );
  }, []);

  // Game actions hook
  const {
    creatingGame,
    joiningGame,
    closingGame,
    withdrawing,
    requestingDraw,
    createGame,
    joinGame,
    closeGame,
    withdrawFromGame,
    requestDraw,
    calculatePriceChange,
  } = useGameActions({
    gameStates,
    setGameStates,
    setUserGames,
    setOpenGames,
    setNextGameId,
    ethData,
  });

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

    const loadGames = async (): Promise<void> => {
      setLoadingGames(true);
      try {
        // This is where you would connect to your Solana program
        const provider = new anchor.AnchorProvider(
          memoizedConnection,
          anchorWallet,
          {
            commitment: "confirmed",
          }
        );

        // In a real implementation, you'd load your IDL and connect to your program
        // const idl = await Program.fetchIdl(PROGRAM_ID, provider);
        // const program = new Program(idl, PROGRAM_ID, provider);

        // For demo purposes, we're creating mock games
        const mockGames: GameState[] = [
          {
            gameId: "1",
            initiator: anchorWallet.publicKey.toString(),
            initiatorPrediction: "increase",
            entryAmount: CONSTANTS.ENTRY_AMOUNT,
            initialPrice: 3500.25,
            createdAt: Date.now() - 600000, // 10 minutes ago
          },
          {
            gameId: "2",
            initiator: "DiffPubKey123...",
            initiatorPrediction: "decrease",
            entryAmount: CONSTANTS.ENTRY_AMOUNT,
            initialPrice: 3489.75,
            createdAt: Date.now() - 300000, // 5 minutes ago
          },
          {
            gameId: "3",
            initiator: "AnotherKey456...",
            initiatorPrediction: "increase",
            entryAmount: CONSTANTS.ENTRY_AMOUNT,
            initialPrice: 3505.5,
            createdAt: Date.now() - 900000, // 15 minutes ago
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

  const memoizedOnUpdate = useCallback((price: number, publishTime: number) => {
    const priceChangePercent = initialPriceRef.current
      ? ((price - initialPriceRef.current) / initialPriceRef.current) * 100
      : null;

    setEthData({ price, publishTime, priceChangePercent });
  }, []);

  useChainlinkPriceFeed(memoizedOnUpdate);

  // Reset initial price (for testing)
  const resetInitialPrice = useCallback((): void => {
    if (ethData?.price) {
      initialPriceRef.current = ethData.price;
      setInitialPrice(ethData.price);
      toast.info("Reference price reset to current ETH price");
    }
  }, [ethData]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <ToastContainer position="top-right" autoClose={5000} />

      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Zero Sum Game</h1>
          <p className="text-gray-600 mt-1">
            ETH/USDC Price Prediction Challenge
          </p>
        </div>

        {/* Here you would add your wallet connect button */}
        <div className="bg-blue-600 text-white px-4 py-2 rounded-lg">
          {connected ? "Wallet Connected" : "Connect Wallet"}
        </div>
      </header>

      {connected && (
        <GameStatistics
          userGames={userGames}
          openGames={openGames}
          ethData={ethData}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Price Monitor Section */}
        <PriceMonitor
          ethData={ethData}
          initialPrice={initialPrice}
          resetInitialPrice={resetInitialPrice}
        />

        {/* Create Game Section */}
        <CreateGame
          connected={connected}
          creating={creatingGame}
          onCreateGame={createGame}
        />
      </div>

      {/* My Games Section */}
      {connected && (
        <div className="mt-8">
          <UserGames
            userGames={userGames}
            ethData={ethData}
            publicKey={publicKey}
            calculatePriceChange={calculatePriceChange}
            onCloseGame={closeGame}
            onWithdraw={withdrawFromGame}
            onRequestDraw={requestDraw}
            closingGame={closingGame}
            withdrawing={withdrawing}
            requestingDraw={requestingDraw}
          />
        </div>
      )}

      {/* Open Games Section */}
      {connected && (
        <div className="mt-8">
          <OpenGames
            openGames={openGames}
            ethData={ethData}
            calculatePriceChange={calculatePriceChange}
            onJoinGame={joinGame}
            joiningGame={joiningGame}
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
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200">
            Connect Wallet
          </button>
        </div>
      )}

      <footer className="mt-12 text-center text-gray-500 text-sm">
        <p>© 2025 Zero Sum Game. All rights reserved.</p>
        <p className="mt-1">Built on Solana with Chainlink price feeds</p>
      </footer>
    </div>
  );
}

// Hooks
// ------------------------------------------------------------------------------------------------
// src/hooks/useChainlinkPriceFeed.ts
/**
 * Hook to subscribe to Chainlink price feed updates
 * @param onUpdate - Callback function for price updates
 */
function useChainlinkPriceFeed(
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
          CONSTANTS.CHAINLINK_PROGRAM_ID,
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

// src/hooks/useGameActions.ts
/**
 * Hook for game-related actions
 */
function useGameActions({
  gameStates,
  setGameStates,
  setUserGames,
  setOpenGames,
  setNextGameId,
  ethData,
}: GameActionsProps): GameActionsReturn {
  const { publicKey, connected } = useWallet();
  const anchorWallet = useAnchorWallet();
  const [creatingGame, setCreatingGame] = useState<boolean>(false);
  const [joiningGame, setJoiningGame] = useState<boolean>(false);
  const [closingGame, setClosingGame] = useState<boolean>(false);
  const [withdrawing, setWithdrawing] = useState<boolean>(false);
  const [requestingDraw, setRequestingDraw] = useState<boolean>(false);

  // Calculate price change percentage
  const calculatePriceChange = useCallback(
    (currentPrice: number, basePrice: number): number => {
      return ((currentPrice - basePrice) / basePrice) * 100;
    },
    []
  );

  // Create a new game
  const createGame = useCallback(
    async (prediction: PredictionDirection): Promise<void> => {
      if (!connected || !anchorWallet || !ethData?.price) {
        toast.error("Please connect your wallet first");
        return;
      }

      setCreatingGame(true);
      try {
        // In a real app, this would call your Anchor program
        toast.info(`Creating game with prediction: ETH will ${prediction}`);

        // Simulate blockchain delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const newGame: GameState = {
          gameId: String(gameStates.length + 1),
          initiator: anchorWallet.publicKey.toString(),
          initiatorPrediction: prediction,
          entryAmount: CONSTANTS.ENTRY_AMOUNT,
          initialPrice: ethData.price,
          createdAt: Date.now(),
        };

        setGameStates((prev) => [...prev, newGame]);
        setNextGameId((prev) => prev + 1);

        toast.success("Game created successfully!");

        // Update user games list
        if (publicKey) {
          setUserGames((prev) => [...prev, newGame]);
        }
      } catch (error) {
        console.error("Error creating game:", error);
        toast.error("Failed to create game");
      } finally {
        setCreatingGame(false);
      }
    },
    [
      connected,
      anchorWallet,
      ethData,
      gameStates.length,
      setGameStates,
      setNextGameId,
      setUserGames,
      publicKey,
    ]
  );

  // Join an existing game
  const joinGame = useCallback(
    async (gameId: string): Promise<void> => {
      if (!connected || !anchorWallet || !ethData?.price) {
        toast.error("Please connect your wallet first");
        return;
      }

      const game = gameStates.find((g) => g.gameId === gameId);
      if (!game) {
        toast.error("Game not found");
        return;
      }

      // Check if price has moved more than allowed threshold
      const priceChange = calculatePriceChange(
        ethData.price,
        game.initialPrice
      );
      if (Math.abs(priceChange) > CONSTANTS.JOIN_PRICE_THRESHOLD) {
        toast.error(
          `Price has moved by ${priceChange.toFixed(2)}%, which exceeds the ${
            CONSTANTS.JOIN_PRICE_THRESHOLD
          }% joining threshold`
        );
        return;
      }

      setJoiningGame(true);
      try {
        // In a real app, this would call your Anchor program
        toast.info(`Joining game with id: ${gameId}`);

        // Simulate blockchain delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const updatedGame: GameState = {
          ...game,
          challenger: anchorWallet.publicKey.toString(),
          startedAt: Date.now(),
        };

        setGameStates((prev) =>
          prev.map((g) => (g.gameId === gameId ? updatedGame : g))
        );

        setOpenGames((prev) => prev.filter((g) => g.gameId !== gameId));

        // Add to user games if not already there
        setUserGames((prev) => {
          if (!prev.some((g) => g.gameId === gameId)) {
            return [...prev, updatedGame];
          }
          return prev.map((g) => (g.gameId === gameId ? updatedGame : g));
        });

        toast.success("Joined game successfully!");
      } catch (error) {
        console.error("Error joining game:", error);
        toast.error("Failed to join game");
      } finally {
        setJoiningGame(false);
      }
    },
    [
      connected,
      anchorWallet,
      ethData,
      gameStates,
      calculatePriceChange,
      setGameStates,
      setOpenGames,
      setUserGames,
    ]
  );

  // Close a game (claim winnings)
  const closeGame = useCallback(
    async (gameId: string): Promise<void> => {
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
      const priceChange = calculatePriceChange(
        ethData.price,
        game.initialPrice
      );
      if (Math.abs(priceChange) < CONSTANTS.PRICE_CHANGE_THRESHOLD) {
        toast.error(
          `Price has only moved by ${priceChange.toFixed(
            2
          )}%, which is below the ${
            CONSTANTS.PRICE_CHANGE_THRESHOLD
          }% threshold to close the game`
        );
        return;
      }

      // Determine who should win
      const priceIncreased = priceChange > 0;
      const initiatorWins =
        (game.initiatorPrediction === "increase" && priceIncreased) ||
        (game.initiatorPrediction === "decrease" && !priceIncreased);

      const userIsInitiator =
        game.initiator === anchorWallet.publicKey.toString();
      const userShouldWin = userIsInitiator ? initiatorWins : !initiatorWins;

      if (!userShouldWin) {
        toast.error("You cannot close this game as you are not the winner");
        return;
      }

      setClosingGame(true);
      try {
        // In a real app, this would call your Anchor program
        toast.info(`Closing game with id: ${gameId}`);

        // Simulate blockchain delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Remove the game after closing
        setGameStates((prev) => prev.filter((g) => g.gameId !== gameId));
        setUserGames((prev) => prev.filter((g) => g.gameId !== gameId));

        toast.success(
          `Game closed! You won ${CONSTANTS.ENTRY_AMOUNT * 2} USDC`
        );
      } catch (error) {
        console.error("Error closing game:", error);
        toast.error("Failed to close game");
      } finally {
        setClosingGame(false);
      }
    },
    [
      connected,
      anchorWallet,
      ethData,
      gameStates,
      calculatePriceChange,
      setGameStates,
      setUserGames,
    ]
  );

  // Withdraw from a game (only available if no challenger has joined)
  const withdrawFromGame = useCallback(
    async (gameId: string): Promise<void> => {
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
        toast.info(`Withdrawing from game with id: ${gameId}`);

        // Simulate blockchain delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Remove the game after withdrawal
        setGameStates((prev) => prev.filter((g) => g.gameId !== gameId));
        setUserGames((prev) => prev.filter((g) => g.gameId !== gameId));
        setOpenGames((prev) => prev.filter((g) => g.gameId !== gameId));

        toast.success(
          `Successfully withdrew ${CONSTANTS.ENTRY_AMOUNT} USDC from game`
        );
      } catch (error) {
        console.error("Error withdrawing from game:", error);
        toast.error("Failed to withdraw from game");
      } finally {
        setWithdrawing(false);
      }
    },
    [
      connected,
      anchorWallet,
      gameStates,
      setGameStates,
      setUserGames,
      setOpenGames,
    ]
  );

  // Request a draw due to timeout
  const requestDraw = useCallback(
    async (gameId: string): Promise<void> => {
      if (!connected || !anchorWallet) {
        toast.error("Please connect your wallet first");
        return;
      }

      const game = gameStates.find((g) => g.gameId === gameId);
      if (!game) {
        toast.error("Game not found");
        return;
      }

      // Check if game has timed out
      const now = Date.now();
      const gameAge = now - (game.startedAt || game.createdAt);

      if (gameAge < CONSTANTS.GAME_TIMEOUT) {
        toast.error(
          `Game has not timed out yet. Wait ${Math.ceil(
            (CONSTANTS.GAME_TIMEOUT - gameAge) / 60000
          )} more minutes.`
        );
        return;
      }

      // Check if user is a participant in the game
      const userAddress = anchorWallet.publicKey.toString();
      if (game.initiator !== userAddress && game.challenger !== userAddress) {
        toast.error("Only game participants can request a draw");
        return;
      }

      setRequestingDraw(true);
      try {
        // In a real app, this would call your Anchor program
        toast.info(`Requesting draw for game with id: ${gameId}`);

        // Simulate blockchain delay
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Remove the game after draw
        setGameStates((prev) => prev.filter((g) => g.gameId !== gameId));
        setUserGames((prev) => prev.filter((g) => g.gameId !== gameId));

        toast.success(
          `Game ended in a draw. Your ${CONSTANTS.ENTRY_AMOUNT} USDC has been returned.`
        );
      } catch (error) {
        console.error("Error requesting draw:", error);
        toast.error("Failed to request draw");
      } finally {
        setRequestingDraw(false);
      }
    },
    [connected, anchorWallet, gameStates, setGameStates, setUserGames]
  );

  return {
    creatingGame,
    joiningGame,
    closingGame,
    withdrawing,
    requestingDraw,
    createGame,
    joinGame,
    closeGame,
    withdrawFromGame,
    requestDraw,
    calculatePriceChange,
  };
}

// Components
// ------------------------------------------------------------------------------------------------
/**
 * Component to display game statistics and summary
 */
function GameStatistics({
  userGames,
  openGames,
  ethData,
}: GameStatisticsProps): JSX.Element {
  // Calculate total games created
  const totalGames = userGames.length + openGames.length;

  // Calculate total USDC at stake
  const totalStaked =
    (userGames.length + openGames.length) * CONSTANTS.ENTRY_AMOUNT;

  // Count user's active games (with a challenger)
  const activeGames = userGames.filter((game) => game.challenger).length;

  // Count user's pending games (without a challenger)
  const pendingGames = userGames.filter((game) => !game.challenger).length;

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
                ${ethData?.price.toFixed(2) || "Loading..."}
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
                {activeGames} / {pendingGames + activeGames}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// src/components/PriceMonitor.jsx
/**
 * Component to display current ETH price and changes
 */
function PriceMonitor({
  ethData,
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

      {ethData ? (
        <>
          <div className="text-5xl font-mono mb-4 font-bold text-blue-700">
            ${ethData.price.toFixed(2)}
          </div>

          <p className="text-xs text-gray-500 mb-6">
            Last updated:{" "}
            {new Date(ethData.publishTime * 1000).toLocaleTimeString()}
          </p>

          {initialPrice && (
            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium text-gray-600">
                  Initial Reference Price:
                </p>
                <p className="text-sm font-bold">${initialPrice.toFixed(2)}</p>
              </div>

              {ethData.priceChangePercent !== null && (
                <>
                  <div className="relative w-full bg-gray-200 rounded-full h-2.5 overflow-hidden mt-3">
                    {/* Center marker */}
                    <div className="absolute left-1/2 transform -translate-x-1/2 h-full w-0.25 bg-gray-400 z-10" />

                    {/* Price change bar */}
                    {ethData.priceChangePercent !== 0 && (
                      <div
                        className={`absolute h-full top-0 ${
                          ethData.priceChangePercent > 0
                            ? "bg-green-500 left-1/2 origin-left"
                            : "bg-red-500 right-1/2 origin-right"
                        }`}
                        style={{
                          width: `${Math.min(
                            Math.abs(ethData.priceChangePercent) * 10,
                            100
                          )}%`,
                        }}
                      ></div>
                    )}
                  </div>

                  <p
                    className={`text-lg font-semibold mt-2 ${
                      ethData.priceChangePercent > 0
                        ? "text-green-600"
                        : ethData.priceChangePercent < 0
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {ethData.priceChangePercent > 0 ? "+" : ""}
                    {ethData.priceChangePercent.toFixed(2)}%
                  </p>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
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

// src/components/OpenGames.tsx
/**
 * Component to display open games that user can join
 */
function OpenGames({
  openGames,
  ethData,
  calculatePriceChange,
  onJoinGame,
  joiningGame,
}: OpenGamesProps): JSX.Element {
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
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Game ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Initiator
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Their Prediction
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Your Prediction
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Initial Price
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Entry Amount
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Price Change
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {openGames.map((game) => {
                const opponentPrediction = game.initiatorPrediction;
                const yourPrediction =
                  opponentPrediction === "increase" ? "decrease" : "increase";

                // Calculate price movement since game was created
                const priceChange =
                  (ethData?.price &&
                    calculatePriceChange(ethData.price, game.initialPrice)) ||
                  0;

                const canJoin =
                  priceChange !== null &&
                  Math.abs(priceChange) <= CONSTANTS.JOIN_PRICE_THRESHOLD;

                return (
                  <tr key={game.gameId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {game.gameId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[120px] truncate">
                      {game.initiator.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {opponentPrediction === "increase" ? (
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
                      {yourPrediction === "increase" ? (
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
                      {game.entryAmount} USDC
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
                      {canJoin ? (
                        <button
                          onClick={() => onJoinGame(game.gameId)}
                          disabled={joiningGame}
                          className="inline-flex items-center px-3 py-1.5 border border-blue-500 text-blue-500 bg-blue-50 hover:bg-blue-100 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          {joiningGame ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-500"
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
                              Joining...
                            </>
                          ) : (
                            "Join Game"
                          )}
                        </button>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <svg
                            className="mr-1 h-3 w-3 text-yellow-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
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
          <p className="text-gray-600 font-medium">No open games available</p>
          <p className="text-gray-500 text-sm mt-1">
            Check back later or create your own game.
          </p>
        </div>
      )}
    </div>
  );
}

// src/components/CreateGame.tsx
/**
 * Component to create a new game
 */
function CreateGame({
  connected,
  creating,
  onCreateGame,
}: CreateGameProps): JSX.Element {
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
              decreases by {CONSTANTS.PRICE_CHANGE_THRESHOLD}% first. The second
              player must choose the opposite prediction and can only join if
              the ETH price has not changed by more than{" "}
              {CONSTANTS.JOIN_PRICE_THRESHOLD}%.
            </p>
          </div>

          <p className="mb-4 font-medium">
            Make your prediction: Will ETH price increase or decrease by{" "}
            {CONSTANTS.PRICE_CHANGE_THRESHOLD}% first?
          </p>

          <div className="flex gap-4">
            <button
              onClick={() => onCreateGame("increase")}
              disabled={creating}
              className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm flex items-center justify-center"
            >
              {creating ? (
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
              onClick={() => onCreateGame("decrease")}
              disabled={creating}
              className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors duration-200 shadow-sm flex items-center justify-center"
            >
              {creating ? (
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

// src/components/UserGames.tsx
/**
 * Component to display games the user is participating in
 */
function UserGames({
  userGames,
  ethData,
  publicKey,
  calculatePriceChange,
  onCloseGame,
  onWithdraw,
  onRequestDraw,
  closingGame,
  withdrawing,
  requestingDraw,
}: UserGamesProps): JSX.Element {
  // Format time remaining until timeout
  const formatTimeRemaining = (createdAt: number): string => {
    const now = Date.now();
    const elapsed = now - createdAt;
    const remaining = Math.max(0, CONSTANTS.GAME_TIMEOUT - elapsed);

    if (remaining <= 0) {
      return "Timeout reached";
    }

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 md:col-span-3 transition-all hover:shadow-xl border border-gray-100">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">My Games</h2>

      {userGames.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Game ID
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Your Role
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Your Prediction
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Initial Price
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Time Remaining
                </th>
                <th
                  scope="col"
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userGames.map((game) => {
                const isInitiator = game.initiator === publicKey?.toString();
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
                    calculatePriceChange(ethData.price, game.initialPrice)) ||
                  0;

                const canClose =
                  game.challenger &&
                  Math.abs(priceChange) >= CONSTANTS.PRICE_CHANGE_THRESHOLD;

                const isPotentialWinner =
                  canClose &&
                  ((priceChange > 0 && userPrediction === "increase") ||
                    (priceChange < 0 && userPrediction === "decrease"));

                const gameAge = Date.now() - (game.startedAt || game.createdAt);
                const canRequestDraw = gameAge >= CONSTANTS.GAME_TIMEOUT;

                return (
                  <tr key={game.gameId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {game.gameId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {isInitiator ? "Initiator" : "Challenger"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {userPrediction === "increase" ? (
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {gameStatus === "Active" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <span className="h-2 w-2 mr-1 bg-blue-400 rounded-full animate-pulse"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Waiting
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatTimeRemaining(game.startedAt || game.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {!game.challenger && isInitiator ? (
                        <button
                          onClick={() => onWithdraw(game.gameId)}
                          disabled={withdrawing}
                          className="inline-flex items-center px-3 py-1.5 border border-yellow-500 text-yellow-500 bg-yellow-50 hover:bg-yellow-100 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                        >
                          {withdrawing ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-yellow-500"
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
                              Withdrawing...
                            </>
                          ) : (
                            "Withdraw"
                          )}
                        </button>
                      ) : isPotentialWinner ? (
                        <button
                          onClick={() => onCloseGame(game.gameId)}
                          disabled={closingGame}
                          className="inline-flex items-center px-3 py-1.5 border border-purple-500 text-purple-500 bg-purple-50 hover:bg-purple-100 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        >
                          {closingGame ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-purple-500"
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
                              Closing...
                            </>
                          ) : (
                            "Claim Win"
                          )}
                        </button>
                      ) : canRequestDraw ? (
                        <button
                          onClick={() => onRequestDraw(game.gameId)}
                          disabled={requestingDraw}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-500 text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-md text-sm font-medium transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                        >
                          {requestingDraw ? (
                            <>
                              <svg
                                className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
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
                              Processing...
                            </>
                          ) : (
                            "Request Draw"
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-500 text-sm italic">
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
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-gray-600 font-medium">No active games</p>
          <p className="text-gray-500 text-sm mt-1">
            Create a new game or join an existing one.
          </p>
        </div>
      )}
    </div>
  );
}
