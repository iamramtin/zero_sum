export const EmptyGamesState = (): JSX.Element => (
  <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-lg border border-gray-200">
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-12 w-12 text-gray-400 mb-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m4-4h8"
      />
    </svg>
    <p className="text-gray-500 text-sm">No games found.</p>
  </div>
);
