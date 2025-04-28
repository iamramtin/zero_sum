import { BN } from "@coral-xyz/anchor";

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
