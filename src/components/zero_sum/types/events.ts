import { PublicKey } from "@solana/web3.js";
import { GameStatus, PricePrediction } from "./game";

export type PriceFetchedEvent = {
  description: string;
  price: number;
  timestamp: number;
};

export type PriceChangedEvent = {
  initialPrice: number;
  finalPrice: number;
  percentageChange: number;
  thresholdExceeded: boolean;
  timestamp: number;
};

export type GameCreatedEvent = {
  gameId: number;
  status: GameStatus;
  initiator: PublicKey;
  prediction: PricePrediction;
  initialPrice: number;
  entryAmount: number;
  timestamp: number;
};

export type GameJoinedEvent = {
  gameId: number;
  status: GameStatus;
  challenger: PublicKey;
  challengerPrediction: PricePrediction;
  timestamp: number;
};

export type GameClosedEvent = {
  gameId: number;
  status: GameStatus;
  details: GameStatusDetails;
  timestamp: number;
};

export type GameStatusDetails =
  | {
      complete: {
        winner: PublicKey;
        winningPrediction: PricePrediction;
        priceMovementPercentage: number;
        finalPrice: number;
        totalPayout: number;
      };
    }
  | {
      none: {};
    };
