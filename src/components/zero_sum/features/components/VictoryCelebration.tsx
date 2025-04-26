"use client";

import { useState, useEffect } from "react";
import confetti from "canvas-confetti";

interface VictoryCelebrationProps {
  show: boolean;
  onComplete: () => void;
  prize?: string;
}

/**
 * A component that displays a victory celebration with confetti
 * and prize information when a player wins a game
 */
export const VictoryCelebration = ({
  show,
  onComplete,
  prize = "You won!",
}: VictoryCelebrationProps): JSX.Element | null => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);

      // Trigger confetti explosion
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = {
        startVelocity: 30,
        spread: 360,
        ticks: 60,
        zIndex: 100,
      };

      const randomInRange = (min: number, max: number) => {
        return Math.random() * (max - min) + min;
      };

      const interval: NodeJS.Timeout = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          // Hide celebration after confetti is done
          setTimeout(() => {
            setIsVisible(false);
            onComplete();
          }, 1000);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        // Create confetti from different angles
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: [
            "#26ccff",
            "#a25afd",
            "#ff5e7e",
            "#88ff5a",
            "#fcff42",
            "#ffa62d",
          ],
        });

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: [
            "#26ccff",
            "#a25afd",
            "#ff5e7e",
            "#88ff5a",
            "#fcff42",
            "#ffa62d",
          ],
        });
      }, 250);

      return () => {
        clearInterval(interval);
      };
    }
  }, [show, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md text-center transform animate-bounce-in">
        <div className="text-3xl font-bold text-green-600 mb-4">Victory!</div>
        <div className="w-24 h-24 mx-auto mb-4">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="w-full h-full text-yellow-500"
          >
            <path
              d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="text-xl font-semibold mb-6">{prize}</div>
        <button
          onClick={() => {
            setIsVisible(false);
            onComplete();
          }}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
};

// Add keyframes for the bounce-in animation to your global CSS
// .animate-bounce-in {
//   animation: bounce-in 0.5s ease-out;
// }
//
// @keyframes bounce-in {
//   0% {
//     opacity: 0;
//     transform: scale(0.8);
//   }
//   70% {
//     transform: scale(1.1);
//   }
//   100% {
//     opacity: 1;
//     transform: scale(1);
//   }
// }
