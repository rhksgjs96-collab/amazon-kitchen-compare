import { describe, expect, it } from "vitest";
import { isStale, formatRelativeUpdatedAt, STALE_THRESHOLD_MS } from "@/lib/staleness";

describe("isStale", () => {
  const now = new Date("2026-01-02T00:00:00.000Z");

  it("returns false for data fetched just now", () => {
    expect(isStale(now, now)).toBe(false);
  });

  it("returns false for data under 24 hours old", () => {
    const fetchedAt = new Date(now.getTime() - (STALE_THRESHOLD_MS - 60_000));
    expect(isStale(fetchedAt, now)).toBe(false);
  });

  it("returns true for data exactly at the 24 hour boundary plus one ms", () => {
    const fetchedAt = new Date(now.getTime() - STALE_THRESHOLD_MS - 1);
    expect(isStale(fetchedAt, now)).toBe(true);
  });

  it("returns true for data well over 24 hours old", () => {
    const fetchedAt = new Date(now.getTime() - STALE_THRESHOLD_MS * 3);
    expect(isStale(fetchedAt, now)).toBe(true);
  });

  it("returns true when there is no timestamp at all", () => {
    expect(isStale(null, now)).toBe(true);
    expect(isStale(undefined, now)).toBe(true);
  });

  it("returns true for an invalid date string", () => {
    expect(isStale("not-a-date", now)).toBe(true);
  });
});

describe("formatRelativeUpdatedAt", () => {
  const now = new Date("2026-01-02T12:00:00.000Z");

  it("formats sub-minute gaps as 'just now'", () => {
    expect(formatRelativeUpdatedAt(new Date(now.getTime() - 30_000), now)).toBe("just now");
  });

  it("formats minutes", () => {
    expect(formatRelativeUpdatedAt(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 mins ago");
  });

  it("formats hours", () => {
    expect(formatRelativeUpdatedAt(new Date(now.getTime() - 3 * 60 * 60_000), now)).toBe("3 hours ago");
  });

  it("formats days", () => {
    expect(formatRelativeUpdatedAt(new Date(now.getTime() - 2 * 24 * 60 * 60_000), now)).toBe("2 days ago");
  });
});
