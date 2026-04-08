import type { FeedCursor } from "@/types/domain";

export function encodeFeedCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeFeedCursor(encoded: string | null | undefined): FeedCursor | null {
  if (!encoded) return null;

  try {
    const decoded = Buffer.from(encoded, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded) as unknown;

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "distanceMeters" in parsed &&
      "lastActivityAt" in parsed &&
      "postId" in parsed &&
      typeof (parsed as FeedCursor).distanceMeters === "number" &&
      typeof (parsed as FeedCursor).lastActivityAt === "string" &&
      typeof (parsed as FeedCursor).postId === "string"
    ) {
      return parsed as FeedCursor;
    }

    return null;
  } catch {
    return null;
  }
}
