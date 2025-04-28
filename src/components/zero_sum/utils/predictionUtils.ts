import {
  PricePrediction,
  PredictionDecrease,
  PredictionIncrease,
} from "../types/game";

/**
 * Determines if a given prediction is an 'increase' prediction.
 * @param prediction - The user's price prediction.
 * @returns True if the prediction is an increase, false otherwise.
 */
export function isIncreasePrediction(prediction: PricePrediction): boolean {
  return "increase" in prediction;
}

/**
 * Determines if a given prediction is a 'decrease' prediction.
 * @param prediction - The user's price prediction.
 * @returns True if the prediction is a decrease, false otherwise.
 */
export function isDecreasePrediction(prediction: PricePrediction): boolean {
  return "decrease" in prediction;
}

/**
 * Checks if two predictions are equal.
 * @param a - First prediction to compare.
 * @param b - Second prediction to compare.
 * @returns True if both predictions have the same direction, false otherwise.
 */
export function arePredictionsEqual(
  a: PricePrediction,
  b: PricePrediction
): boolean {
  return isIncreasePrediction(a) === isIncreasePrediction(b);
}

/**
 * Returns the user's prediction based on whether they are the initiator.
 * If the user is not the initiator, the prediction is the opposite.
 * @param initiatorPrediction - The prediction made by the initiator.
 * @param isInitiator - Whether the user is the initiator.
 * @returns The appropriate prediction for the user.
 */
export function getUserPrediction(
  initiatorPrediction: PricePrediction,
  isInitiator: boolean
): PricePrediction {
  if (isInitiator) return initiatorPrediction;
  return isIncreasePrediction(initiatorPrediction)
    ? PredictionDecrease
    : PredictionIncrease;
}
