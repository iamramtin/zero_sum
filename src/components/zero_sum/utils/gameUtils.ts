import { GameStatus } from "../types/game";
import { GameActionType } from "../types/hooks";

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

export function formatGameStatus(status: GameStatus): string {
  if (status === undefined) return "Unknown";
  if ("active" in status) return "Active";
  if ("pending" in status) return "Waiting for opponent";
  if ("complete" in status) return "Completed";
  if ("draw" in status) return "Draw";
  if ("cancelled" in status) return "Cancelled";
  return "Unknown";
}

/**
 * Gets available actions based on the game status.
 * @param status - The current game status.
 * @returns List of available game actions.
 */
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
