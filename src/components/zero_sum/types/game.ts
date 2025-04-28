import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export type PricePrediction = { increase: {} } | { decrease: {} };
export const PredictionIncrease: PricePrediction = { increase: {} };
export const PredictionDecrease: PricePrediction = { decrease: {} };

export type GameStatus =
  | { active: {} }
  | { pending: {} }
  | { complete: {} }
  | { draw: {} }
  | { cancelled: {} };
export const GameStatusActive: GameStatus = { active: {} };
export const GameStatusPending: GameStatus = { pending: {} };
export const GameStatusComplete: GameStatus = { complete: {} };
export const GameStatusDraw: GameStatus = { draw: {} };
export const GameStatusCancelled: GameStatus = { cancelled: {} };

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
