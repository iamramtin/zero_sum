import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { GameState } from "./game";
import { PriceData } from "./price";

// Type of action a user can perform on a game
export type GameActionType = "close" | "cancel" | "draw";

// Props type for the GameActions hook
export interface GameActionsProps {
  gameStates: GameState[];
  setGameStates: React.Dispatch<React.SetStateAction<GameState[]>>;
  setUserGames: React.Dispatch<React.SetStateAction<GameState[]>>;
  setOpenGames: React.Dispatch<React.SetStateAction<GameState[]>>;
  setNextGameId: React.Dispatch<React.SetStateAction<number>>;
  priceData: PriceData | null;
}

// Return type for the GameActions hook
export interface GameActionsReturn {
  creatingGame: boolean;
  joiningGame: boolean;
  closingGame: boolean;
  withdrawing: boolean;
  requestingDraw: boolean;
  calculatePriceChange: (currentPrice: number, basePrice: number) => number;
}

// Props type for the JoinButton hook
export interface JoinButtonProps {
  game: GameState;
  canJoin: boolean;
  loadingState?: string;
  onJoin: (gameId: BN, initiator: PublicKey) => Promise<void>;
}
