import { GameState, PricePrediction } from "../../types";
import { isCompleteStatus, arePredictionsEqual } from "../../utils/utils";

/**
 * Winner badge component that determines the winner based on the game's winning prediction
 */
export const WinnerBadge = ({
  game,
  userPrediction,
}: {
  game: GameState;
  userPrediction: PricePrediction;
}): JSX.Element | null => {
  // Only show for complete games
  if (!isCompleteStatus(game.status)) {
    return null;
  }

  // Get winning prediction from game data
  let isWinner = false;

  // Check if we have a complete status with winning prediction
  if (isCompleteStatus(game.status) && game.winningPrediction) {
    // Compare user's prediction with winning prediction
    isWinner = arePredictionsEqual(userPrediction, game.winningPrediction);
  }

  // If no winner info available, don't show the badge
  else {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        isWinner ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
      }`}
    >
      <svg
        className={`mr-1 h-3 w-3 ${
          isWinner ? "text-green-600" : "text-gray-600"
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={
            isWinner
              ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              : "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          }
        />
      </svg>
      {isWinner ? "Winner" : "Participant"}
    </span>
  );
};

/**
 * Winner badge specifically for community games where we only have player addresses
 */
export const CommunityWinnerBadge = ({
  game,
  address,
}: {
  game: GameState;
  address: string;
}): JSX.Element | null => {
  if (!isCompleteStatus(game.status) || !address) {
    return null;
  }

  // Determine if this address is the initiator
  const isInitiator = game.initiator.toString() === address;

  // Get the prediction for this address
  const userPrediction = isInitiator
    ? game.initiatorPrediction
    : "increase" in game.initiatorPrediction
    ? { decrease: {} }
    : { increase: {} };

  // Use our helper to check if they're the winner
  return <WinnerBadge game={game} userPrediction={userPrediction} />;
};
