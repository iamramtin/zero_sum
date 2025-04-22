"use client";

import ZeroSumGame from "@/components/zero_sum/zero_sum-game";
import { Suspense } from "react";

export default function ZeroSumPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
      <ZeroSumGame />
    </Suspense>
  );
}
