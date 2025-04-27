import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { GameState } from "../../types";
import { GameActionType } from "../../types";
import {
  isCompleteStatus,
  isActiveStatus,
  isCancelledStatus,
  isPendingStatus,
  isDrawStatus,
} from "../../utils/utils";

// Type definitions for component props
interface ActionButtonProps {
  game: GameState;
  isWinning: boolean;
  timeRemaining: number | null;
  publicKey: PublicKey | null;
  onAction: (
    action: GameActionType,
    game: GameState,
  ) => Promise<void>;
  loadingState: string | undefined;
}

// Component for action buttons to avoid duplicating logic
export const ActionButton = ({
  game,
  isWinning,
  timeRemaining,
  publicKey,
  onAction,
  loadingState,
}: ActionButtonProps): JSX.Element => {
  const status = game.status;

  const isLoading = (action: string): boolean => loadingState === action;

  const isTimerActive = Boolean(timeRemaining && timeRemaining > 0);

  if (isCompleteStatus(status) || (isActiveStatus(status) && isWinning)) {
    return (
      <button
        onClick={() => onAction("close", game)}
        disabled={isLoading("close") || isCompleteStatus(status) || !isWinning}
        className="text-purple-600 border border-purple-500 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-lg text-sm disabled:opacity-50"
      >
        {isLoading("close") ? "Closing..." : game.closedAt ? "Closed" : "Close"}
      </button>
    );
  }

  if (
    isCancelledStatus(status) ||
    (isPendingStatus(status) && publicKey?.equals(game.initiator))
  ) {
    return (
      <button
        onClick={() => onAction("cancel", game)}
        disabled={isLoading("cancel") || isCancelledStatus(status)}
        className="text-yellow-600 border border-yellow-500 bg-yellow-50 hover:bg-yellow-100 px-3 py-1 rounded-lg text-sm disabled:opacity-50"
      >
        {isLoading("cancel") ? "Cancelling..." : "Cancel"}
      </button>
    );
  }

  return (
    <div className="relative group inline-block">
      <button
        onClick={() => onAction("draw", game)}
        disabled={isLoading("draw") || isDrawStatus(status) || isTimerActive}
        className="text-gray-600 border border-gray-400 bg-gray-50 hover:bg-gray-100 px-3 py-1 rounded-lg text-sm disabled:opacity-50"
      >
        {isLoading("draw") ? "Processing..." : "Draw"}
      </button>

      {isTimerActive && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
          You need to wait for the timer
        </div>
      )}
    </div>
  );
};
