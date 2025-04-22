import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Type for price prediction direction
 */
export type PricePrediction = { increase: {} } | { decrease: {} };
export const PredictionIncrease: PricePrediction = { increase: {} };
export const PredictionDecrease: PricePrediction = { decrease: {} };

/**
 * Type for price data
 */
export interface PriceData {
  price: number;
  publishTime: number;
  priceChangePercent: number | null;
}

/**
 * Type for game state
 */
export interface GameState {
  gameId: BN;
  initiator: PublicKey;
  initiatorPrediction: PricePrediction;
  challenger?: PublicKey | null;
  entryAmount: BN;
  initialPrice: number;
  createdAt: BN;
  startedAt?: BN | null;
  closedAt?: BN | null;
  cancelledAt?: BN | null;
}

/**
 * Props type for the GameActions hook
 */
export interface GameActionsProps {
  gameStates: GameState[];
  setGameStates: React.Dispatch<React.SetStateAction<GameState[]>>;
  setUserGames: React.Dispatch<React.SetStateAction<GameState[]>>;
  setOpenGames: React.Dispatch<React.SetStateAction<GameState[]>>;
  setNextGameId: React.Dispatch<React.SetStateAction<number>>;
  priceData: PriceData | null;
}

/**
 * Return type for the GameActions hook
 */
export interface GameActionsReturn {
  creatingGame: boolean;
  joiningGame: boolean;
  closingGame: boolean;
  withdrawing: boolean;
  requestingDraw: boolean;
  calculatePriceChange: (currentPrice: number, basePrice: number) => number;
}

/**
 * Props for PriceMonitor component
 */
export interface PriceMonitorProps {
  priceData: PriceData | null;
  initialPrice: number | null;
  resetInitialPrice: () => void;
}

/**
 * Props for CreateGame component
 */
export interface CreateGameProps {
  connected: boolean;
  // creating: boolean;
  priceData: PriceData | null;
}

/**
 * Props for UserGames component
 */
export interface UserGamesProps {
  userGames: GameState[];
  priceData: PriceData | null;
  publicKey: PublicKey | null;
}

/**
 * Props for OpenGames component
 */
export interface OpenGamesProps {
  openGames: GameState[];
  publicKey: PublicKey | null;
  priceData: PriceData | null;
}

/**
 * Props for GameStatistics component
 */
export interface GameStatisticsProps {
  userGames: GameState[];
  openGames: GameState[];
  priceData: PriceData | null;
}
