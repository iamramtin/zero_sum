/**
 * Renders a status tag component with appropriate styling based on game status.
 * @param status - The game status string.
 * @returns A styled span element representing the status.
 */
export const renderStatusTag = (status: string): JSX.Element => {
  const baseClass =
    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap";

  const statusMap: Record<string, string> = {
    Active: `${baseClass} bg-blue-100 text-blue-800`,
    "Waiting for opponent": `${baseClass} bg-yellow-100 text-yellow-800`,
    Closed: `${baseClass} bg-green-100 text-green-800`,
    Cancelled: `${baseClass} bg-red-100 text-red-800`,
    Unknown: `${baseClass} bg-gray-100 text-gray-500`,
  };

  return (
    <span className={statusMap[status] || statusMap.Unknown}>{status}</span>
  );
};
