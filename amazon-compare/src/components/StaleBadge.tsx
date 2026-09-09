import { isStale, formatRelativeUpdatedAt } from "@/lib/staleness";

export default function StaleBadge({ lastFetchedAt }: { lastFetchedAt: Date | null }) {
  if (!lastFetchedAt) {
    return <span className="block text-xs text-gray-400">Not yet refreshed</span>;
  }

  const stale = isStale(lastFetchedAt);

  return (
    <span
      className={`mt-1 block text-xs ${stale ? "font-medium text-amber-600" : "text-gray-400"}`}
      title={new Date(lastFetchedAt).toLocaleString("en-US")}
    >
      {stale ? "⚠ Data may be outdated (24h+)" : "Recently updated"} ·{" "}
      {formatRelativeUpdatedAt(lastFetchedAt)}
    </span>
  );
}
