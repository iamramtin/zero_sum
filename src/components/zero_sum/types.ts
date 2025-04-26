import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/**
 * Type for price prediction direction
 */
export type PricePrediction = { increase: {} } | { decrease: {} };
export const PredictionIncrease: PricePrediction = { increase: {} };
export const PredictionDecrease: PricePrediction = { decrease: {} };

/**
 * Type for game status
 */
export type GameStatus =
  | { active: {} }
  | { pending: {} }
  | { complete: {} }
  | { draw: {} }
  | { cancelled: {} };
export const GameStatusActive: GameStatus = { active: {} };
export const GameStatusPending: GameStatus = { pending: {} };
export const GameStatusComplete: GameStatus = {
  complete: { increase: {} },
};
export const GameStatusDraw: GameStatus = { draw: {} };
export const GameStatusCancelled: GameStatus = { cancelled: {} };

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
  winningPrediction?: PricePrediction | null;
  entryAmount: BN;
  initialPrice: number;
  finalPrice?: number | null;
  createdAt: BN;
  startedAt?: BN | null;
  closedAt?: BN | null;
  status: GameStatus;
}

/**
 * Type of action a user can perform on a game

 */
export type GameActionType = "close" | "cancel" | "draw";

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
 * Props for CommunityGames component
 */
export interface CommunityGamesProps {
  allGames: GameState[];
  userGames: GameState[];
  openGames: GameState[];
  priceData: PriceData | null;
  publicKey: PublicKey | null;
}

/**
 * Props for GameStatistics component
 */
export interface GameStatisticsProps {
  userGames: GameState[];
  openGames: GameState[];
  priceData: PriceData | null;
}
