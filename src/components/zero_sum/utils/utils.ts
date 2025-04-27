import BN from "bn.js";
import {
  PricePrediction,
  PredictionIncrease,
  PredictionDecrease,
  GameStatus,
  GameActionType,
  GameState,
} from "../types";

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
 * Determines if a given status is active.
 * @param status - The game status.
 * @returns True if the prediction is active, false otherwise.
 */
export function isActiveStatus(status: GameStatus): boolean {
  return "active" in status;
}

/**
 * Determines if a given status is pending.
 * @param status - The game status.
 * @returns True if the status is pending, false otherwise.
 */
export function isPendingStatus(status: GameStatus): boolean {
  return "pending" in status;
}

/**
 * Determines if a given status is complete.
 * @param status - The game status.
 * @returns True if the status is complete, false otherwise.
 */
export function isCompleteStatus(status: GameStatus): boolean {
  return "complete" in status;
}

/**
 * Determines if a completed status represents an increase outcome.
 * @param status - The game status.
 * @returns True if complete with increase, false otherwise.
 */
export function isCompleteIncreaseStatus(status: GameStatus): boolean {
  return "complete" in status && "increase" in status.complete;
}

/**
 * Determines if a completed status represents a decrease outcome.
 * @param status - The game status.
 * @returns True if complete with decrease, false otherwise.
 */
export function isCompleteDecreaseStatus(status: GameStatus): boolean {
  return "complete" in status && "decrease" in status.complete;
}

/**
 * Determines if a given status is a draw.
 * @param status - The game status.
 * @returns True if the status is a draw, false otherwise.
 */
export function isDrawStatus(status: GameStatus): boolean {
  return "draw" in status;
}

/**
 * Determines if a given status is cancelled.
 * @param status - The game status.
 * @returns True if the status is cancelled, false otherwise.
 */
export function isCancelledStatus(status: GameStatus): boolean {
  return "cancelled" in status;
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

export const getAvailableActions = (status: GameStatus): GameActionType[] => {
  const actions: GameActionType[] = [];

  if (isPendingStatus(status)) {
    actions.push("cancel");
  }
  if (isActiveStatus(status)) {
    actions.push("draw", "close");
  }

  return actions;
};

/**
 * Converts a BN Unix timestamp (in seconds) to a JavaScript Date (milliseconds).
 * @param timestamp - A BN, number, or null representing a Unix timestamp.
 * @returns A JavaScript Date object.
 */
export const formatUnixTimestampBN = (timestamp: BN | number | null): Date => {
  if (!timestamp) return new Date(0);
  const seconds = BN.isBN(timestamp) ? timestamp.toNumber() : Number(timestamp);
  return new Date(seconds * 1000);
};

/**
 * Returns a human-readable status string for a game based on its timestamps.
 * @param game - The game object containing various timestamp fields.
 * @returns A string representing the current status of the game.
 */
export const getGameStatus = (game: {
  closedAt?: any;
  startedAt?: any;
  createdAt?: any;
}): string => {
  if (game.closedAt) return "Closed";
  if (game.createdAt && !game.startedAt && !game.closedAt)
    return "Waiting for opponent";
  if (game.createdAt && !game.closedAt) return "Active";
  return "Unknown";
};

export function getStatusText(status: GameStatus): string {
  if (status === undefined) return "Unknown";
  if ("active" in status) return "Active";
  if ("pending" in status) return "Waiting for opponent";
  if ("complete" in status) return "Completed";
  if ("draw" in status) return "Draw";
  if ("cancelled" in status) return "Cancelled";
  return "Unknown";
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 *
 * @param ms - Duration in milliseconds.
 * @returns A formatted string like "1d 3h 24m 5s".
 */
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (secs || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(" ");
};

/**
 * Calculates the elapsed time in milliseconds since the start date.
 *
 * @param startDate - A UNIX timestamp (in seconds) or Date object.
 * @param now - Optionally provide current time for controlled updates.
 * @returns Elapsed time in milliseconds, or null if startDate is null.
 */
export const getTimeElapsed = (
  startDate: number | null | Date,
  now: number = Date.now()
): number | null => {
  if (!startDate) return null;
  const startedAt =
    startDate instanceof Date ? startDate : new Date(Number(startDate) * 1000);
  return now - startedAt.getTime();
};

/**
 * Calculates the remaining time in milliseconds until the timeout.
 *
 * @param startDate - A UNIX timestamp (in seconds) or Date object.
 * @param duration - Timeout duration in seconds.
 * @param now - Optional current time override for consistent updates.
 * @returns Remaining time in milliseconds, or null if startDate is null.
 */
export const getTimeRemaining = (
  startDate: number | null | Date,
  duration: number,
  now: number = Date.now()
): number | null => {
  const elapsed = getTimeElapsed(startDate, now);
  if (elapsed === null) return null;
  return Math.max(0, duration * 1000 - elapsed);
};

/**
 * Returns a formatted string with elapsed time.
 *
 * @param startDate - Start time as UNIX timestamp or Date.
 * @param now - Optionally provide current time for controlled updates.
 * @returns A string like "5m 12s" or "-".
 */
export const formatTimeElapsed = (
  startDate: number | null | Date,
  now: number = Date.now()
): string => {
  const elapsedMs = getTimeElapsed(startDate, now);
  return elapsedMs === null ? "-" : formatDuration(elapsedMs);
};
