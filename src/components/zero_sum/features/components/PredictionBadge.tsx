import { PricePrediction } from "scripts/seed";
import { isIncreasePrediction } from "../../utils/utils";

export const PredictionBadge = ({
  prediction,
}: {
  prediction: PricePrediction;
}) => (
  <span
    className={`${
      isIncreasePrediction(prediction)
        ? "text-green-800 bg-green-100"
        : "text-red-800 bg-red-100"
    } px-2 py-1 rounded-full text-xs font-medium inline-flex items-center whitespace-nowrap`}
  >
    {isIncreasePrediction(prediction) ? "▲ Increase" : "▼ Decrease"}
  </span>
);
