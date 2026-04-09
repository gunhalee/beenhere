import { describe, expect, it } from "vitest";
import { decodeFeedCursor, encodeFeedCursor } from "./cursor";

describe("feed cursor", () => {
  it("encodes and decodes a valid cursor", () => {
    const encoded = encodeFeedCursor({
      distanceMeters: 123.45,
      lastActivityAt: "2026-04-09T00:00:00.000Z",
      postId: "post-1",
    });

    const decoded = decodeFeedCursor(encoded);
    expect(decoded).toEqual({
      distanceMeters: 123.45,
      lastActivityAt: "2026-04-09T00:00:00.000Z",
      postId: "post-1",
    });
  });

  it("returns null for malformed base64", () => {
    expect(decodeFeedCursor("%%%not-base64%%%")).toBeNull();
  });

  it("returns null for invalid date cursor", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        distanceMeters: 42,
        lastActivityAt: "not-a-date",
        postId: "post-1",
      }),
    ).toString("base64url");

    expect(decodeFeedCursor(encoded)).toBeNull();
  });

  it("returns null for empty postId cursor", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        distanceMeters: 42,
        lastActivityAt: "2026-04-09T00:00:00.000Z",
        postId: "   ",
      }),
    ).toString("base64url");

    expect(decodeFeedCursor(encoded)).toBeNull();
  });
});

