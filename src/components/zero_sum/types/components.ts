import { GameState } from "./game";
import { PublicKey } from "@solana/web3.js";
import { PriceData } from "./price";

export interface PriceMonitorProps {
  priceData: PriceData | null;
  initialPrice: number | null;
  resetInitialPrice: () => void;
}

export interface CreateGameProps {
  connected: boolean;
  priceData: PriceData | null;
}

export interface UserGamesProps {
  userGames: GameState[];
  priceData: PriceData | null;
  publicKey: PublicKey | null;
}

export interface OpenGamesProps {
  openGames: GameState[];
  publicKey: PublicKey | null;
  priceData: PriceData | null;
}

export interface CommunityGamesProps {
  allGames: GameState[];
  userGames: GameState[];
  openGames: GameState[];
  priceData: PriceData | null;
  publicKey: PublicKey | null;
}

export interface GameStatisticsProps {
  allGames: GameState[];
  userGames: GameState[];
  priceData: PriceData | null;
}
