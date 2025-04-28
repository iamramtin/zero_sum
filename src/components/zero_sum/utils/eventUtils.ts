import {
  PriceFetchedEvent,
  PriceChangedEvent,
  GameCreatedEvent,
  GameClosedEvent,
  GameStatusDetails,
  GameJoinedEvent,
} from "../types/events";
import { formatGameStatus } from "./gameUtils";
import { isIncreasePrediction } from "./predictionUtils";

/**
 * Handles price fetched event and logs relevant information.
 * @param eventData - The PriceFetchedEvent data.
 */
export function handlePriceFetched(eventData: PriceFetchedEvent) {
  console.log(`Price Fetched Logs:`);
  console.log(`Price is ${eventData.price} for ${eventData.description}`);
}

/**
 * Handles price changed event and logs relevant information.
 * @param eventData - The PriceChangedEvent data.
 */
export function handlePriceChanged(eventData: PriceChangedEvent) {
  console.log(`Price Change Logs:`);
  console.log(`Initial Price: ${eventData.initialPrice}`);
  console.log(`Final Price: ${eventData.finalPrice}`);
  console.log(`Price Change: ${eventData.percentageChange}%`);
  console.log(`Threshold Exceeded: ${eventData.thresholdExceeded}`);
}

/**
 * Handles the game creation event.
 * @param eventData - The GameCreatedEvent data.
 */
export function handleGameCreated(eventData: GameCreatedEvent) {
  console.log(`Game Created Logs: Game ID ${eventData.gameId}`);
  console.log(`Status: ${formatGameStatus(eventData.status)}`);
  console.log(`Initiator: ${eventData.initiator.toBase58()}`);
  if (isIncreasePrediction(eventData.prediction)) {
    console.log("Prediction: Increase");
  } else {
    console.log("Prediction: Decrease");
  }
  console.log(`Initial Price: ${eventData.initialPrice}`);
  console.log(`Entry Amount: ${eventData.entryAmount}`);
}

/**
 * Handles the GameJoined event data and logs relevant details.
 * @param eventData - The event data object from the GameJoined event.
 */
export function handleGameJoined(eventData: GameJoinedEvent): void {
  console.log(`Game Created Logs: Game ID ${eventData.gameId}`);
  console.log(`Status: ${formatGameStatus(eventData.status)}`);
  console.log(`Challenger: ${eventData.challenger}`);

  if (isIncreasePrediction(eventData.challengerPrediction)) {
    console.log("Challenger Prediction: Increase");
  } else {
    console.log("Challenger Prediction: Decrease");
  }
}

/**
 * Handles the game closed event and processes relevant details.
 * @param eventData - The GameClosedEvent data.
 */
export function handleGameClosed(eventData: GameClosedEvent) {
  console.log(`Game Closed Logs: Game ID ${eventData.gameId}`);
  console.log(`Status: ${formatGameStatus(eventData.status)}`);

  const { details } = eventData;
  if ("complete" in details) {
    handleGameComplete(details);
  }
}

/**
 * Handles game completion details.
 * @param details - The details of the completed game.
 */
export function handleGameComplete(details: GameStatusDetails) {
  if ("complete" in details) {
    console.log(`Winner: ${details.complete.winner.toBase58()}`);
    if (isIncreasePrediction(details.complete.winningPrediction)) {
      console.log("Winning Prediction: Increase");
    } else {
      console.log("Winning Prediction: Decrease");
    }
    console.log(
      `Price Movement Percentage: ${details.complete.priceMovementPercentage}%`
    );
    console.log(`Final Price: ${details.complete.finalPrice}`);
    console.log(`Total Payout: ${details.complete.totalPayout}`);
  }
}
