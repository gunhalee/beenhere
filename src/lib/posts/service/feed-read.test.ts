import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeFeedCursor } from "@/lib/posts/repository/cursor";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/config";
import { loadNearbyFeedService } from "./feed-read";
import {
  listNearbyFeedPageRowsRepository,
  resolveFeedRadiusMetersRepository,
} from "@/lib/posts/repository/feed-page";
import { getFeedPostMetadataBatchRepository } from "@/lib/posts/repository/feed-metadata";

vi.mock("@/lib/supabase/config", () => ({
  hasSupabaseBrowserConfig: vi.fn(),
}));

vi.mock("@/lib/posts/repository/feed-page", () => ({
  clampFeedLimit: (raw?: number) => (!raw || raw < 1 ? 20 : Math.min(raw, 50)),
  FEED_TARGET_ITEM_COUNT: 10,
  FEED_RADIUS_STEPS_METERS: [10000, 25000],
  listNearbyFeedPageRowsRepository: vi.fn(),
  resolveFeedRadiusMetersRepository: vi.fn(),
}));

vi.mock("@/lib/posts/repository/feed-metadata", () => ({
  getFeedPostMetadataBatchRepository: vi.fn(),
}));

describe("loadNearbyFeedService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasSupabaseBrowserConfig).mockReturnValue(true);
    vi.mocked(resolveFeedRadiusMetersRepository).mockResolvedValue(10000);
    vi.mocked(listNearbyFeedPageRowsRepository).mockResolvedValue([]);
    vi.mocked(getFeedPostMetadataBatchRepository).mockResolvedValue([]);
  });

  it("resolves radius then merges metadata in page order", async () => {
    vi.mocked(listNearbyFeedPageRowsRepository).mockResolvedValue([
      {
        post_id: "p2",
        distance_meters: 40,
        last_activity_at: "2026-04-11T00:01:00.000Z",
      },
      {
        post_id: "p1",
        distance_meters: 20,
        last_activity_at: "2026-04-11T00:02:00.000Z",
      },
    ]);
    vi.mocked(getFeedPostMetadataBatchRepository).mockResolvedValue([
      {
        post_id: "p1",
        content: "one",
        author_id: "u1",
        author_nickname: "Author One",
        place_label: "Mapo-gu",
        distance_meters: 20,
        created_at: "2026-04-10T00:00:00.000Z",
        like_count: 3,
        my_like: false,
      },
      {
        post_id: "p2",
        content: "two",
        author_id: "u2",
        author_nickname: "Author Two",
        place_label: "Gangnam-gu",
        distance_meters: 40,
        created_at: "2026-04-09T00:00:00.000Z",
        like_count: 4,
        my_like: true,
      },
    ]);

    const result = await loadNearbyFeedService({
      latitude: 37.5,
      longitude: 127.0,
    });

    expect(resolveFeedRadiusMetersRepository).toHaveBeenCalledTimes(1);
    expect(result.radiusMeters).toBe(10000);
    expect(result.items.map((item) => item.postId)).toEqual(["p2", "p1"]);
  });

  it("reuses radius from cursor and skips radius resolution", async () => {
    vi.mocked(listNearbyFeedPageRowsRepository).mockResolvedValue([
      {
        post_id: "p1",
        distance_meters: 20,
        last_activity_at: "2026-04-11T00:02:00.000Z",
      },
    ]);
    vi.mocked(getFeedPostMetadataBatchRepository).mockResolvedValue([
      {
        post_id: "p1",
        content: "one",
        author_id: "u1",
        author_nickname: "Author One",
        place_label: "Mapo-gu",
        distance_meters: 20,
        created_at: "2026-04-10T00:00:00.000Z",
        like_count: 3,
        my_like: false,
      },
    ]);

    const cursor = Buffer.from(
      JSON.stringify({
        distanceMeters: 10,
        lastActivityAt: "2026-04-11T00:00:00.000Z",
        postId: "p0",
        radiusMeters: 25000,
      }),
    ).toString("base64url");

    const result = await loadNearbyFeedService({
      latitude: 37.5,
      longitude: 127.0,
      cursor,
    });

    expect(resolveFeedRadiusMetersRepository).not.toHaveBeenCalled();
    expect(result.radiusMeters).toBe(25000);
  });

  it("encodes next cursor with radiusMeters", async () => {
    vi.mocked(listNearbyFeedPageRowsRepository).mockResolvedValue([
      {
        post_id: "p1",
        distance_meters: 20,
        last_activity_at: "2026-04-11T00:02:00.000Z",
      },
      {
        post_id: "p2",
        distance_meters: 30,
        last_activity_at: "2026-04-11T00:01:00.000Z",
      },
    ]);
    vi.mocked(getFeedPostMetadataBatchRepository).mockResolvedValue([
      {
        post_id: "p1",
        content: "one",
        author_id: "u1",
        author_nickname: "Author One",
        place_label: "Mapo-gu",
        distance_meters: 20,
        created_at: "2026-04-10T00:00:00.000Z",
        like_count: 3,
        my_like: false,
      },
    ]);

    const result = await loadNearbyFeedService({
      latitude: 37.5,
      longitude: 127.0,
      limit: 1,
    });
    const nextCursor = decodeFeedCursor(result.nextCursor);

    expect(nextCursor?.radiusMeters).toBe(10000);
    expect(nextCursor?.postId).toBe("p1");
  });
});
