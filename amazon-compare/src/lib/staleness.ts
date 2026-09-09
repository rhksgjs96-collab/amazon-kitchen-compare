export const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24시간

/**
 * 마지막 갱신 시각이 24시간보다 오래되었는지 판단합니다.
 * lastFetchedAt이 없으면(=한 번도 갱신되지 않음) 오래된 것으로 간주합니다.
 */
export function isStale(
  lastFetchedAt: Date | string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!lastFetchedAt) return true;
  const fetchedTime = new Date(lastFetchedAt).getTime();
  if (Number.isNaN(fetchedTime)) return true;
  return now.getTime() - fetchedTime > STALE_THRESHOLD_MS;
}

/**
 * Builds a relative time string like "3 hours ago" or "2 days ago" for the
 * public (English-facing) site.
 */
export function formatRelativeUpdatedAt(
  lastFetchedAt: Date | string,
  now: Date = new Date()
): string {
  const fetchedTime = new Date(lastFetchedAt).getTime();
  const diffMs = Math.max(0, now.getTime() - fetchedTime);
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}
