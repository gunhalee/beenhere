import type { FeedCursor } from "@/types/domain";

export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function isValidIsoDateString(value: string): boolean {
  const time = Date.parse(value);
  return Number.isFinite(time);
}

function isFeedCursor(value: unknown): value is FeedCursor {
  if (value === null || typeof value !== "object") return false;

  const maybe = value as Partial<FeedCursor>;
  return (
    typeof maybe.distanceMeters === "number" &&
    Number.isFinite(maybe.distanceMeters) &&
    typeof maybe.lastActivityAt === "string" &&
    isValidIsoDateString(maybe.lastActivityAt) &&
    typeof maybe.postId === "string" &&
    maybe.postId.trim().length > 0 &&
    typeof maybe.radiusMeters === "number" &&
    Number.isFinite(maybe.radiusMeters) &&
    maybe.radiusMeters > 0
  );
}

export function decodeFeedCursor(encoded: string | null | undefined): FeedCursor | null {
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as unknown;

    if (isFeedCursor(parsed)) {
      return parsed as FeedCursor;
    }

    return null;
  } catch {
    return null;
  }
}
