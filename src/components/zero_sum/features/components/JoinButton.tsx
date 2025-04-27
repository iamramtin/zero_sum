import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import { CONSTANTS } from "../../constants";
import { GameState } from "../../types";

// Join Button component
interface JoinButtonProps {
  game: GameState;
  canJoin: boolean;
  loadingState?: string;
  onJoin: (gameId: BN, initiator: PublicKey) => Promise<void>;
}

export const JoinButton = ({
  game,
  canJoin,
  loadingState,
  onJoin,
}: JoinButtonProps): JSX.Element => {
  const isJoining = loadingState === "joining";
  const isDisabled =
    isJoining || !canJoin || !!game.startedAt || !!game.closedAt;

  return (
    <div className="relative group inline-block">
      <button
        onClick={() => onJoin(game.gameId, game.initiator)}
        disabled={isDisabled}
        className="border border-blue-500 text-blue-500 bg-blue-50 hover:bg-blue-100 px-3 py-1 text-sm rounded-lg disabled:opacity-50"
      >
        {isJoining ? "Joining..." : game.closedAt ? "Joined" : "Join"}
      </button>

      {(!canJoin) && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
          Price movement
          {CONSTANTS.MAX_JOIN_PRICE_MOVEMENT < 0 ? " below " : " above "}
          {Math.abs(CONSTANTS.MAX_JOIN_PRICE_MOVEMENT)}%
        </div>
      )}
    </div>
  );
};
